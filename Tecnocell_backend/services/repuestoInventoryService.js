const db = require('../config/database');
const productInventoryService = require('./productInventoryService');

function inventoryError(message, statusCode = 409, code = 'REPUESTO_INVENTORY_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requireSpecific(branchScope) {
  productInventoryService.requireSpecific(branchScope);
}

function stockProjection(branchScope, alias = 'r') {
  if (branchScope.mode === 'specific') {
    return {
      sql: `COALESCE((SELECT re.existencia FROM repuesto_existencias re
        WHERE re.empresa_id = ${alias}.empresa_id
          AND re.repuesto_id = ${alias}.id AND re.sucursal_id = ? LIMIT 1), 0)`,
      params: [Number(branchScope.sucursalId)],
    };
  }
  const allowed = Array.isArray(branchScope.allowedSucursalIds)
    ? branchScope.allowedSucursalIds.map(Number).filter(Number.isInteger)
    : [];
  if (!allowed.length) return { sql: '0', params: [] };
  return {
    sql: `COALESCE((SELECT SUM(re.existencia) FROM repuesto_existencias re
      WHERE re.empresa_id = ${alias}.empresa_id
        AND re.repuesto_id = ${alias}.id
        AND re.sucursal_id IN (${allowed.map(() => '?').join(',')})), 0)`,
    params: allowed,
  };
}

async function lockExistence(connection, { empresaId, sucursalId, repuestoId }) {
  await connection.query(
    `INSERT INTO repuesto_existencias
     (empresa_id, sucursal_id, repuesto_id, existencia)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE repuesto_id = VALUES(repuesto_id)`,
    [empresaId, sucursalId, repuestoId]
  );
  const [[row]] = await connection.query(
    `SELECT existencia FROM repuesto_existencias
     WHERE empresa_id = ? AND sucursal_id = ? AND repuesto_id = ? FOR UPDATE`,
    [empresaId, sucursalId, repuestoId]
  );
  return Number(row.existencia);
}

async function recordMovement(connection, data) {
  try {
    await connection.query(
      `INSERT INTO repuesto_movimientos
       (empresa_id, sucursal_id, repuesto_id, tipo, cantidad,
        existencia_anterior, existencia_nueva, nota, usuario_id,
        compra_id, compra_item_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.empresaId, data.sucursalId, data.repuestoId, data.tipo, data.cantidad,
        data.anterior, data.nueva, data.nota, data.usuarioId,
        data.compraId ?? null, data.compraItemId ?? null]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw inventoryError('La recepción o anulación del repuesto ya fue aplicada', 409, 'REPUESTO_MOVEMENT_ALREADY_APPLIED');
    }
    throw error;
  }
}

async function changeWithConnection(connection, data) {
  requireSpecific(data.branchScope);
  const empresaId = Number(data.branchScope.empresaId);
  const sucursalId = Number(data.branchScope.sucursalId);
  const repuestoId = Number(data.repuestoId);
  const cantidad = Number(data.cantidad);
  if (!Number.isInteger(cantidad) || cantidad === 0) {
    throw inventoryError('La cantidad debe ser un entero distinto de cero', 400, 'INVALID_REPUESTO_QUANTITY');
  }
  const [[catalog]] = await connection.query(
    'SELECT id FROM repuestos WHERE id = ? AND empresa_id = ? FOR UPDATE',
    [repuestoId, empresaId]
  );
  if (!catalog) throw inventoryError('Repuesto no encontrado', 404, 'REPUESTO_NOT_FOUND');
  const anterior = await lockExistence(connection, { empresaId, sucursalId, repuestoId });
  const nueva = anterior + cantidad;
  if (nueva < 0) {
    throw inventoryError('Stock insuficiente para completar la operación', 409, 'INSUFFICIENT_REPUESTO_STOCK');
  }
  await connection.query(
    `UPDATE repuesto_existencias SET existencia = ?
     WHERE empresa_id = ? AND sucursal_id = ? AND repuesto_id = ?`,
    [nueva, empresaId, sucursalId, repuestoId]
  );
  await recordMovement(connection, {
    ...data, empresaId, sucursalId, repuestoId, cantidad, anterior, nueva,
  });
  return { stock_anterior: anterior, stock_nuevo: nueva, diferencia: cantidad };
}

async function adjust(data) {
  requireSpecific(data.branchScope);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await changeWithConnection(connection, data);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

async function receivePurchase(connection, data) {
  const cantidad = Number(data.cantidad);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw inventoryError('La cantidad recibida debe ser un entero positivo', 400, 'INVALID_REPUESTO_QUANTITY');
  }
  return changeWithConnection(connection, {
    ...data,
    cantidad,
    tipo: 'compra_recepcion',
    nota: `Recepción compra ${data.numeroCompra}`,
  });
}

async function reversePurchase(connection, data) {
  requireSpecific(data.branchScope);
  const empresaId = Number(data.branchScope.empresaId);
  const sucursalId = Number(data.branchScope.sucursalId);
  const [[receipt]] = await connection.query(
    `SELECT id FROM repuesto_movimientos
     WHERE empresa_id = ? AND sucursal_id = ? AND compra_item_id = ?
       AND tipo = 'compra_recepcion' FOR UPDATE`,
    [empresaId, sucursalId, Number(data.compraItemId)]
  );
  if (!receipt) {
    throw inventoryError('La recepción del repuesto no está registrada; no es seguro revertirla', 409, 'REPUESTO_RECEIPT_NOT_FOUND');
  }
  const cantidad = Number(data.cantidad);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw inventoryError('La cantidad a revertir debe ser un entero positivo', 400, 'INVALID_REPUESTO_QUANTITY');
  }
  return changeWithConnection(connection, {
    ...data,
    cantidad: -cantidad,
    tipo: 'compra_anulacion',
    nota: `Anulación compra ${data.numeroCompra}`,
  });
}

async function listMovements({ branchScope, repuestoId, limit = 200 }) {
  const empresaId = Number(branchScope.empresaId);
  const params = [Number(repuestoId), empresaId];
  let scopeSql;
  if (branchScope.mode === 'specific') {
    scopeSql = ' AND rm.sucursal_id = ?';
    params.push(Number(branchScope.sucursalId));
  } else {
    const allowed = branchScope.allowedSucursalIds.map(Number);
    if (!allowed.length) return [];
    scopeSql = ` AND rm.sucursal_id IN (${allowed.map(() => '?').join(',')})`;
    params.push(...allowed);
  }
  params.push(Number(limit));
  const [rows] = await db.query(
    `SELECT rm.*, rm.tipo AS tipo_movimiento, rm.nota AS notas,
            rm.existencia_anterior AS stock_anterior,
            rm.existencia_nueva AS stock_nuevo, u.username AS usuario_nombre
     FROM repuesto_movimientos rm
     LEFT JOIN users u ON u.id = rm.usuario_id
     WHERE rm.repuesto_id = ? AND rm.empresa_id = ?${scopeSql}
     ORDER BY rm.created_at DESC, rm.id DESC LIMIT ?`,
    params
  );
  return rows;
}

module.exports = {
  adjust,
  changeWithConnection,
  listMovements,
  receivePurchase,
  requireSpecific,
  reversePurchase,
  stockProjection,
};
