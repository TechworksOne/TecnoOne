const db = require('../config/database');
const { randomUUID } = require('crypto');
const auditoriaService = require('../services/auditoriaService');

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? null;
}

function financialTenantClause(req, alias = null) {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { sql: ` AND ${prefix}empresa_id = ?`, params: [getTenantEmpresaId(req)] };
}

function resolveFinancialEmpresaId(options = {}) {
  const { req, empresaId } = options;

  if (empresaId !== undefined && empresaId !== null && empresaId !== '') {
    return empresaId;
  }

  if (req) {
    const reqEmpresaId = getTenantEmpresaId(req);
    if (reqEmpresaId !== null && reqEmpresaId !== undefined && reqEmpresaId !== '') {
      return reqEmpresaId;
    }
  }

  throw new Error('empresaId requerido');
}

// ========== CAJA CHICA ==========

/**
 * Scope financiero específico para Caja Chica.
 *
 * specific:
 *   empresa + sucursal activa.
 *
 * consolidated:
 *   empresa + sucursales permitidas.
 *   También incluye sucursal_id NULL exclusivamente para conservar
 *   visibilidad histórica de movimientos legacy no asignados.
 *
 * Los movimientos legacy NULL nunca se muestran dentro de una
 * sucursal específica.
 */
function cajaChicaScope(req, alias = null) {
  const scope = req.branchScope;
  const prefix = alias ? `${alias}.` : '';

  const empresaId = Number(scope?.empresaId);

  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    const error = new Error(
      'No se pudo determinar la empresa del contexto financiero'
    );
    error.statusCode = 400;
    error.code = 'EMPRESA_SCOPE_REQUERIDA';
    throw error;
  }

  if (
    scope?.mode === 'specific' &&
    Number.isInteger(Number(scope.sucursalId)) &&
    Number(scope.sucursalId) > 0
  ) {
    return {
      mode: 'specific',
      empresaId,
      sucursalId: Number(scope.sucursalId),
      sql:
        ` AND ${prefix}empresa_id = ?` +
        ` AND ${prefix}sucursal_id = ?`,
      params: [
        empresaId,
        Number(scope.sucursalId),
      ],
    };
  }

  if (scope?.mode === 'consolidated') {
    const sucursalIds = [
      ...new Set(
        (scope.allowedSucursalIds || [])
          .map(Number)
          .filter(
            id =>
              Number.isInteger(id) &&
              id > 0,
          )
      ),
    ];

    if (!sucursalIds.length) {
      return {
        mode: 'consolidated',
        empresaId,
        sucursalIds: [],
        sql: ' AND 1 = 0',
        params: [],
      };
    }

    const placeholders =
      sucursalIds.map(() => '?').join(', ');

    return {
      mode: 'consolidated',
      empresaId,
      sucursalIds,
      sql:
        ` AND ${prefix}empresa_id = ?` +
        ` AND (` +
        `${prefix}sucursal_id IN (${placeholders})` +
        ` OR ${prefix}sucursal_id IS NULL` +
        `)`,
      params: [
        empresaId,
        ...sucursalIds,
      ],
    };
  }

  const error = new Error(
    'Seleccione una sucursal o un contexto consolidado válido'
  );
  error.statusCode = 400;
  error.code = 'BRANCH_SCOPE_REQUERIDO';
  throw error;
}

function cajaChicaUsuario(req) {
  return String(
    req.user?.name ||
    req.user?.nombre ||
    req.user?.username ||
    req.user?.email ||
    req.user?.id ||
    'Usuario'
  );
}

function cajaChicaUsuarioId(req) {
  const usuarioId = Number(
    req.user?.id ??
    req.user?.userId ??
    req.user?.usuario_id
  );

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw cajaChicaHttpError(
      401,
      'USUARIO_REQUERIDO',
      'No se pudo determinar el usuario autenticado.'
    );
  }

  return usuarioId;
}

function cajaChicaMonto(value, { allowZero = false } = {}) {
  const monto = Number(value);
  const minimoValido = allowZero ? monto >= 0 : monto > 0;

  if (
    !Number.isFinite(monto) ||
    !minimoValido ||
    monto > 99999999.99
  ) {
    throw cajaChicaHttpError(
      400,
      'MONTO_INVALIDO',
      allowZero
        ? 'El monto debe ser mayor o igual a cero'
        : 'El monto debe ser mayor a cero'
    );
  }

  return Math.round(monto * 100) / 100;
}

async function registrarAuditoriaFinanciera(connection, payload) {
  const registrado = await auditoriaService.registrar({
    ...payload,
    connection,
    strict: true,
  });

  if (!registrado) {
    throw cajaChicaHttpError(
      500,
      'AUDITORIA_REQUERIDA',
      'No fue posible registrar la trazabilidad de la operación.'
    );
  }
}


function cajaChicaHttpError(
  statusCode,
  code,
  message
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

/**
 * Serializa las operaciones monetarias de Caja Chica por sucursal.
 *
 * La fila de sucursales funciona como mutex estable aunque todavía
 * no existan movimientos en caja_chica.
 */
async function bloquearCajaChicaYObtenerSaldo(
  connection,
  scope
) {
  if (
    scope?.mode !== 'specific' ||
    !Number.isInteger(Number(scope?.sucursalId))
  ) {
    throw cajaChicaHttpError(
      400,
      'BRANCH_SPECIFIC_REQUIRED',
      'Seleccione una sucursal específica para realizar esta operación.'
    );
  }

  const [[sucursal]] = await connection.query(
    `SELECT id
     FROM sucursales
     WHERE id = ?
       AND empresa_id = ?
       AND activa = TRUE
     LIMIT 1
     FOR UPDATE`,
    [
      scope.sucursalId,
      scope.empresaId,
    ]
  );

  if (!sucursal) {
    throw cajaChicaHttpError(
      409,
      'BRANCH_INACTIVE',
      'La sucursal seleccionada no está disponible.'
    );
  }

  const [[saldoRow]] = await connection.query(
    `SELECT COALESCE(
       SUM(
         CASE
           WHEN estado = 'CONFIRMADO'
            AND tipo_movimiento = 'INGRESO'
           THEN monto

           WHEN estado = 'CONFIRMADO'
            AND tipo_movimiento = 'EGRESO'
           THEN -monto

           ELSE 0
         END
       ),
       0
     ) AS saldo
     FROM caja_chica
     WHERE empresa_id = ?
       AND sucursal_id = ?`,
    [
      scope.empresaId,
      scope.sucursalId,
    ]
  );

  return Number(saldoRow?.saldo || 0);
}

// Obtener saldo actual de caja chica
exports.getSaldoCajaChica = async (req, res) => {
  try {
    const scope = cajaChicaScope(req);

    const [[totales]] = await db.query(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN tipo_movimiento = 'INGRESO'
              AND estado = 'CONFIRMADO'
             THEN monto
             ELSE 0
           END
         ), 0) AS ingresos,

         COALESCE(SUM(
           CASE
             WHEN tipo_movimiento = 'EGRESO'
              AND estado = 'CONFIRMADO'
             THEN monto
             ELSE 0
           END
         ), 0) AS egresos,

         COALESCE(SUM(
           CASE
             WHEN estado = 'PENDIENTE'
             THEN monto
             ELSE 0
           END
         ), 0) AS pendientes

       FROM caja_chica
       WHERE 1 = 1${scope.sql}`,
      scope.params
    );

    const ingresos =
      Number(totales?.ingresos || 0);

    const egresos =
      Number(totales?.egresos || 0);

    const pendientes =
      Number(totales?.pendientes || 0);

    return res.json({
      success: true,
      data: {
        saldo: ingresos - egresos,
        ingresos,
        egresos,
        pendientes,
      },
    });
  } catch (error) {
    console.error(
      'Error getting saldo caja chica:',
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        code: error.code,
        message: error.message,
      });
  }
};

// Obtener movimientos de caja chica
exports.getMovimientosCajaChica = async (
  req,
  res
) => {
  try {
    const {
      fecha_inicio,
      fecha_fin,
      tipo,
      estado,
    } = req.query;

    const scope =
      cajaChicaScope(req, 'cc');

    let query = `
      SELECT
        cc.*,
        u.name AS confirmado_por_nombre,
        s.nombre AS sucursal_nombre
      FROM caja_chica cc
      LEFT JOIN users u
        ON u.id = cc.confirmado_por
      LEFT JOIN sucursales s
        ON s.id = cc.sucursal_id
       AND s.empresa_id = cc.empresa_id
      WHERE 1 = 1`;

    const params = [
      ...scope.params,
    ];

    query += scope.sql;

    if (fecha_inicio) {
      query +=
        ' AND cc.fecha_movimiento >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      query +=
        ' AND cc.fecha_movimiento <= ?';
      params.push(fecha_fin);
    }

    if (tipo) {
      query +=
        ' AND cc.tipo_movimiento = ?';
      params.push(tipo);
    }

    if (estado) {
      query +=
        ' AND cc.estado = ?';
      params.push(estado);
    }

    query +=
      ' ORDER BY cc.fecha_movimiento DESC, cc.id DESC';

    const [movimientos] =
      await db.query(
        query,
        params
      );

    return res.json({
      success: true,
      data: movimientos,
    });
  } catch (error) {
    console.error(
      'Error getting movimientos caja chica:',
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        code: error.code,
        message: error.message,
      });
  }
};

// Historial inmutable de arqueos. ALL se permite exclusivamente en lectura.
exports.getArqueosCajaChica = async (req, res) => {
  try {
    const scope = cajaChicaScope(req, 'a');
    const {
      fecha_inicio,
      fecha_fin,
      resultado,
      usuario_id,
    } = req.query;

    const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(100, Math.max(1, Number.parseInt(req.query.limite, 10) || 25));
    const offset = (pagina - 1) * limite;
    const resultadosValidos = ['CUADRADO', 'SOBRANTE', 'FALTANTE'];

    let where = ` WHERE 1 = 1${scope.sql}`;
    const params = [...scope.params];

    if (fecha_inicio) {
      where += ' AND a.fecha_arqueo >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      where += ' AND a.fecha_arqueo <= ?';
      params.push(fecha_fin);
    }
    if (resultado) {
      const resultadoNormalizado = String(resultado).trim().toUpperCase();
      if (!resultadosValidos.includes(resultadoNormalizado)) {
        throw cajaChicaHttpError(400, 'RESULTADO_INVALIDO', 'Resultado de arqueo inválido');
      }
      where += ' AND a.resultado = ?';
      params.push(resultadoNormalizado);
    }
    if (usuario_id) {
      const usuarioId = Number(usuario_id);
      if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        throw cajaChicaHttpError(400, 'USUARIO_INVALIDO', 'usuario_id inválido');
      }
      where += ' AND a.usuario_id = ?';
      params.push(usuarioId);
    }

    const [[totalRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM caja_chica_arqueos a${where}`,
      params
    );
    const [arqueos] = await db.query(
      `SELECT a.*, s.nombre AS sucursal_nombre
       FROM caja_chica_arqueos a
       INNER JOIN sucursales s
         ON s.id = a.sucursal_id
        AND s.empresa_id = a.empresa_id
       ${where}
       ORDER BY a.fecha_arqueo DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );

    return res.json({
      success: true,
      data: arqueos,
      pagination: {
        pagina,
        limite,
        total: Number(totalRow?.total || 0),
      },
    });
  } catch (error) {
    console.error('Error obteniendo arqueos de Caja Chica:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
};

// El arqueo registra un snapshot; nunca altera dinero.
exports.registrarArqueoCajaChica = async (req, res) => {
  const conn = await db.getConnection();
  let transactionStarted = false;

  try {
    const scope = cajaChicaScope(req);
    if (scope.mode !== 'specific') {
      throw cajaChicaHttpError(400, 'BRANCH_SPECIFIC_REQUIRED', 'Seleccione una sucursal específica.');
    }

    const montoContado = cajaChicaMonto(req.body?.monto_contado, { allowZero: true });
    const observaciones = String(req.body?.observaciones || '').trim() || null;
    const usuarioId = cajaChicaUsuarioId(req);
    const usuarioNombre = cajaChicaUsuario(req).slice(0, 255);

    await conn.beginTransaction();
    transactionStarted = true;

    const saldoTeorico = await bloquearCajaChicaYObtenerSaldo(conn, scope);
    const saldoCentavos = Math.round(saldoTeorico * 100);
    const contadoCentavos = Math.round(montoContado * 100);
    const diferenciaCentavos = contadoCentavos - saldoCentavos;
    const diferencia = diferenciaCentavos / 100;
    const resultado = diferenciaCentavos === 0
      ? 'CUADRADO'
      : diferenciaCentavos > 0
        ? 'SOBRANTE'
        : 'FALTANTE';

    const [[ultimoMovimiento]] = await conn.query(
      `SELECT MAX(id) AS id
       FROM caja_chica
       WHERE empresa_id = ? AND sucursal_id = ?`,
      [scope.empresaId, scope.sucursalId]
    );

    const [insert] = await conn.query(
      `INSERT INTO caja_chica_arqueos (
         empresa_id, sucursal_id, saldo_teorico, monto_contado,
         diferencia, resultado, ultimo_movimiento_id, usuario_id,
         usuario_nombre, observaciones
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scope.empresaId,
        scope.sucursalId,
        saldoCentavos / 100,
        contadoCentavos / 100,
        diferencia,
        resultado,
        ultimoMovimiento?.id || null,
        usuarioId,
        usuarioNombre,
        observaciones,
      ]
    );

    await registrarAuditoriaFinanciera(conn, {
      req,
      empresaId: scope.empresaId,
      scope: 'branch',
      accion: 'CAJA_CHICA_ARQUEO_REGISTRADO',
      entidad: 'caja_chica_arqueos',
      entidadId: insert.insertId,
      descripcion: `Arqueo de Caja Chica ${resultado}`,
      datosNuevos: {
        sucursal_id: scope.sucursalId,
        saldo_teorico: saldoCentavos / 100,
        monto_contado: contadoCentavos / 100,
        diferencia,
        resultado,
      },
    });

    await conn.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: 'Arqueo registrado sin alterar el saldo de Caja Chica',
      data: {
        id: insert.insertId,
        empresa_id: scope.empresaId,
        sucursal_id: scope.sucursalId,
        saldo_teorico: saldoCentavos / 100,
        monto_contado: contadoCentavos / 100,
        diferencia,
        resultado,
        ultimo_movimiento_id: ultimoMovimiento?.id || null,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      try { await conn.rollback(); } catch {}
    }
    console.error('Error registrando arqueo de Caja Chica:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  } finally {
    conn.release();
  }
};

