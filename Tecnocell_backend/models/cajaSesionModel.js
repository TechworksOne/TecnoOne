'use strict';

const db = require('../config/database');

function sesionError(message, statusCode, code) {
  const e = new Error(message);
  e.statusCode = statusCode;
  e.code = code;
  return e;
}

const SELECT_SESION = `
  SELECT cs.*,
         c.nombre  AS caja_nombre,  c.codigo AS caja_codigo,
         s.nombre  AS sucursal_nombre,
         ua.username AS usuario_apertura_username,
         uc.username AS cerrado_por_username
  FROM caja_sesiones cs
  INNER JOIN cajas      c  ON c.id  = cs.caja_id
                          AND c.empresa_id = cs.empresa_id
                          AND c.sucursal_id = cs.sucursal_id
  INNER JOIN sucursales s  ON s.id  = cs.sucursal_id  AND s.empresa_id  = cs.empresa_id
  LEFT JOIN  users      ua ON ua.id = cs.usuario_apertura_id
  LEFT JOIN  users      uc ON uc.id = cs.cerrado_por
`;

function buildSucursalFilter(sucursalIds, params) {
  if (!Array.isArray(sucursalIds) || !sucursalIds.length) return ' AND 1 = 0';
  if (sucursalIds.length === 1) { params.push(sucursalIds[0]); return ' AND cs.sucursal_id = ?'; }
  params.push(...sucursalIds);
  return ` AND cs.sucursal_id IN (${sucursalIds.map(() => '?').join(',')})`;
}

async function listarActivas({ empresaId, sucursalIds, usuarioId, cajaId }) {
  const params = [empresaId];
  let where = ' WHERE cs.empresa_id = ? AND cs.estado = \'ABIERTA\'';
  where += buildSucursalFilter(sucursalIds, params);

  if (usuarioId) {
    where += ' AND cs.usuario_apertura_id = ?';
    params.push(Number(usuarioId));
  }

  if (cajaId) {
    where += ' AND cs.caja_id = ?';
    params.push(Number(cajaId));
  }
  const [rows] = await db.query(`${SELECT_SESION}${where} ORDER BY cs.fecha_apertura DESC`, params);
  return rows;
}

async function listar({ empresaId, sucursalIds, cajaId, limit = 20, offset = 0 }) {
  const params = [empresaId];
  let where = ' WHERE cs.empresa_id = ?';
  where += buildSucursalFilter(sucursalIds, params);
  if (cajaId) { where += ' AND cs.caja_id = ?'; params.push(Number(cajaId)); }
  params.push(Math.min(Number(limit) || 20, 100), Math.max(Number(offset) || 0, 0));
  const [rows] = await db.query(
    `${SELECT_SESION}${where} ORDER BY cs.fecha_apertura DESC LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

/**
 * Abre una sesión de caja dentro de una transacción.
 * Verifica que la caja pertenezca a empresa+sucursal y esté activa.
 * Traduce ER_DUP_ENTRY de los UNIQUE generados al código de error de negocio.
 * Devuelve null si la caja no existe/no pertenece; lanza para otros errores.
 */
async function crear({ empresaId, sucursalId, cajaId, usuarioId, fondoInicial }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[caja]] = await connection.query(
      `SELECT id FROM cajas
       WHERE id = ? AND empresa_id = ? AND sucursal_id = ? AND activa = 1
       LIMIT 1`,
      [cajaId, empresaId, sucursalId]
    );
    if (!caja) { await connection.rollback(); return null; }

    const [ins] = await connection.query(
      `INSERT INTO caja_sesiones
       (empresa_id, sucursal_id, caja_id, usuario_apertura_id, fondo_inicial_centavos)
       VALUES (?, ?, ?, ?, ?)`,
      [empresaId, sucursalId, cajaId, usuarioId, fondoInicial]
    );

    const [[sesion]] = await connection.query(
      `${SELECT_SESION} WHERE cs.id = ?`,
      [ins.insertId]
    );

    await connection.commit();
    return sesion;
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    if (err.code === 'ER_DUP_ENTRY') {
      const msg = String(err.message || err.sqlMessage || '');
      if (/uk_sesion_caja_abierta/i.test(msg))
        throw sesionError('La caja ya tiene una sesión abierta', 409, 'CAJA_YA_TIENE_SESION_ABIERTA');
      if (/uk_sesion_usuario_abierta/i.test(msg))
        throw sesionError('El usuario ya tiene una sesión de caja abierta en esta empresa', 409, 'USUARIO_YA_TIENE_SESION_ABIERTA');
      throw sesionError('No se pudo abrir la sesión por conflicto de unicidad', 409, 'SESION_CONFLICTO');
    }
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Cierra una sesión ABIERTA dentro de una transacción.
 * Calcula efectivo_esperado = fondo_inicial (Fase 2A; extender en Fase 3).
 * Devuelve null si la sesión no existe/ya está cerrada o pertenece a otra sucursal.
 */
async function cerrar({ sesionId, empresaId, sucursalId, usuarioId, efectivoContado, cerradoPor, notas }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[sesion]] = await connection.query(
      `SELECT id, fondo_inicial_centavos FROM caja_sesiones
       WHERE id = ?
         AND empresa_id = ?
         AND sucursal_id = ?
         AND usuario_apertura_id = ?
         AND estado = 'ABIERTA'
       FOR UPDATE`,
      [sesionId, empresaId, sucursalId, usuarioId]
    );
    if (!sesion) { await connection.rollback(); return null; }

    // Fase 2A: esperado = fondo_inicial. Fase 3: + sum(ingresos efectivo) - sum(egresos)
    const esperado  = Number(sesion.fondo_inicial_centavos);
    const contado   = Number(efectivoContado);
    const diferencia = contado - esperado;

    await connection.query(
      `UPDATE caja_sesiones
       SET estado                     = 'CERRADA',
           fecha_cierre               = NOW(),
           efectivo_esperado_centavos = ?,
           efectivo_contado_centavos  = ?,
           diferencia_centavos        = ?,
           cerrado_por                = ?,
           notas_cierre               = ?
       WHERE id = ?`,
      [esperado, contado, diferencia, cerradoPor, notas || null, sesionId]
    );

    await connection.commit();
    return { sesionId: Number(sesionId), diferencia, efectivoEsperado: esperado, efectivoContado: contado };
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { listarActivas, listar, crear, cerrar };
