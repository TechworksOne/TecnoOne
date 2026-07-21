const db = require('../config/database');

function scopeError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requireSpecific(branchScope) {
  if (!branchScope || branchScope.mode !== 'specific' || !branchScope.sucursalId) {
    throw scopeError(
      'Seleccione una sucursal especifica para modificar existencias',
      409,
      'BRANCH_SPECIFIC_REQUIRED'
    );
  }
}

function stockProjection(branchScope, productAlias = 'p') {
  if (branchScope.mode === 'specific') {
    return {
      sql: `COALESCE((
        SELECT pe.existencia
        FROM producto_existencias pe
        WHERE pe.empresa_id = ${productAlias}.empresa_id
          AND pe.producto_id = ${productAlias}.id
          AND pe.sucursal_id = ?
        LIMIT 1
      ), 0)`,
      params: [Number(branchScope.sucursalId)],
    };
  }

  const allowed = Array.isArray(branchScope.allowedSucursalIds)
    ? branchScope.allowedSucursalIds.map(Number).filter(Number.isInteger)
    : [];
  if (!allowed.length) return { sql: '0', params: [] };
  return {
    sql: `COALESCE((
      SELECT SUM(pe.existencia)
      FROM producto_existencias pe
      WHERE pe.empresa_id = ${productAlias}.empresa_id
        AND pe.producto_id = ${productAlias}.id
        AND pe.sucursal_id IN (${allowed.map(() => '?').join(',')})
    ), 0)`,
    params: allowed,
  };
}

async function ajustarExistencia({ branchScope, productoId, cantidad, tipo, nota, usuarioId }) {
  requireSpecific(branchScope);
  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const [[producto]] = await connection.query(
      'SELECT id FROM productos WHERE id = ? AND empresa_id = ? FOR UPDATE',
      [productoId, empresaId]
    );
    if (!producto) throw scopeError('Producto no encontrado', 404, 'PRODUCT_NOT_FOUND');

    await connection.query(
      `INSERT INTO producto_existencias
       (empresa_id, sucursal_id, producto_id, existencia)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE producto_id = VALUES(producto_id)`,
      [empresaId, sucursalId, productoId]
    );

    const [[existencia]] = await connection.query(
      `SELECT existencia
       FROM producto_existencias
       WHERE empresa_id = ? AND sucursal_id = ? AND producto_id = ?
       FOR UPDATE`,
      [empresaId, sucursalId, productoId]
    );
    const anterior = Number(existencia.existencia);
    const nueva = anterior + cantidad;
    if (nueva < 0) throw scopeError('Stock insuficiente', 409, 'INSUFFICIENT_STOCK');

    await connection.query(
      `UPDATE producto_existencias
       SET existencia = ?
       WHERE empresa_id = ? AND sucursal_id = ? AND producto_id = ?`,
      [nueva, empresaId, sucursalId, productoId]
    );
    await connection.query(
      `INSERT INTO producto_movimientos
       (empresa_id, sucursal_id, producto_id, tipo, cantidad,
        existencia_anterior, existencia_nueva, nota, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, sucursalId, productoId, tipo, cantidad, anterior, nueva, nota, usuarioId]
    );
    await connection.commit();
    return { stock_anterior: anterior, stock_nuevo: nueva, diferencia: cantidad };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

async function listarMovimientos({ branchScope, productoId, limit }) {
  requireSpecific(branchScope);
  const empresaId = Number(branchScope.empresaId);
  const params = [productoId, empresaId, Number(branchScope.sucursalId)];
  params.push(limit);
  const [rows] = await db.query(
    `SELECT pm.id, pm.empresa_id, pm.sucursal_id, pm.producto_id,
            pm.tipo, pm.cantidad,
            pm.existencia_anterior AS cantidad_anterior,
            pm.existencia_nueva AS cantidad_nueva,
            pm.nota, pm.usuario_id, pm.created_at,
            u.username AS usuario_nombre, s.nombre AS sucursal_nombre
     FROM producto_movimientos pm
     INNER JOIN sucursales s
       ON s.id = pm.sucursal_id AND s.empresa_id = pm.empresa_id
     LEFT JOIN users u ON u.id = pm.usuario_id
     WHERE pm.producto_id = ? AND pm.empresa_id = ?
       AND pm.sucursal_id = ?
     ORDER BY pm.created_at DESC, pm.id DESC
     LIMIT ?`,
    params
  );
  return rows;
}

module.exports = {
  ajustarExistencia,
  listarMovimientos,
  requireSpecific,
  stockProjection,
  scopeError,
};
