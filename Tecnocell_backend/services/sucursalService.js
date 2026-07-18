const db = require('../config/database');

function serviceError(message, statusCode = 400, code = 'SUCURSAL_ERROR', details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  Object.assign(error, details);
  return error;
}

function positiveId(value, label = 'Identificador') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw serviceError(`${label} no valido`, 400, 'INVALID_ID');
  }
  return id;
}

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

async function inTransaction(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

async function contarSucursalesActivas(empresaId, connection = db, { lock = false } = {}) {
  const id = positiveId(empresaId, 'Empresa');
  const [rows] = await connection.query(
    `SELECT id FROM sucursales
     WHERE empresa_id = ? AND activa = 1${lock ? ' FOR UPDATE' : ''}`,
    [id]
  );
  return rows.length;
}

async function obtenerLimiteSucursales(empresaId, connection = db) {
  const id = positiveId(empresaId, 'Empresa');
  const [rows] = await connection.query(
    `SELECT p.id AS plan_id, p.codigo AS plan_codigo, p.max_sucursales
     FROM suscripciones s
     INNER JOIN planes p ON p.id = s.plan_id
     WHERE s.empresa_id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) {
    throw serviceError(
      'La empresa no tiene un plan configurado',
      409,
      'EMPRESA_PLAN_NOT_FOUND'
    );
  }
  return {
    plan_id: Number(rows[0].plan_id),
    plan_codigo: rows[0].plan_codigo,
    max_sucursales: rows[0].max_sucursales == null
      ? null
      : Number(rows[0].max_sucursales),
  };
}

async function validarLimiteSucursales(
  empresaId,
  connection = db,
  { incremento = 1 } = {}
) {
  // Una conexion transaccional no debe ejecutar consultas concurrentes.
  const plan = await obtenerLimiteSucursales(empresaId, connection);
  const usadas = await contarSucursalesActivas(
    empresaId,
    connection,
    { lock: connection !== db }
  );
  if (plan.max_sucursales !== null && usadas + incremento > plan.max_sucursales) {
    throw serviceError(
      'La empresa alcanzo el limite de sucursales activas de su plan',
      409,
      'PLAN_LIMIT_CONFLICT',
      {
        resource: 'sucursales',
        used: usadas,
        limit: plan.max_sucursales,
        plan: plan.plan_codigo,
      }
    );
  }
  return {
    permitido: true,
    used: usadas,
    limit: plan.max_sucursales,
    available: plan.max_sucursales === null
      ? null
      : Math.max(0, plan.max_sucursales - usadas - incremento),
    plan,
  };
}

async function obtenerSucursalPrincipal(empresaId, connection = db, { lock = false } = {}) {
  const id = positiveId(empresaId, 'Empresa');
  const [rows] = await connection.query(
    `SELECT * FROM sucursales
     WHERE empresa_id = ? AND es_principal = 1
     LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [id]
  );
  return rows[0] || null;
}

async function asegurarSucursalPrincipal(empresaId, connection = null) {
  const execute = async conn => {
    const id = positiveId(empresaId, 'Empresa');
    const principal = await obtenerSucursalPrincipal(id, conn, { lock: true });
    if (principal) return { sucursal: principal, creada: false };

    const [[empresa]] = await conn.query(
      'SELECT id, nombre, direccion, telefono, email FROM empresas WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!empresa) throw serviceError('Empresa no encontrada', 404, 'EMPRESA_NOT_FOUND');

    const [existing] = await conn.query(
      'SELECT id, activa FROM sucursales WHERE empresa_id = ? ORDER BY activa DESC, id LIMIT 1 FOR UPDATE',
      [id]
    );
    let sucursalId;
    if (existing.length) {
      sucursalId = existing[0].id;
      if (!existing[0].activa) await validarLimiteSucursales(id, conn);
      await conn.query(
        'UPDATE sucursales SET es_principal = 1, activa = 1 WHERE id = ? AND empresa_id = ?',
        [sucursalId, id]
      );
    } else {
      await validarLimiteSucursales(id, conn);
      const [result] = await conn.query(
        `INSERT INTO sucursales
         (empresa_id, codigo, nombre, direccion, telefono, email, activa, es_principal)
         VALUES (?, 'principal', ?, ?, ?, ?, 1, 1)`,
        [id, empresa.nombre, empresa.direccion, empresa.telefono, empresa.email]
      );
      sucursalId = result.insertId;
    }
    await conn.query(
      `INSERT IGNORE INTO usuario_sucursales
       (usuario_id, sucursal_id, empresa_id, es_predeterminada)
       SELECT id, ?, empresa_id, 1 FROM users
       WHERE empresa_id = ?`,
      [sucursalId, id]
    );
    const [[sucursal]] = await conn.query(
      'SELECT * FROM sucursales WHERE id = ? AND empresa_id = ?',
      [sucursalId, id]
    );
    return { sucursal, creada: !existing.length };
  };
  return connection ? execute(connection) : inTransaction(execute);
}

async function listarSucursales(empresaId, connection = db) {
  const id = positiveId(empresaId, 'Empresa');
  const [rows] = await connection.query(
    `SELECT * FROM sucursales
     WHERE empresa_id = ?
     ORDER BY es_principal DESC, activa DESC, nombre, id`,
    [id]
  );
  return rows;
}

async function crearSucursal(empresaId, data, options = {}) {
  return inTransaction(async connection => {
    const id = positiveId(empresaId, 'Empresa');
    const nombre = String(data?.nombre || '').trim().slice(0, 150);
    const codigo = normalizeCode(data?.codigo || nombre);
    if (!nombre || !codigo) {
      throw serviceError('Nombre y codigo de sucursal son requeridos', 400, 'INVALID_BRANCH_DATA');
    }
    await validarLimiteSucursales(id, connection);
    const principal = await obtenerSucursalPrincipal(id, connection, { lock: true });
    const esPrincipal = principal ? 0 : 1;
    const [result] = await connection.query(
      `INSERT INTO sucursales
       (empresa_id, codigo, nombre, direccion, telefono, email, activa, es_principal)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        id, codigo, nombre,
        data?.direccion || null,
        data?.telefono || null,
        data?.email || null,
        esPrincipal,
      ]
    );
    const [[sucursal]] = await connection.query(
      'SELECT * FROM sucursales WHERE id = ? AND empresa_id = ?',
      [result.insertId, id]
    );
    return sucursal;
  });
}

async function editarSucursal(empresaId, sucursalId, data) {
  return inTransaction(async connection => {
    const id = positiveId(empresaId, 'Empresa');
    const branchId = positiveId(sucursalId, 'Sucursal');
    const [[current]] = await connection.query(
      'SELECT * FROM sucursales WHERE id = ? AND empresa_id = ? FOR UPDATE',
      [branchId, id]
    );
    if (!current) throw serviceError('Sucursal no encontrada', 404, 'BRANCH_NOT_FOUND');
    const nombre = data?.nombre === undefined
      ? current.nombre
      : String(data.nombre || '').trim().slice(0, 150);
    const codigo = data?.codigo === undefined ? current.codigo : normalizeCode(data.codigo);
    if (!nombre || !codigo) throw serviceError('Datos de sucursal no validos', 400, 'INVALID_BRANCH_DATA');

    if (data?.es_principal === true && !current.es_principal) {
      if (!current.activa) await validarLimiteSucursales(id, connection);
      await connection.query(
        'UPDATE sucursales SET es_principal = 0 WHERE empresa_id = ? AND es_principal = 1',
        [id]
      );
    }
    await connection.query(
      `UPDATE sucursales SET codigo = ?, nombre = ?, direccion = ?, telefono = ?, email = ?,
         es_principal = CASE WHEN ? = 1 THEN 1 ELSE es_principal END,
         activa = CASE WHEN ? = 1 THEN 1 ELSE activa END
       WHERE id = ? AND empresa_id = ?`,
      [
        codigo, nombre,
        data?.direccion === undefined ? current.direccion : data.direccion,
        data?.telefono === undefined ? current.telefono : data.telefono,
        data?.email === undefined ? current.email : data.email,
        data?.es_principal === true ? 1 : 0,
        data?.es_principal === true ? 1 : 0,
        branchId, id,
      ]
    );
    const [[updated]] = await connection.query(
      'SELECT * FROM sucursales WHERE id = ? AND empresa_id = ?',
      [branchId, id]
    );
    return updated;
  });
}

async function cambiarEstadoSucursal(empresaId, sucursalId, activa) {
  return inTransaction(async connection => {
    const id = positiveId(empresaId, 'Empresa');
    const branchId = positiveId(sucursalId, 'Sucursal');
    const [[current]] = await connection.query(
      'SELECT * FROM sucursales WHERE id = ? AND empresa_id = ? FOR UPDATE',
      [branchId, id]
    );
    if (!current) throw serviceError('Sucursal no encontrada', 404, 'BRANCH_NOT_FOUND');
    const nextActive = Boolean(activa);
    if (Boolean(current.activa) === nextActive) return current;

    if (nextActive) {
      await validarLimiteSucursales(id, connection);
    } else if (current.es_principal) {
      const activas = await contarSucursalesActivas(id, connection, { lock: true });
      if (activas <= 1) {
        throw serviceError(
          'No se puede desactivar la unica sucursal activa principal',
          409,
          'PRIMARY_BRANCH_REQUIRED'
        );
      }
      throw serviceError(
        'Asigne otra sucursal principal antes de desactivar esta sucursal',
        409,
        'PRIMARY_BRANCH_REQUIRED'
      );
    }
    await connection.query(
      'UPDATE sucursales SET activa = ? WHERE id = ? AND empresa_id = ?',
      [nextActive ? 1 : 0, branchId, id]
    );
    return { ...current, activa: nextActive ? 1 : 0 };
  });
}

module.exports = {
  contarSucursalesActivas,
  validarLimiteSucursales,
  obtenerSucursalPrincipal,
  asegurarSucursalPrincipal,
  listarSucursales,
  crearSucursal,
  editarSucursal,
  cambiarEstadoSucursal,
};