exports.reponerCajaChicaManual = async (req, res) => {
  const conn = await db.getConnection();
  let transactionStarted = false;

  try {
    const scope = cajaChicaScope(req);
    if (scope.mode !== 'specific') {
      throw cajaChicaHttpError(400, 'BRANCH_SPECIFIC_REQUIRED', 'Seleccione una sucursal específica.');
    }

    const monto = cajaChicaMonto(req.body?.monto);
    const concepto = String(req.body?.concepto || '').trim();
    const observaciones = String(req.body?.observaciones || '').trim();
    if (concepto.length < 5) {
      throw cajaChicaHttpError(400, 'CONCEPTO_INSUFICIENTE', 'El concepto debe contener al menos 5 caracteres');
    }
    if (observaciones.length < 10) {
      throw cajaChicaHttpError(400, 'OBSERVACIONES_INSUFICIENTES', 'La observación debe justificar la reposición manual');
    }

    const usuarioId = cajaChicaUsuarioId(req);
    const usuarioNombre = cajaChicaUsuario(req);
    const operacionId = randomUUID();

    await conn.beginTransaction();
    transactionStarted = true;
    const saldoAnterior = await bloquearCajaChicaYObtenerSaldo(conn, scope);

    const [insert] = await conn.query(
      `INSERT INTO caja_chica (
         empresa_id, sucursal_id, tipo_movimiento, monto, concepto,
         categoria, estado, realizado_por, observaciones,
         confirmado_por, confirmado_en, referencia_tipo, referencia_id
       ) VALUES (?, ?, 'INGRESO', ?, ?, 'Reposición Manual', 'CONFIRMADO', ?, ?, ?, NOW(), 'REPOSICION_MANUAL', ?)`,
      [
        scope.empresaId,
        scope.sucursalId,
        monto,
        concepto,
        usuarioNombre,
        observaciones,
        usuarioId,
        operacionId,
      ]
    );

    await registrarAuditoriaFinanciera(conn, {
      req,
      empresaId: scope.empresaId,
      scope: 'branch',
      accion: 'CAJA_CHICA_REPOSICION_MANUAL',
      entidad: 'caja_chica',
      entidadId: insert.insertId,
      descripcion: `Reposición manual de Caja Chica por Q${monto.toFixed(2)}`,
      datosNuevos: {
        sucursal_id: scope.sucursalId,
        monto,
        concepto,
        referencia_id: operacionId,
      },
    });

    await conn.commit();
    transactionStarted = false;
    return res.status(201).json({
      success: true,
      message: 'Reposición manual registrada',
      data: {
        id: insert.insertId,
        referencia_id: operacionId,
        saldo_anterior: saldoAnterior,
        saldo_actual: Math.round((saldoAnterior + monto) * 100) / 100,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      try { await conn.rollback(); } catch {}
    }
    console.error('Error en reposición manual de Caja Chica:', error);
    return res.status(error.statusCode || 500).json({ success: false, code: error.code, message: error.message });
  } finally {
    conn.release();
  }
};

exports.reponerCajaChicaDesdeBanco = async (req, res) => {
  const conn = await db.getConnection();
  let transactionStarted = false;

  try {
    const scope = cajaChicaScope(req);
    if (scope.mode !== 'specific') {
      throw cajaChicaHttpError(400, 'BRANCH_SPECIFIC_REQUIRED', 'Seleccione una sucursal específica.');
    }

    const cuentaId = Number(req.body?.cuenta_id);
    const monto = cajaChicaMonto(req.body?.monto);
    const concepto = String(req.body?.concepto || '').trim();
    const observaciones = String(req.body?.observaciones || '').trim() || null;
    if (!Number.isInteger(cuentaId) || cuentaId <= 0) {
      throw cajaChicaHttpError(400, 'CUENTA_BANCARIA_INVALIDA', 'cuenta_id es requerido');
    }
    if (concepto.length < 5) {
      throw cajaChicaHttpError(400, 'CONCEPTO_INSUFICIENTE', 'El concepto debe contener al menos 5 caracteres');
    }

    const usuarioId = cajaChicaUsuarioId(req);
    const usuarioNombre = cajaChicaUsuario(req);
    const operacionId = randomUUID();

    await conn.beginTransaction();
    transactionStarted = true;

    const saldoCajaAnterior = await bloquearCajaChicaYObtenerSaldo(conn, scope);
    const [[cuenta]] = await conn.query(
      `SELECT id, nombre, saldo_actual
       FROM cuentas_bancarias
       WHERE id = ? AND empresa_id = ? AND activa = TRUE
       LIMIT 1 FOR UPDATE`,
      [cuentaId, scope.empresaId]
    );
    if (!cuenta) {
      throw cajaChicaHttpError(404, 'CUENTA_BANCARIA_NO_ENCONTRADA', 'Cuenta bancaria no encontrada o inactiva');
    }
    if (Math.round(Number(cuenta.saldo_actual) * 100) < Math.round(monto * 100)) {
      throw cajaChicaHttpError(
        409,
        'BANCO_SALDO_INSUFICIENTE',
        `Saldo bancario insuficiente. Disponible: Q${Number(cuenta.saldo_actual).toFixed(2)}`
      );
    }

    const [movimientoBanco] = await conn.query(
      `INSERT INTO movimientos_bancarios (
         empresa_id, cuenta_id, tipo_movimiento, monto, concepto,
         categoria, estado, realizado_por, observaciones,
         confirmado_por, confirmado_en, referencia_tipo, referencia_id
       ) VALUES (?, ?, 'EGRESO', ?, ?, 'Reposición Caja Chica', 'CONFIRMADO', ?, ?, ?, NOW(), 'REPOSICION_CAJA_CHICA', ?)`,
      [scope.empresaId, cuentaId, monto, concepto, usuarioNombre, observaciones, usuarioId, operacionId]
    );

    const [actualizacion] = await conn.query(
      `UPDATE cuentas_bancarias
       SET saldo_actual = saldo_actual - ?
       WHERE id = ? AND empresa_id = ? AND activa = TRUE AND saldo_actual >= ?`,
      [monto, cuentaId, scope.empresaId, monto]
    );
    if (actualizacion.affectedRows !== 1) {
      throw cajaChicaHttpError(409, 'BANCO_SALDO_INSUFICIENTE', 'Saldo bancario insuficiente');
    }

    const [movimientoCaja] = await conn.query(
      `INSERT INTO caja_chica (
         empresa_id, sucursal_id, tipo_movimiento, monto, concepto,
         categoria, estado, realizado_por, observaciones,
         confirmado_por, confirmado_en, referencia_tipo, referencia_id
       ) VALUES (?, ?, 'INGRESO', ?, ?, 'Reposición desde Banco', 'CONFIRMADO', ?, ?, ?, NOW(), 'REPOSICION_BANCO', ?)`,
      [
        scope.empresaId,
        scope.sucursalId,
        monto,
        `Reposición desde ${cuenta.nombre} - ${concepto}`,
        usuarioNombre,
        observaciones,
        usuarioId,
        operacionId,
      ]
    );

    await registrarAuditoriaFinanciera(conn, {
      req,
      empresaId: scope.empresaId,
      scope: 'branch',
      accion: 'CAJA_CHICA_REPOSICION_BANCO',
      entidad: 'caja_chica',
      entidadId: movimientoCaja.insertId,
      descripcion: `Reposición bancaria de Caja Chica por Q${monto.toFixed(2)}`,
      datosNuevos: {
        sucursal_id: scope.sucursalId,
        cuenta_id: cuentaId,
        movimiento_bancario_id: movimientoBanco.insertId,
        movimiento_caja_chica_id: movimientoCaja.insertId,
        monto,
        referencia_id: operacionId,
      },
    });

    await conn.commit();
    transactionStarted = false;
    return res.status(201).json({
      success: true,
      message: 'Reposición desde banco registrada',
      data: {
        referencia_id: operacionId,
        movimiento_bancario_id: movimientoBanco.insertId,
        movimiento_caja_chica_id: movimientoCaja.insertId,
        saldo_caja_anterior: saldoCajaAnterior,
        saldo_caja_actual: Math.round((saldoCajaAnterior + monto) * 100) / 100,
        saldo_banco_actual: Math.round((Number(cuenta.saldo_actual) - monto) * 100) / 100,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      try { await conn.rollback(); } catch {}
    }
    console.error('Error en reposición bancaria de Caja Chica:', error);
    return res.status(error.statusCode || 500).json({ success: false, code: error.code, message: error.message });
  } finally {
    conn.release();
  }
};

// Registrar movimiento manual de Caja Chica.
// Empresa, sucursal y usuario provienen exclusivamente del backend.
exports.registrarMovimientoCajaChica = async (
  req,
  res
) => {
  const conn = await db.getConnection();
  let transactionStarted = false;

  try {
    const scope = cajaChicaScope(req);

    if (scope.mode !== 'specific') {
      throw cajaChicaHttpError(
        400,
        'BRANCH_SPECIFIC_REQUIRED',
        'Seleccione una sucursal específica para realizar esta operación.'
      );
    }

    const {
      tipo_movimiento,
      monto,
      concepto,
      categoria,
      observaciones,
    } = req.body;

    const tipo = String(
      tipo_movimiento || ''
    )
      .trim()
      .toUpperCase();

    const montoNum = Number(monto);
    const conceptoLimpio = String(
      concepto || ''
    ).trim();

    if (
      !['INGRESO', 'EGRESO'].includes(tipo)
    ) {
      throw cajaChicaHttpError(
        400,
        'TIPO_MOVIMIENTO_INVALIDO',
        'tipo_movimiento debe ser INGRESO o EGRESO'
      );
    }

    if (
      !Number.isFinite(montoNum) ||
      montoNum <= 0
    ) {
      throw cajaChicaHttpError(
        400,
        'MONTO_INVALIDO',
        'El monto debe ser mayor a cero'
      );
    }

    if (!conceptoLimpio) {
      throw cajaChicaHttpError(
        400,
        'CONCEPTO_REQUERIDO',
        'El concepto es requerido'
      );
    }

    const usuario = cajaChicaUsuario(req);

    await conn.beginTransaction();
    transactionStarted = true;

    const saldo =
      await bloquearCajaChicaYObtenerSaldo(
        conn,
        scope
      );

    if (
      tipo === 'EGRESO' &&
      montoNum > saldo
    ) {
      throw cajaChicaHttpError(
        409,
        'CAJA_CHICA_SALDO_INSUFICIENTE',
        `Saldo insuficiente en Caja Chica. Disponible: Q${saldo.toFixed(2)}`
      );
    }

    const [result] = await conn.query(
      `INSERT INTO caja_chica (
         empresa_id,
         sucursal_id,
         tipo_movimiento,
         monto,
         concepto,
         categoria,
         estado,
         realizado_por,
         observaciones
       )
       VALUES (
         ?,
         ?,
         ?,
         ?,
         ?,
         ?,
         'CONFIRMADO',
         ?,
         ?
       )`,
      [
        scope.empresaId,
        scope.sucursalId,
        tipo,
        montoNum,
        conceptoLimpio,
        categoria || 'Otro',
        usuario,
        observaciones || null,
      ]
    );

    await conn.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message:
        tipo === 'INGRESO'
          ? 'Fondo repuesto exitosamente'
          : 'Movimiento registrado exitosamente',
      data: {
        id: result.insertId,
        empresa_id: scope.empresaId,
        sucursal_id: scope.sucursalId,
        saldo_anterior: saldo,
        saldo_actual:
          tipo === 'INGRESO'
            ? saldo + montoNum
            : saldo - montoNum,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch {}
    }

    console.error(
      'Error registrando movimiento Caja Chica:',
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        code: error.code,
        message: error.message,
      });
  } finally {
    conn.release();
  }
};

// ========== CUENTAS BANCARIAS ==========

// Obtener todas las cuentas bancarias
exports.getCuentasBancarias = async (req, res) => {
  try {
    const tenant = financialTenantClause(req);
    const [cuentas] = await db.query(
      `SELECT * FROM cuentas_bancarias WHERE activa = TRUE${tenant.sql} ORDER BY nombre`,
      tenant.params
    );
    const canViewBalances =
      req.user?.role === 'superadmin' ||
      req.user?.permissions?.includes('*') ||
      req.user?.permissions?.includes('bancos.administrar');
    const data = canViewBalances
      ? cuentas
      : cuentas.map(({ id, nombre, tipo_cuenta, pos_asociado, activa }) => ({ id, nombre, tipo_cuenta, pos_asociado, activa }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting cuentas bancarias:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener saldo de una cuenta bancaria
exports.getSaldoCuentaBancaria = async (req, res) => {
  try {
    const { id } = req.params;
    const cuentaTenant = financialTenantClause(req);
    
    const [cuenta] = await db.query(
      `SELECT * FROM cuentas_bancarias WHERE id = ?${cuentaTenant.sql}`,
      [id, ...cuentaTenant.params]
    );
    
    if (cuenta.length === 0) {
      return res.status(404).json({ success: false, message: 'Cuenta no encontrada' });
    }
    
    const movTenant = financialTenantClause(req);
    const [ingresos] = await db.query(
      `SELECT COALESCE(SUM(monto), 0) as total FROM movimientos_bancarios WHERE cuenta_id = ? AND tipo_movimiento = 'INGRESO' AND estado = 'CONFIRMADO'${movTenant.sql}`,
      [id, ...movTenant.params]
    );
    const [egresos] = await db.query(
      `SELECT COALESCE(SUM(monto), 0) as total FROM movimientos_bancarios WHERE cuenta_id = ? AND tipo_movimiento = 'EGRESO' AND estado = 'CONFIRMADO'${movTenant.sql}`,
      [id, ...movTenant.params]
    );
    
    const saldo = ingresos[0].total - egresos[0].total;
    
    // Actualizar saldo en la tabla
    await db.query(
      `UPDATE cuentas_bancarias SET saldo_actual = ? WHERE id = ?${cuentaTenant.sql}`,
      [saldo, id, ...cuentaTenant.params]
    );
    
    res.json({
      success: true,
      data: {
        ...cuenta[0],
        saldo,
        ingresos: ingresos[0].total,
        egresos: egresos[0].total
      }
    });
  } catch (error) {
    console.error('Error getting saldo cuenta bancaria:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener movimientos de una cuenta bancaria específica (historial)
exports.getMovimientosPorCuenta = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = financialTenantClause(req, 'mb');
    const cuentaTenant = financialTenantClause(req);
    console.log('[HistorialCuenta] cuenta_id:', id);

    const [cuentas] = await db.query(
      `SELECT id FROM cuentas_bancarias WHERE id = ?${cuentaTenant.sql}`,
      [id, ...cuentaTenant.params]
    );

    if (cuentas.length === 0) {
      return res.status(404).json({ success: false, message: 'Cuenta no encontrada' });
    }

    const [rows] = await db.query(
      `SELECT
         mb.id,
         mb.cuenta_id,
         cb.nombre        AS cuenta_nombre,
         cb.numero_cuenta,
         cb.tipo_cuenta,
         mb.tipo_movimiento,
         mb.monto,
         mb.concepto,
         mb.categoria,
         mb.estado,
         mb.venta_id,
         mb.numero_referencia,
         mb.realizado_por,
         mb.observaciones,
         mb.referencia_tipo,
         mb.referencia_id,
         mb.fecha_movimiento
       FROM movimientos_bancarios mb
       LEFT JOIN cuentas_bancarias cb ON cb.id = mb.cuenta_id AND cb.empresa_id = mb.empresa_id
       WHERE mb.cuenta_id = ?${tenant.sql}
       ORDER BY mb.fecha_movimiento DESC, mb.id DESC`,
      [id, ...tenant.params]
    );

    console.log('[HistorialCuenta] movimientos encontrados:', rows.length);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[HistorialCuenta] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Obtener movimientos bancarios
exports.getMovimientosBancarios = async (req, res) => {
  try {
    const { cuenta_id, fecha_inicio, fecha_fin, tipo } = req.query;
    const tenant = financialTenantClause(req, 'mb');
    const cuentaTenant = financialTenantClause(req);
    
    let query = `
      SELECT mb.*, cb.nombre AS cuenta_nombre, u.name AS confirmado_por_nombre
      FROM movimientos_bancarios mb
      JOIN cuentas_bancarias cb ON mb.cuenta_id = cb.id AND cb.empresa_id = mb.empresa_id
      LEFT JOIN users u ON u.id = mb.confirmado_por
      WHERE 1=1
    `;
    const params = [...tenant.params];
    query += tenant.sql;
    
    if (cuenta_id) {
      const [cuentas] = await db.query(
        `SELECT id FROM cuentas_bancarias WHERE id = ?${cuentaTenant.sql}`,
        [cuenta_id, ...cuentaTenant.params]
      );

      if (cuentas.length === 0) {
        return res.status(404).json({ success: false, message: 'Cuenta no encontrada' });
      }

      query += ' AND mb.cuenta_id = ?';
      params.push(cuenta_id);
    }
    if (fecha_inicio) {
      query += ' AND mb.fecha_movimiento >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      query += ' AND mb.fecha_movimiento <= ?';
      params.push(fecha_fin);
    }
    if (tipo) {
      query += ' AND mb.tipo_movimiento = ?';
      params.push(tipo);
    }
    
    query += ' ORDER BY mb.fecha_movimiento DESC';
    
    const [movimientos] = await db.query(query, params);
    
    res.json({ success: true, data: movimientos });
  } catch (error) {
    console.error('Error getting movimientos bancarios:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Registrar movimiento bancario (manual)
exports.registrarMovimientoBancario = async (req, res) => {
  try {
    const {
      cuenta_id,
      tipo_movimiento,
      monto,
      concepto,
      categoria,
      numero_referencia,
      observaciones,
      realizado_por
    } = req.body;
    const empresaId = getTenantEmpresaId(req);

    const [cuentas] = await db.query(
      'SELECT id FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE LIMIT 1',
      [cuenta_id, empresaId]
    );

    if (cuentas.length === 0) {
      return res.status(404).json({ success: false, message: 'Cuenta bancaria no encontrada o inactiva' });
    }
    
    const [result] = await db.query(
      `INSERT INTO movimientos_bancarios 
       (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, numero_referencia, realizado_por, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMADO', ?, ?, ?)`,
      [empresaId, cuenta_id, tipo_movimiento, monto, concepto, categoria || 'Otro', numero_referencia, realizado_por, observaciones]
    );
    
    // Actualizar saldo de la cuenta (movimientos manuales se confirman automáticamente)
    const operacion = tipo_movimiento === 'INGRESO' ? '+' : '-';
    await db.query(
      `UPDATE cuentas_bancarias SET saldo_actual = saldo_actual ${operacion} ? WHERE id = ? AND empresa_id = ?`,
      [monto, cuenta_id, empresaId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Movimiento bancario registrado exitosamente',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error registrando movimiento bancario:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== CONFIRMACIÓN DE MOVIMIENTOS ==========

// Confirmar movimiento de caja chica
exports.confirmarMovimientoCajaChica = async (
  req,
  res
) => {
  const conn = await db.getConnection();
  let transactionStarted = false;

  try {
    const { id } = req.params;
    const scope = cajaChicaScope(req);

    if (scope.mode !== 'specific') {
      throw cajaChicaHttpError(
        400,
        'BRANCH_SPECIFIC_REQUIRED',
        'Seleccione una sucursal específica para realizar esta operación.'
      );
    }

    await conn.beginTransaction();
    transactionStarted = true;

    const saldo =
      await bloquearCajaChicaYObtenerSaldo(
        conn,
        scope
      );

    const [[mov]] = await conn.query(
      `SELECT *
       FROM caja_chica
       WHERE id = ?
         AND empresa_id = ?
         AND sucursal_id = ?
       LIMIT 1
       FOR UPDATE`,
      [
        id,
        scope.empresaId,
        scope.sucursalId,
      ]
    );

    if (!mov) {
      throw cajaChicaHttpError(
        404,
        'CAJA_CHICA_MOVIMIENTO_NO_ENCONTRADO',
        'Movimiento no encontrado en la sucursal activa'
      );
    }

    if (mov.estado === 'CONFIRMADO') {
      throw cajaChicaHttpError(
        409,
        'CAJA_CHICA_YA_CONFIRMADO',
        'Este movimiento ya está confirmado'
      );
    }

    if (mov.estado === 'ANULADO') {
      throw cajaChicaHttpError(
        409,
        'CAJA_CHICA_MOVIMIENTO_ANULADO',
        'Este movimiento ha sido anulado y no puede confirmarse'
      );
    }

    if (
      mov.tipo_movimiento === 'EGRESO' &&
      Number(mov.monto) > saldo
    ) {
      throw cajaChicaHttpError(
        409,
        'CAJA_CHICA_SALDO_INSUFICIENTE',
        `Saldo insuficiente en Caja Chica. Disponible: Q${saldo.toFixed(2)}`
      );
    }

    if (
      String(mov.referencia_tipo || '')
        .toUpperCase() === 'REPARACION' &&
      mov.referencia_id
    ) {
      const [[rep]] = await conn.query(
        `SELECT estado
         FROM reparaciones
         WHERE id = ?
           AND empresa_id = ?
           AND sucursal_id = ?`,
        [
          mov.referencia_id,
          scope.empresaId,
          scope.sucursalId,
        ]
      );

      if (
        rep &&
        rep.estado === 'CANCELADA'
      ) {
        throw cajaChicaHttpError(
          409,
          'REPARACION_CANCELADA',
          'No se puede confirmar este movimiento porque la reparación asociada está cancelada'
        );
      }
    }

    const confirmadoPor =
      req.user?.id ??
      req.user?.userId ??
      req.user?.usuario_id ??
      null;

    await conn.query(
      `UPDATE caja_chica
       SET estado = 'CONFIRMADO',
           confirmado_en = NOW(),
           confirmado_por = ?
       WHERE id = ?
         AND empresa_id = ?
         AND sucursal_id = ?`,
      [
        confirmadoPor,
        id,
        scope.empresaId,
        scope.sucursalId,
      ]
    );

    await conn.commit();
    transactionStarted = false;

    return res.json({
      success: true,
      message:
        'Movimiento confirmado exitosamente',
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch {}
    }

    console.error(
      'Error confirmando movimiento Caja Chica:',
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        code: error.code,
        message: error.message,
      });
  } finally {
    conn.release();
  }
};

// Confirmar movimiento bancario
exports.confirmarMovimientoBancario = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = financialTenantClause(req);
    
    // Obtener detalles del movimiento
    const [movimiento] = await db.query(
      `SELECT * FROM movimientos_bancarios WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );
    
    if (movimiento.length === 0) {
      return res.status(404).json({ success: false, message: 'Movimiento no encontrado' });
    }
    
    const mov = movimiento[0];

    // No se puede confirmar un movimiento ya confirmado
    if (mov.estado === 'CONFIRMADO') {
      return res.status(409).json({
        success: false,
        message: 'Este movimiento ya está confirmado'
      });
    }

    // No se puede confirmar un movimiento anulado
    if (mov.estado === 'ANULADO') {
      return res.status(409).json({
        success: false,
        message: 'Este movimiento ha sido anulado y no puede confirmarse'
      });
    }

    // No se puede confirmar un anticipo de una reparación cancelada
    if (mov.referencia_tipo === 'REPARACION' && mov.referencia_id) {
      const [[rep]] = await db.query(
        'SELECT estado FROM reparaciones WHERE id = ? AND empresa_id = ?',
        [mov.referencia_id, mov.empresa_id]
      );
      if (rep && rep.estado === 'CANCELADA') {
        return res.status(409).json({
          success: false,
          message: 'No se puede confirmar este movimiento porque la reparación asociada está cancelada'
        });
      }
    }

    // Actualizar estado a CONFIRMADO con trazabilidad
    await db.query(
      `UPDATE movimientos_bancarios SET estado = 'CONFIRMADO', confirmado_en = NOW(), confirmado_por = ? WHERE id = ?${tenant.sql}`,
      [
        req.user?.id ?? req.user?.userId ?? req.user?.usuario_id ?? null,
        id,
        ...tenant.params
      ]
    );
    
    // Actualizar saldo de la cuenta bancaria
    const operacion = mov.tipo_movimiento === 'INGRESO' ? '+' : '-';
    await db.query(
      `UPDATE cuentas_bancarias SET saldo_actual = saldo_actual ${operacion} ? WHERE id = ?${tenant.sql}`,
      [mov.monto, mov.cuenta_id, ...tenant.params]
    );
    
    res.json({ 
      success: true, 
      message: 'Movimiento confirmado y saldo actualizado' 
    });
  } catch (error) {
    console.error('Error confirmando movimiento bancario:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== FUNCIÓN AUTOMÁTICA PARA VENTAS ==========
// Esta función se llamará desde el controlador de ventas
exports.registrarMovimientoVenta = async (
  ventaId,
  metodoPago,
  monto,
  usuarioNombre,
  connection = null,
  posSeleccionado = null,
  bancoId = null,
  referencia = null,
  empresaId = null
) => {
  const dbConn = connection || db;

  try {
    const empresaIdFinanciera = resolveFinancialEmpresaId({ empresaId });
    const metodo = String(metodoPago || '').toUpperCase();
    const montoQuetzales = Number(monto || 0) / 100;

    // Resolver venta_id numérico y referencia legible (numero_venta) en un solo paso.
    let ventaIdNumerico = Number.isInteger(Number(ventaId)) ? Number(ventaId) : null;
    let referenciaVenta = String(ventaId || '').trim();

    try {
      if (ventaIdNumerico !== null) {
        // Llegó como ID numérico: buscar numero_venta para usar en el concepto legible.
        const [filas] = await dbConn.query(
          'SELECT numero_venta FROM ventas WHERE id = ? AND empresa_id = ? LIMIT 1',
          [ventaIdNumerico, empresaIdFinanciera]
        );
        if (filas.length > 0 && filas[0].numero_venta) {
          referenciaVenta = filas[0].numero_venta;
        }
      } else if (referenciaVenta) {
        // Llegó como correlativo (p.ej. "V-2026-0008"): buscar id y numero_venta.
        const [filas] = await dbConn.query(
          'SELECT id, numero_venta FROM ventas WHERE numero_venta = ? AND empresa_id = ? LIMIT 1',
          [referenciaVenta, empresaIdFinanciera]
        );
        if (filas.length > 0) {
          ventaIdNumerico = filas[0].id;
          referenciaVenta = filas[0].numero_venta || referenciaVenta;
          console.log(`🔍 venta_id resuelto: "${ventaId}" → ${ventaIdNumerico}`);
        } else {
          console.warn(`⚠️ venta_id no resuelto: no se encontró venta con numero_venta="${ventaId}".`);
        }
      }
    } catch (lookupErr) {
      console.warn(`⚠️ Error al resolver venta_id numérico desde "${ventaId}":`, lookupErr.message);
    }

    if (ventaIdNumerico === null) {
      console.warn(`⚠️ venta_id queda sin relación numérica. Concepto será: "Venta ${referenciaVenta || ventaId || 'SIN_REFERENCIA'}".`);
    }

    const concepto = `Venta ${referenciaVenta || ventaId || 'SIN_REFERENCIA'}`;

    const buscarPrimeraCuentaActiva = async () => {
      const [cuentas] = await dbConn.query(
        'SELECT id, nombre FROM cuentas_bancarias WHERE empresa_id = ? AND activa = TRUE ORDER BY id LIMIT 1',
        [empresaIdFinanciera]
      );

      return cuentas.length > 0 ? cuentas[0] : null;
    };

    const buscarCuentaPorPOS = async (tipoPOS) => {
      let patrones = [];

      if (tipoPOS === 'BAC') {
        patrones = ['%BAC%'];
      } else if (tipoPOS === 'NEONET') {
        patrones = ['%NEONET%', '%Neonet%', '%Industrial%'];
      }

      if (patrones.length === 0) {
        return null;
      }

      try {
        const condiciones = patrones
          .map(() => '(nombre LIKE ? OR pos_asociado LIKE ?)')
          .join(' OR ');

        const params = patrones.flatMap((patron) => [patron, patron]);

        const [cuentas] = await dbConn.query(
          `SELECT id, nombre 
           FROM cuentas_bancarias 
           WHERE (${condiciones}) 
           AND empresa_id = ?
           AND activa = TRUE 
           ORDER BY id 
           LIMIT 1`,
          [...params, empresaIdFinanciera]
        );

        return cuentas.length > 0 ? cuentas[0] : null;
      } catch (error) {
        /*
          Fallback por si la tabla cuentas_bancarias todavía no tiene
          la columna pos_asociado.
        */
        if (
          error.code === 'ER_BAD_FIELD_ERROR' ||
          String(error.message || '').includes('pos_asociado')
        ) {
          const condiciones = patrones
            .map(() => 'nombre LIKE ?')
            .join(' OR ');

          const [cuentas] = await dbConn.query(
            `SELECT id, nombre 
             FROM cuentas_bancarias 
             WHERE (${condiciones}) 
             AND empresa_id = ?
             AND activa = TRUE 
             ORDER BY id 
             LIMIT 1`,
            [...patrones, empresaIdFinanciera]
          );

          return cuentas.length > 0 ? cuentas[0] : null;
        }

        throw error;
      }
    };

    const registrarMovimientoBanco = async (cuenta, categoria = 'POS') => {
      if (!cuenta || !cuenta.id) {
        return false;
      }

      // Anti-duplicado: verificar si ya existe un movimiento activo para esta venta/cuenta/categoría
      if (ventaIdNumerico !== null) {
        const [dup] = await dbConn.query(
          `SELECT id FROM movimientos_bancarios WHERE empresa_id = ? AND venta_id = ? AND cuenta_id = ? AND tipo_movimiento = 'INGRESO' AND categoria = ? AND estado IN ('PENDIENTE', 'CONFIRMADO') LIMIT 1`,
          [empresaIdFinanciera, ventaIdNumerico, cuenta.id, categoria]
        );
        if (dup.length > 0) {
          console.warn(`⚠️ Movimiento duplicado detectado en movimientos_bancarios para venta_id=${ventaIdNumerico}, cuenta_id=${cuenta.id}, categoria=${categoria}. Se omite inserción.`);
          return false;
        }
      }

      await dbConn.query(
        `INSERT INTO movimientos_bancarios 
        (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, venta_id, categoria, estado, numero_referencia, realizado_por)
        VALUES (?, ?, 'INGRESO', ?, ?, ?, ?, 'PENDIENTE', ?, ?)`,
        [
          empresaIdFinanciera,
          cuenta.id,
          montoQuetzales,
          concepto,
          ventaIdNumerico,
          categoria,
          referencia,
          usuarioNombre,
        ]
      );

      console.log(
        `✅ Movimiento PENDIENTE registrado en BANCO (${cuenta.nombre || 'Cuenta bancaria'} id=${cuenta.id}): Q${montoQuetzales} - Venta ${referenciaVenta || ventaId}`
      );

      return true;
    };

    if (metodo === 'EFECTIVO') {
      /*
       * El efectivo de ventas pertenece exclusivamente al ledger
       * de Caja Operativa (saleInventoryService).
       *
       * Este helper legacy conserva únicamente integraciones bancarias.
       */
      return {
        success: true,
        skipped: true,
        reason:
          'EFECTIVO_GESTIONADO_POR_CAJA_OPERATIVA',
      };
    } else if (metodo === 'TARJETA') {
      /*
        Compatibilidad con ventas antiguas que todavía usan metodo_pago = TARJETA
        y dependen de posSeleccionado.
      */
      let cuenta = null;

      const pos = String(posSeleccionado || '').toUpperCase();

      if (pos.includes('BAC')) {
        cuenta = await buscarCuentaPorPOS('BAC');

        if (!cuenta) {
          console.warn('⚠️ No se encontró cuenta BAC, usando primera cuenta activa');
          cuenta = await buscarPrimeraCuentaActiva();
        }
      } else if (pos.includes('NEONET') || pos.includes('INDUSTRIAL')) {
        cuenta = await buscarCuentaPorPOS('NEONET');

        if (!cuenta) {
          console.warn('⚠️ No se encontró cuenta Neonet/Industrial, usando primera cuenta activa');
          cuenta = await buscarPrimeraCuentaActiva();
        }
      } else {
        console.warn('⚠️ POS no especificado para TARJETA, usando primera cuenta activa');
        cuenta = await buscarPrimeraCuentaActiva();
      }

      if (!(await registrarMovimientoBanco(cuenta, 'POS'))) {
        console.error('❌ No se encontró ninguna cuenta bancaria activa para TARJETA');
      }
    } else if (metodo === 'TARJETA_BAC') {
      let cuenta = await buscarCuentaPorPOS('BAC');

      if (!cuenta) {
        console.warn('⚠️ No se encontró cuenta BAC, usando primera cuenta activa');
        cuenta = await buscarPrimeraCuentaActiva();
      }

      if (!(await registrarMovimientoBanco(cuenta, 'POS'))) {
        console.error('❌ No se encontró ninguna cuenta bancaria activa para TARJETA_BAC');
      }
    } else if (metodo === 'TARJETA_NEONET') {
      let cuenta = await buscarCuentaPorPOS('NEONET');

      if (!cuenta) {
        console.warn('⚠️ No se encontró cuenta Neonet/Industrial, usando primera cuenta activa');
        cuenta = await buscarPrimeraCuentaActiva();
      }

      if (!(await registrarMovimientoBanco(cuenta, 'POS'))) {
        console.error('❌ No se encontró ninguna cuenta bancaria activa para TARJETA_NEONET');
      }
    } else if (metodo === 'TARJETA_OTRA') {
      const cuenta = await buscarPrimeraCuentaActiva();

      if (!(await registrarMovimientoBanco(cuenta, 'POS'))) {
        console.error('❌ No se encontró ninguna cuenta bancaria activa para TARJETA_OTRA');
      }
    } else if (
      metodo === 'TRANSFERENCIA' ||
      metodo === 'DEPOSITO' ||
      metodo === 'DEPÓSITO'
    ) {
      let cuenta = null;

      if (bancoId) {
        const [cuentas] = await dbConn.query(
          'SELECT id, nombre FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE LIMIT 1',
          [bancoId, empresaIdFinanciera]
        );

        cuenta = cuentas.length > 0 ? cuentas[0] : null;
      }

      if (!cuenta) {
        console.warn('⚠️ No se encontró banco seleccionado, usando primera cuenta activa');
        cuenta = await buscarPrimeraCuentaActiva();
      }

      const categoria = metodo === 'TRANSFERENCIA' ? 'Transferencia' : 'Deposito';

      if (!(await registrarMovimientoBanco(cuenta, categoria))) {
        console.error(`❌ No se encontró ninguna cuenta bancaria activa para ${metodo}`);
      }
    } else if (metodo === 'MIXTO') {
      console.warn(
        `⚠️ Venta ${ventaId} registrada como MIXTO. El registro automático de caja/banco debe manejarse desde el detalle de pagos mixtos.`
      );
    } else {
      console.warn(
        `⚠️ Método de pago no reconocido para movimiento automático: ${metodoPago}`
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Error registrando movimiento de venta:', error);
    throw error;
  }
};

// ========== MOVIMIENTO FINANCIERO AL COMPLETAR REPARACIÓN ==========
/**
 * Registra el ingreso en caja/banco cuando se completa una reparación.
 *
 * @param {string}  reparacionId    - ID de la reparación (VARCHAR, ej: "REP1234")
 * @param {string}  clienteNombre   - Nombre del cliente para el concepto
 * @param {string}  metodoPago      - EFECTIVO | TRANSFERENCIA | TARJETA_BAC | TARJETA_NEONET | TARJETA_OTRA
 * @param {number}  monto           - Monto en centavos
 * @param {string}  usuarioNombre   - Nombre del usuario que completa
 * @param {object}  connection      - Conexión de DB (si se usa dentro de una transacción)
 * @param {number}  bancoId         - ID de cuenta bancaria (requerido si no es EFECTIVO)
 * @param {string}  referencia      - Número de referencia/autorización
 */
exports.registrarMovimientoReparacion = async (
  reparacionId,
  clienteNombre,
  metodoPago,
  monto,
  usuarioNombre,
  connection = null,
  bancoId = null,
  referencia = null,
  empresaId = null
) => {
  const dbConn = connection || db;

  try {
    const empresaIdFinanciera = resolveFinancialEmpresaId({ empresaId });
    const metodo = String(metodoPago || '').toUpperCase();
    const montoQuetzales = Number(monto || 0) / 100;
    const concepto = `Pago final reparación ${reparacionId}${clienteNombre ? ` - ${clienteNombre}` : ''}`;

    const buscarPrimeraCuentaActiva = async () => {
      const [cuentas] = await dbConn.query(
        'SELECT id, nombre FROM cuentas_bancarias WHERE empresa_id = ? AND activa = TRUE ORDER BY id LIMIT 1',
        [empresaIdFinanciera]
      );
      return cuentas.length > 0 ? cuentas[0] : null;
    };

    const buscarCuentaPorPOS = async (tipoPOS) => {
      let patrones = [];
      if (tipoPOS === 'BAC')    patrones = ['%BAC%'];
      else if (tipoPOS === 'NEONET') patrones = ['%NEONET%', '%Neonet%', '%Industrial%'];
      if (!patrones.length) return null;
      try {
        const condiciones = patrones.map(() => '(nombre LIKE ? OR pos_asociado LIKE ?)').join(' OR ');
        const params = patrones.flatMap(p => [p, p]);
        const [rows] = await dbConn.query(
          `SELECT id, nombre FROM cuentas_bancarias WHERE (${condiciones}) AND empresa_id = ? AND activa = TRUE ORDER BY id LIMIT 1`,
          [...params, empresaIdFinanciera]
        );
        return rows.length > 0 ? rows[0] : null;
      } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR' || String(err.message).includes('pos_asociado')) {
          const conds = patrones.map(() => 'nombre LIKE ?').join(' OR ');
          const [rows] = await dbConn.query(
            `SELECT id, nombre FROM cuentas_bancarias WHERE (${conds}) AND empresa_id = ? AND activa = TRUE ORDER BY id LIMIT 1`,
            [...patrones, empresaIdFinanciera]
          );
          return rows.length > 0 ? rows[0] : null;
        }
        throw err;
      }
    };

    const registrarEnBanco = async (cuenta, categoria = 'Reparación') => {
      if (!cuenta || !cuenta.id) return false;

      // Anti-duplicado: verificar si ya existe movimiento para esta reparación/cuenta
      const [dup] = await dbConn.query(
        `SELECT id FROM movimientos_bancarios
         WHERE empresa_id = ? AND referencia_tipo = 'reparacion' AND referencia_id = ? AND cuenta_id = ?
           AND tipo_movimiento = 'INGRESO' AND estado IN ('PENDIENTE','CONFIRMADO') LIMIT 1`,
        [empresaIdFinanciera, reparacionId, cuenta.id]
      );
      if (dup.length > 0) {
        console.warn(`⚠️ Movimiento duplicado para reparacion_id=${reparacionId}, cuenta_id=${cuenta.id}. Se omite.`);
        return false;
      }

      await dbConn.query(
        `INSERT INTO movimientos_bancarios
         (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, venta_id, categoria, estado,
          numero_referencia, realizado_por, referencia_tipo, referencia_id)
         VALUES (?, ?, 'INGRESO', ?, ?, NULL, ?, 'PENDIENTE', ?, ?, 'reparacion', ?)`,
        [empresaIdFinanciera, cuenta.id, montoQuetzales, concepto, categoria, referencia, usuarioNombre, reparacionId]
      );
      console.log(`✅ Movimiento banco registrado (${cuenta.nombre}, id=${cuenta.id}): Q${montoQuetzales} — ${concepto}`);
      return true;
    };

    if (metodo === 'EFECTIVO') {
      /*
       * Compatibilidad defensiva:
       * el efectivo de reparaciones se registra mediante
       * reparacionInventoryService y Caja Operativa.
       */
      return {
        success: true,
        skipped: true,
        reason:
          'EFECTIVO_GESTIONADO_POR_CAJA_OPERATIVA',
      };
    } else if (metodo === 'TRANSFERENCIA') {
      let cuenta = null;
      if (bancoId) {
        const [rows] = await dbConn.query(
          'SELECT id, nombre FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE LIMIT 1',
          [bancoId, empresaIdFinanciera]
        );
        cuenta = rows.length > 0 ? rows[0] : null;
      }
      if (!cuenta) {
        console.warn('⚠️ Banco no encontrado para transferencia, usando primera cuenta activa');
        cuenta = await buscarPrimeraCuentaActiva();
      }
      if (!(await registrarEnBanco(cuenta, 'Transferencia'))) {
        console.error('❌ No se encontró cuenta bancaria activa para TRANSFERENCIA');
      }

    } else if (metodo === 'TARJETA_BAC') {
      let cuenta = await buscarCuentaPorPOS('BAC');
      if (!cuenta) cuenta = await buscarPrimeraCuentaActiva();
      if (!(await registrarEnBanco(cuenta, 'POS'))) {
        console.error('❌ No se encontró cuenta bancaria activa para TARJETA_BAC');
      }

    } else if (metodo === 'TARJETA_NEONET') {
      let cuenta = await buscarCuentaPorPOS('NEONET');
      if (!cuenta) cuenta = await buscarPrimeraCuentaActiva();
      if (!(await registrarEnBanco(cuenta, 'POS'))) {
        console.error('❌ No se encontró cuenta bancaria activa para TARJETA_NEONET');
      }

    } else if (metodo === 'TARJETA_OTRA' || metodo === 'TARJETA') {
      let cuenta = null;
      if (bancoId) {
        const [rows] = await dbConn.query(
          'SELECT id, nombre FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE LIMIT 1',
          [bancoId, empresaIdFinanciera]
        );
        cuenta = rows.length > 0 ? rows[0] : null;
      }
      if (!cuenta) cuenta = await buscarPrimeraCuentaActiva();
      if (!(await registrarEnBanco(cuenta, 'POS'))) {
        console.error('❌ No se encontró cuenta bancaria activa para TARJETA_OTRA');
      }

    } else {
      console.warn(`⚠️ Método de pago no reconocido para reparación: ${metodoPago}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error registrando movimiento de reparación:', error);
    throw error;
  }
};

// ========== REVERSA AUTOMÁTICA AL ANULAR VENTAS ==========
// Esta función se llama desde ventaController.js cuando una venta se anula.
// No borra movimientos anteriores. Crea un EGRESO para reversar el INGRESO original.
exports.registrarReversaMovimientoVenta = async (
  venta,
  usuarioNombre = 'Sistema',
  connection = null,
  empresaId = null
) => {
  const dbConn = connection || db;

  try {
    const empresaIdFinanciera = resolveFinancialEmpresaId({ empresaId });
    if (!venta) {
      console.warn('⚠️ No se recibió información de venta para reversar movimiento financiero.');
      return { success: false, message: 'Venta no proporcionada' };
    }

    const ventaIdOriginal = venta.id ?? venta.venta_id ?? null;
    const ventaIdNumerico = Number.isInteger(Number(ventaIdOriginal)) ? Number(ventaIdOriginal) : null;

    if (ventaIdNumerico === null) {
      console.warn(`⚠️ No se puede crear reversa financiera: venta sin ID numérico resolvible.`);
      return { success: false, message: 'Venta sin ID numérico, no se crea reversa' };
    }

    // Obtener numero_venta para el concepto legible
    let referenciaVenta = String(ventaIdNumerico);
    try {
      const [filas] = await dbConn.query(
        'SELECT numero_venta FROM ventas WHERE id = ? AND empresa_id = ? LIMIT 1',
        [ventaIdNumerico, empresaIdFinanciera]
      );
      if (filas.length > 0 && filas[0].numero_venta) {
        referenciaVenta = filas[0].numero_venta;
      }
    } catch (lookupErr) {
      console.warn(`⚠️ No se pudo obtener numero_venta para venta id=${ventaIdNumerico}:`, lookupErr.message);
    }

    const conceptoReversa = `Anulación venta ${referenciaVenta}`;

    /*
     * No existe reversa legacy de Caja Chica para ventas.
     *
     * El efectivo se revierte mediante saleInventoryService
     * y la sesión operativa de caja.
     */

    // ── BANCO ─────────────────────────────────────────────────────────────────────

    // Anti-duplicado: no crear reversa si ya existe
    const [reversaBancoExistente] = await dbConn.query(
      `SELECT id FROM movimientos_bancarios
       WHERE empresa_id = ?
         AND venta_id = ?
         AND tipo_movimiento = 'EGRESO'
         AND categoria = 'Anulacion Venta'
         AND estado IN ('PENDIENTE', 'CONFIRMADO')
       LIMIT 1`,
      [empresaIdFinanciera, ventaIdNumerico]
    );

    let reversasBancoCreadas = 0;

    if (reversaBancoExistente.length > 0) {
      console.warn(`⚠️ Ya existe reversa bancaria para venta_id=${ventaIdNumerico}. Se omite.`);
    } else {
      // A. Anular ingresos bancarios PENDIENTES directamente
      await dbConn.query(
        `UPDATE movimientos_bancarios
         SET estado = 'ANULADO',
             observaciones = CONCAT(COALESCE(observaciones, ''), ' | ANULADO AUTOMATICAMENTE POR CANCELACION DE VENTA')
         WHERE empresa_id = ?
           AND venta_id = ?
           AND tipo_movimiento = 'INGRESO'
           AND categoria IN ('POS', 'Transferencia', 'Deposito')
           AND estado = 'PENDIENTE'`,
        [empresaIdFinanciera, ventaIdNumerico]
      );

      // B. Buscar ingresos bancarios CONFIRMADOS para reversar
      const [ingresosConfirmadosBanco] = await dbConn.query(
        `SELECT * FROM movimientos_bancarios
         WHERE empresa_id = ?
           AND venta_id = ?
           AND tipo_movimiento = 'INGRESO'
           AND categoria IN ('POS', 'Transferencia', 'Deposito')
           AND estado = 'CONFIRMADO'
         ORDER BY id ASC`,
        [empresaIdFinanciera, ventaIdNumerico]
      );

      // C. Crear una reversa CONFIRMADA por cada ingreso bancario confirmado
      for (const movimiento of ingresosConfirmadosBanco) {
        await dbConn.query(
          `INSERT INTO movimientos_bancarios
           (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, venta_id, categoria, estado, numero_referencia, realizado_por)
           VALUES (?, ?, 'EGRESO', ?, ?, ?, 'Anulacion Venta', 'CONFIRMADO', ?, ?)`,
          [
            empresaIdFinanciera,
            movimiento.cuenta_id,
            movimiento.monto,
            conceptoReversa,
            ventaIdNumerico,
            movimiento.numero_referencia || null,
            usuarioNombre,
          ]
        );

        // D. Actualizar saldo_actual restando el monto reversado
        await dbConn.query(
          'UPDATE cuentas_bancarias SET saldo_actual = saldo_actual - ? WHERE id = ? AND empresa_id = ?',
          [movimiento.monto, movimiento.cuenta_id, empresaIdFinanciera]
        );

        reversasBancoCreadas++;
        console.log(`✅ Reversa bancaria registrada: Q${movimiento.monto} - ${conceptoReversa} - Cuenta ${movimiento.cuenta_id}`);
      }
    }

    const reversasCreadas = reversasBancoCreadas;

    if (reversasCreadas === 0) {
      console.warn(`⚠️ No había movimientos confirmados para reversar de venta id=${ventaIdNumerico} (${referenciaVenta}). Los pendientes fueron anulados directamente.`);
      return {
        success: true,
        reversasCreadas: 0,
        message: 'Movimientos pendientes anulados. No había confirmados para reversar.',
      };
    }

    return {
      success: true,
      reversasCreadas,
      message: `Reversa financiera creada para venta ${referenciaVenta}`,
    };
  } catch (error) {
    console.error('Error registrando reversa financiera de venta:', error);
    throw error;
  }
};

// ========== RETIRO DE BANCO ==========
// Saca dinero de una cuenta bancaria específica.
// Si se marca a_caja_chica = true, el monto ingresa a caja chica también.
exports.retirarDeBanco = async (req, res) => {
  const conn = await db.getConnection();
  let transactionStarted = false;

  try {
    const {
      cuenta_id,
      monto,
      concepto,
      a_caja_chica,
      observaciones,
    } = req.body;

    const scope = cajaChicaScope(req);
    const empresaId = scope.empresaId;

    if (scope.mode !== 'specific') {
      throw cajaChicaHttpError(
        400,
        'BRANCH_SPECIFIC_REQUIRED',
        'Seleccione una sucursal específica para realizar esta operación.'
      );
    }

    const montoNum = Number(monto);

    if (
      !cuenta_id ||
      !Number.isFinite(montoNum) ||
      montoNum <= 0
    ) {
      throw cajaChicaHttpError(
        400,
        'MONTO_INVALIDO',
        'cuenta_id y monto son requeridos'
      );
    }

    const conceptoLimpio =
      String(concepto || '').trim();

    if (!conceptoLimpio) {
      throw cajaChicaHttpError(
        400,
        'CONCEPTO_REQUERIDO',
        'El concepto es requerido'
      );
    }

    await conn.beginTransaction();
    transactionStarted = true;

    // Orden de locks: sucursal primero, cuenta bancaria después.
    // Esto evita deadlocks con Caja Chica -> Banco.
    if (a_caja_chica) {
      await bloquearCajaChicaYObtenerSaldo(
        conn,
        scope
      );
    }

    const [[cuenta]] = await conn.query(
      `SELECT *
       FROM cuentas_bancarias
       WHERE id = ?
         AND empresa_id = ?
         AND activa = TRUE
       LIMIT 1
       FOR UPDATE`,
      [
        cuenta_id,
        empresaId,
      ]
    );

    if (!cuenta) {
      throw cajaChicaHttpError(
        404,
        'CUENTA_BANCARIA_NO_ENCONTRADA',
        'Cuenta bancaria no encontrada o inactiva'
      );
    }

    if (
      Number(cuenta.saldo_actual) <
      montoNum
    ) {
      throw cajaChicaHttpError(
        409,
        'BANCO_SALDO_INSUFICIENTE',
        `Saldo insuficiente. Disponible: Q${Number(cuenta.saldo_actual).toFixed(2)}`
      );
    }

    const usuario =
      cajaChicaUsuario(req);

    await conn.query(
      `INSERT INTO movimientos_bancarios (
         empresa_id,
         cuenta_id,
         tipo_movimiento,
         monto,
         concepto,
         categoria,
         estado,
         realizado_por,
         observaciones
       )
       VALUES (
         ?,
         ?,
         'EGRESO',
         ?,
         ?,
         'Retiro',
         'CONFIRMADO',
         ?,
         ?
       )`,
      [
        empresaId,
        cuenta_id,
        montoNum,
        conceptoLimpio,
        usuario,
        observaciones || null,
      ]
    );

    await conn.query(
      `UPDATE cuentas_bancarias
       SET saldo_actual =
         saldo_actual - ?
       WHERE id = ?
         AND empresa_id = ?`,
      [
        montoNum,
        cuenta_id,
        empresaId,
      ]
    );

    if (a_caja_chica) {
      await conn.query(
        `INSERT INTO caja_chica (
           empresa_id,
           sucursal_id,
           tipo_movimiento,
           monto,
           concepto,
           categoria,
           estado,
           realizado_por,
           observaciones
         )
         VALUES (
           ?,
           ?,
           'INGRESO',
           ?,
           ?,
           'Retiro Banco',
           'CONFIRMADO',
           ?,
           ?
         )`,
        [
          empresaId,
          scope.sucursalId,
          montoNum,
          `Retiro de ${cuenta.nombre} - ${conceptoLimpio}`,
          usuario,
          observaciones || null,
        ]
      );
    }

    await conn.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: a_caja_chica
        ? `Retiro de Q${montoNum.toFixed(2)} registrado e ingresado a Caja Chica`
        : `Retiro de Q${montoNum.toFixed(2)} registrado`,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch {}
    }

    console.error(
      'Error en retirarDeBanco:',
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        code: error.code,
        message: error.message,
      });
  } finally {
    conn.release();
  }
};

// ========== DEPÓSITO DE CAJA A BANCO ==========
// Saca dinero de caja chica y lo deposita en una cuenta bancaria.
exports.depositarAlBanco = async (req, res) => {
  const conn = await db.getConnection();
  let transactionStarted = false;

  try {
    const {
      cuenta_id,
      monto,
      concepto,
      observaciones,
    } = req.body;

    const scope = cajaChicaScope(req);
    const empresaId = scope.empresaId;

    if (scope.mode !== 'specific') {
      throw cajaChicaHttpError(
        400,
        'BRANCH_SPECIFIC_REQUIRED',
        'Seleccione una sucursal específica para realizar esta operación.'
      );
    }

    const montoNum = Number(monto);
    const conceptoLimpio =
      String(concepto || '').trim();

    if (
      !cuenta_id ||
      !Number.isFinite(montoNum) ||
      montoNum <= 0
    ) {
      throw cajaChicaHttpError(
        400,
        'MONTO_INVALIDO',
        'cuenta_id y monto son requeridos'
      );
    }

    if (!conceptoLimpio) {
      throw cajaChicaHttpError(
        400,
        'CONCEPTO_REQUERIDO',
        'El concepto es requerido'
      );
    }

    await conn.beginTransaction();
    transactionStarted = true;

    const saldoCaja =
      await bloquearCajaChicaYObtenerSaldo(
        conn,
        scope
      );

    if (saldoCaja < montoNum) {
      throw cajaChicaHttpError(
        409,
        'CAJA_CHICA_SALDO_INSUFICIENTE',
        `Saldo insuficiente en Caja Chica. Disponible: Q${saldoCaja.toFixed(2)}`
      );
    }

    const [[cuenta]] = await conn.query(
      `SELECT *
       FROM cuentas_bancarias
       WHERE id = ?
         AND empresa_id = ?
         AND activa = TRUE
       LIMIT 1
       FOR UPDATE`,
      [
        cuenta_id,
        empresaId,
      ]
    );

    if (!cuenta) {
      throw cajaChicaHttpError(
        404,
        'CUENTA_BANCARIA_NO_ENCONTRADA',
        'Cuenta bancaria no encontrada o inactiva'
      );
    }

    const usuario =
      cajaChicaUsuario(req);

    await conn.query(
      `INSERT INTO caja_chica (
         empresa_id,
         sucursal_id,
         tipo_movimiento,
         monto,
         concepto,
         categoria,
         estado,
         realizado_por,
         observaciones
       )
       VALUES (
         ?,
         ?,
         'EGRESO',
         ?,
         ?,
         'Deposito Banco',
         'CONFIRMADO',
         ?,
         ?
       )`,
      [
        empresaId,
        scope.sucursalId,
        montoNum,
        `Depósito a ${cuenta.nombre} - ${conceptoLimpio}`,
        usuario,
        observaciones || null,
      ]
    );

    await conn.query(
      `INSERT INTO movimientos_bancarios (
         empresa_id,
         cuenta_id,
         tipo_movimiento,
         monto,
         concepto,
         categoria,
         estado,
         realizado_por,
         observaciones
       )
       VALUES (
         ?,
         ?,
         'INGRESO',
         ?,
         ?,
         'Deposito',
         'CONFIRMADO',
         ?,
         ?
       )`,
      [
        empresaId,
        cuenta_id,
        montoNum,
        `Depósito desde Caja Chica - ${conceptoLimpio}`,
        usuario,
        observaciones || null,
      ]
    );

    await conn.query(
      `UPDATE cuentas_bancarias
       SET saldo_actual =
         saldo_actual + ?
       WHERE id = ?
         AND empresa_id = ?`,
      [
        montoNum,
        cuenta_id,
        empresaId,
      ]
    );

    await conn.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message:
        `Depósito de Q${montoNum.toFixed(2)} a ${cuenta.nombre} registrado`,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch {}
    }

    console.error(
      'Error en depositarAlBanco:',
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        code: error.code,
        message: error.message,
      });
  } finally {
    conn.release();
  }
};

// ========== INGRESO MANUAL DIRECTO A BANCO ==========
// Crea dinero directamente en una cuenta bancaria sin afectar caja chica.
exports.ingresoBanco = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { cuenta_id, monto, concepto, observaciones, realizado_por, categoria } = req.body;
    const empresaId = getTenantEmpresaId(req);

    if (!cuenta_id || !monto || Number(monto) <= 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'cuenta_id y monto son requeridos' });
    }
    if (!concepto || !String(concepto).trim()) {
      conn.release();
      return res.status(400).json({ success: false, message: 'El concepto es requerido' });
    }

    const montoNum = Number(monto);

    const [cuentas] = await conn.query(
      'SELECT * FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE LIMIT 1',
      [cuenta_id, empresaId]
    );

    if (cuentas.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Cuenta bancaria no encontrada o inactiva' });
    }

    const cuenta = cuentas[0];
    const usuario = realizado_por || 'Usuario';

    await conn.beginTransaction();

    // Solo ingreso al banco — no se descuenta de ningún lado
    await conn.query(
      `INSERT INTO movimientos_bancarios
        (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones)
       VALUES (?, ?, 'INGRESO', ?, ?, ?, 'CONFIRMADO', ?, ?)`,
      [empresaId, cuenta_id, montoNum, concepto, categoria || 'Ingreso Manual', usuario, observaciones || null]
    );

    await conn.query(
      'UPDATE cuentas_bancarias SET saldo_actual = saldo_actual + ? WHERE id = ? AND empresa_id = ?',
      [montoNum, cuenta_id, empresaId]
    );

    await conn.commit();
    conn.release();

    res.status(201).json({
      success: true,
      message: `Ingreso de Q${montoNum.toFixed(2)} registrado en ${cuenta.nombre}`
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('Error en ingresoBanco:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== TRANSFERENCIA ENTRE BANCOS ==========
// Mueve dinero de una cuenta bancaria a otra dentro del sistema.
exports.transferenciaBancos = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { cuenta_origen_id, cuenta_destino_id, monto, concepto, observaciones, realizado_por } = req.body;
    const empresaId = getTenantEmpresaId(req);

    if (!cuenta_origen_id || !cuenta_destino_id || !monto || Number(monto) <= 0) {
      return res.status(400).json({ success: false, message: 'cuenta_origen_id, cuenta_destino_id y monto son requeridos' });
    }
    if (Number(cuenta_origen_id) === Number(cuenta_destino_id)) {
      return res.status(400).json({ success: false, message: 'La cuenta de origen y destino deben ser diferentes' });
    }
    if (!concepto || !String(concepto).trim()) {
      return res.status(400).json({ success: false, message: 'El concepto es requerido' });
    }

    const montoNum = Number(monto);

    const [cuentasOrigen] = await conn.query(
      'SELECT * FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE LIMIT 1',
      [cuenta_origen_id, empresaId]
    );
    if (cuentasOrigen.length === 0) {
      return res.status(404).json({ success: false, message: 'Cuenta de origen no encontrada o inactiva' });
    }

    const [cuentasDestino] = await conn.query(
      'SELECT * FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE LIMIT 1',
      [cuenta_destino_id, empresaId]
    );
    if (cuentasDestino.length === 0) {
      return res.status(404).json({ success: false, message: 'Cuenta de destino no encontrada o inactiva' });
    }

    const origen = cuentasOrigen[0];
    const destino = cuentasDestino[0];

    if (Number(origen.saldo_actual) < montoNum) {
      return res.status(409).json({
        success: false,
        message: `Saldo insuficiente en ${origen.nombre}. Disponible: Q${Number(origen.saldo_actual).toFixed(2)}`
      });
    }

    await conn.beginTransaction();

    const usuario = realizado_por || 'Usuario';

    // Egreso del origen
    await conn.query(
      `INSERT INTO movimientos_bancarios
        (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones)
       VALUES (?, ?, 'EGRESO', ?, ?, 'Transferencia', 'CONFIRMADO', ?, ?)`,
      [empresaId, cuenta_origen_id, montoNum, `Transferencia a ${destino.nombre} - ${concepto}`, usuario, observaciones || null]
    );

    // Ingreso al destino
    await conn.query(
      `INSERT INTO movimientos_bancarios
        (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones)
       VALUES (?, ?, 'INGRESO', ?, ?, 'Transferencia', 'CONFIRMADO', ?, ?)`,
      [empresaId, cuenta_destino_id, montoNum, `Transferencia desde ${origen.nombre} - ${concepto}`, usuario, observaciones || null]
    );

    // Actualizar saldos
    await conn.query(
      'UPDATE cuentas_bancarias SET saldo_actual = saldo_actual - ? WHERE id = ? AND empresa_id = ?',
      [montoNum, cuenta_origen_id, empresaId]
    );
    await conn.query(
      'UPDATE cuentas_bancarias SET saldo_actual = saldo_actual + ? WHERE id = ? AND empresa_id = ?',
      [montoNum, cuenta_destino_id, empresaId]
    );

    await conn.commit();
    conn.release();

    res.status(201).json({
      success: true,
      message: `Transferencia de Q${montoNum.toFixed(2)} de ${origen.nombre} a ${destino.nombre} registrada`
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('Error en transferenciaBancos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== CRUD CUENTAS BANCARIAS (solo admin) ==========

exports.crearCuentaBancaria = async (req, res) => {
  try {
    const { nombre, numero_cuenta, tipo_cuenta, pos_asociado } = req.body;
    const empresaId = getTenantEmpresaId(req);
    if (!nombre?.trim()) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    await db.query(
      'INSERT INTO cuentas_bancarias (empresa_id, nombre, numero_cuenta, tipo_cuenta, pos_asociado, saldo_actual, activa) VALUES (?, ?, ?, ?, ?, 0, 1)',
      [empresaId, nombre.trim(), numero_cuenta || null, tipo_cuenta || 'Corriente', pos_asociado || null]
    );
    res.status(201).json({ success: true, message: 'Cuenta bancaria creada exitosamente' });
  } catch (error) {
    console.error('Error al crear cuenta bancaria:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.editarCuentaBancaria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, numero_cuenta, tipo_cuenta, pos_asociado } = req.body;
    const empresaId = getTenantEmpresaId(req);
    if (!nombre?.trim()) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    const [result] = await db.query(
      'UPDATE cuentas_bancarias SET nombre = ?, numero_cuenta = ?, tipo_cuenta = ?, pos_asociado = ? WHERE id = ? AND empresa_id = ?',
      [nombre.trim(), numero_cuenta || null, tipo_cuenta || 'Corriente', pos_asociado || null, id, empresaId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Cuenta no encontrada' });
    res.json({ success: true, message: 'Cuenta bancaria actualizada exitosamente' });
  } catch (error) {
    console.error('Error al editar cuenta bancaria:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.desactivarCuentaBancaria = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = getTenantEmpresaId(req);
    const [result] = await db.query(
      'UPDATE cuentas_bancarias SET activa = 0 WHERE id = ? AND empresa_id = ?', [id, empresaId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Cuenta no encontrada' });
    res.json({ success: true, message: 'Cuenta bancaria desactivada exitosamente' });
  } catch (error) {
    console.error('Error al desactivar cuenta bancaria:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== TRANSFERENCIA CAJA CHICA → BANCO (roles autorizados) ==========
// El egreso de caja queda CONFIRMADO (el dinero sale físicamente de caja).
// El ingreso bancario queda PENDIENTE; el admin lo confirma después.
exports.transferirCajaABanco = async (req, res) => {
  const conn = await db.getConnection();
  let transactionStarted = false;

  try {
    const {
      banco_id,
      monto,
      fecha,
      referencia,
      observacion,
    } = req.body;

    const scope = cajaChicaScope(req);
    const empresaId = scope.empresaId;

    if (scope.mode !== 'specific') {
      throw cajaChicaHttpError(
        400,
        'BRANCH_SPECIFIC_REQUIRED',
        'Seleccione una sucursal específica para realizar esta operación.'
      );
    }

    const montoNum = Number(monto);

    if (
      !banco_id ||
      !Number.isFinite(montoNum) ||
      montoNum <= 0
    ) {
      throw cajaChicaHttpError(
        400,
        'MONTO_INVALIDO',
        'banco_id y monto son obligatorios'
      );
    }

    const userId =
      req.user?.id ??
      req.user?.userId ??
      req.user?.usuario_id ??
      null;

    const userName =
      cajaChicaUsuario(req);

    const fechaMov = fecha
      ? (
          String(fecha).length === 10
            ? `${fecha} 00:00:00`
            : fecha
        )
      : new Date()
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');

    await conn.beginTransaction();
    transactionStarted = true;

    const saldoCaja =
      await bloquearCajaChicaYObtenerSaldo(
        conn,
        scope
      );

    if (montoNum > saldoCaja) {
      throw cajaChicaHttpError(
        409,
        'CAJA_CHICA_SALDO_INSUFICIENTE',
        `Saldo insuficiente en Caja Chica. Disponible: Q${saldoCaja.toFixed(2)}`
      );
    }

    const [[banco]] = await conn.query(
      `SELECT id, nombre
       FROM cuentas_bancarias
       WHERE id = ?
         AND empresa_id = ?
         AND activa = TRUE
       LIMIT 1
       FOR UPDATE`,
      [
        banco_id,
        empresaId,
      ]
    );

    if (!banco) {
      throw cajaChicaHttpError(
        404,
        'CUENTA_BANCARIA_NO_ENCONTRADA',
        'Banco no encontrado o inactivo'
      );
    }

    await conn.query(
      `INSERT INTO caja_chica (
         empresa_id,
         sucursal_id,
         tipo_movimiento,
         monto,
         concepto,
         categoria,
         estado,
         realizado_por,
         observaciones,
         fecha_movimiento,
         confirmado_en,
         confirmado_por,
         referencia_tipo,
         referencia_id
       )
       VALUES (
         ?,
         ?,
         'EGRESO',
         ?,
         ?,
         'Traslado a Banco',
         'CONFIRMADO',
         ?,
         ?,
         ?,
         NOW(),
         ?,
         'TRASLADO_BANCO',
         ?
       )`,
      [
        empresaId,
        scope.sucursalId,
        montoNum,
        `Depósito a banco - ${banco.nombre}`,
        userName,
        observacion || null,
        fechaMov,
        userId,
        String(banco_id),
      ]
    );

    await conn.query(
      `INSERT INTO movimientos_bancarios (
         empresa_id,
         cuenta_id,
         tipo_movimiento,
         monto,
         concepto,
         categoria,
         estado,
         numero_referencia,
         realizado_por,
         observaciones,
         fecha_movimiento,
         referencia_tipo
       )
       VALUES (
         ?,
         ?,
         'INGRESO',
         ?,
         'Depósito desde caja chica',
         'Traslado Caja',
         'PENDIENTE',
         ?,
         ?,
         ?,
         ?,
         'TRASLADO_CAJA'
       )`,
      [
        empresaId,
        banco_id,
        montoNum,
        referencia || null,
        userName,
        observacion || null,
        fechaMov,
      ]
    );

    await conn.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message:
        `Depósito de Q${montoNum.toFixed(2)} registrado. El ingreso bancario queda pendiente de confirmación por el administrador.`,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch {}
    }

    console.error(
      'Error en transferirCajaABanco:',
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        code: error.code,
        message: error.message,
      });
  } finally {
    conn.release();
  }
};

module.exports = exports;
