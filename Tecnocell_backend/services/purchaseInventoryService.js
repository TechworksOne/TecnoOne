const productInventoryService = require('./productInventoryService');

function purchaseError(message, statusCode = 409, code = 'PURCHASE_INVENTORY_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requireSpecific(branchScope) {
  productInventoryService.requireSpecific(branchScope);
}

function purchaseScopeClause(branchScope, alias = 'c') {
  const empresaId = Number(branchScope.empresaId);
  if (branchScope.mode === 'specific') {
    return {
      sql: ` AND ${alias}.empresa_id = ? AND ${alias}.sucursal_id = ?`,
      params: [empresaId, Number(branchScope.sucursalId)],
    };
  }
  const allowed = Array.isArray(branchScope.allowedSucursalIds)
    ? branchScope.allowedSucursalIds.map(Number).filter(Number.isInteger)
    : [];
  if (!allowed.length) return { sql: ' AND 1 = 0', params: [] };
  return {
    sql: ` AND ${alias}.empresa_id = ? AND ${alias}.sucursal_id IN (${allowed.map(() => '?').join(',')})`,
    params: [empresaId, ...allowed],
  };
}

async function registerApplication(connection, values) {
  try {
    await connection.query(
      `INSERT INTO compra_inventario_aplicaciones
       (empresa_id, sucursal_id, compra_id, compra_item_id, producto_id, accion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      values
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw purchaseError(
        'La recepción o reversión de este ítem ya fue aplicada',
        409,
        'PURCHASE_INVENTORY_ALREADY_APPLIED'
      );
    }
    throw error;
  }
}

async function receiveProduct(connection, {
  branchScope, compraId, compraItemId, productoId, cantidad, usuarioId, numeroCompra,
}) {
  requireSpecific(branchScope);
  if (!Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0) {
    throw purchaseError('La cantidad recibida debe ser un entero positivo', 400, 'INVALID_PURCHASE_QUANTITY');
  }
  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);

  await connection.query(
    `INSERT INTO producto_existencias
     (empresa_id, sucursal_id, producto_id, existencia)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE producto_id = VALUES(producto_id)`,
    [empresaId, sucursalId, productoId]
  );
  const [[row]] = await connection.query(
    `SELECT existencia FROM producto_existencias
     WHERE empresa_id = ? AND sucursal_id = ? AND producto_id = ?
     FOR UPDATE`,
    [empresaId, sucursalId, productoId]
  );
  if (!row) throw purchaseError('No fue posible bloquear la existencia del producto');

  const anterior = Number(row.existencia);
  const nueva = anterior + Number(cantidad);
  await registerApplication(connection, [
    empresaId, sucursalId, compraId, compraItemId, productoId, 'RECEPCION',
  ]);
  await connection.query(
    `UPDATE producto_existencias SET existencia = ?
     WHERE empresa_id = ? AND sucursal_id = ? AND producto_id = ?`,
    [nueva, empresaId, sucursalId, productoId]
  );
  await connection.query(
    `INSERT INTO producto_movimientos
     (empresa_id, sucursal_id, producto_id, tipo, cantidad,
      existencia_anterior, existencia_nueva, nota, usuario_id)
     VALUES (?, ?, ?, 'compra_recepcion', ?, ?, ?, ?, ?)`,
    [empresaId, sucursalId, productoId, cantidad, anterior, nueva,
      `Recepción compra ${numeroCompra}`, usuarioId]
  );
}

async function reverseProduct(connection, {
  branchScope, compraId, compraItemId, productoId, cantidad, usuarioId, numeroCompra,
}) {
  requireSpecific(branchScope);
  if (!Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0) {
    throw purchaseError('La cantidad a revertir debe ser un entero positivo', 400, 'INVALID_PURCHASE_QUANTITY');
  }
  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const [[received]] = await connection.query(
    `SELECT id FROM compra_inventario_aplicaciones
     WHERE empresa_id = ? AND sucursal_id = ? AND compra_id = ?
       AND compra_item_id = ? AND accion = 'RECEPCION'
     FOR UPDATE`,
    [empresaId, sucursalId, compraId, compraItemId]
  );
  if (!received) {
    throw purchaseError('La recepción de este ítem no está registrada; no es seguro revertirla', 409, 'PURCHASE_RECEIPT_NOT_FOUND');
  }

  const [[row]] = await connection.query(
    `SELECT existencia FROM producto_existencias
     WHERE empresa_id = ? AND sucursal_id = ? AND producto_id = ?
     FOR UPDATE`,
    [empresaId, sucursalId, productoId]
  );
  const anterior = Number(row?.existencia ?? -1);
  const nueva = anterior - Number(cantidad);
  if (!row || nueva < 0) {
    throw purchaseError('Stock insuficiente para anular la compra de forma segura', 409, 'UNSAFE_PURCHASE_REVERSAL');
  }
  await registerApplication(connection, [
    empresaId, sucursalId, compraId, compraItemId, productoId, 'ANULACION',
  ]);
  await connection.query(
    `UPDATE producto_existencias SET existencia = ?
     WHERE empresa_id = ? AND sucursal_id = ? AND producto_id = ?`,
    [nueva, empresaId, sucursalId, productoId]
  );
  await connection.query(
    `INSERT INTO producto_movimientos
     (empresa_id, sucursal_id, producto_id, tipo, cantidad,
      existencia_anterior, existencia_nueva, nota, usuario_id)
     VALUES (?, ?, ?, 'compra_anulacion', ?, ?, ?, ?, ?)`,
    [empresaId, sucursalId, productoId, -Number(cantidad), anterior, nueva,
      `Anulación compra ${numeroCompra}`, usuarioId]
  );
}

module.exports = {
  purchaseScopeClause,
  receiveProduct,
  requireSpecific,
  reverseProduct,
};
