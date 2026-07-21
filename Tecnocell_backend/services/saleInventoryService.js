const productInventoryService = require('./productInventoryService');

function saleError(message, statusCode = 409, code = 'SALE_INVENTORY_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requireSpecific(branchScope) {
  productInventoryService.requireSpecific(branchScope);
}

function saleScopeClause(branchScope, alias = 'v') {
  const empresaId = Number(branchScope.empresaId);
  if (branchScope.mode === 'specific') {
    return { sql: ` AND ${alias}.empresa_id = ? AND ${alias}.sucursal_id = ?`, params: [empresaId, Number(branchScope.sucursalId)] };
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

function normalizeItem(item, index) {
  const source = String(item.source || item.tipo || '').toUpperCase();
  if (source === 'SERVICIO' || source === 'SERVICIOS') return null;
  if (!['PRODUCTO', 'PRODUCTOS', 'REPUESTO', 'REPUESTOS'].includes(source)) {
    throw saleError(`Tipo de artículo inválido en línea ${index + 1}`, 400, 'INVALID_SALE_ITEM_TYPE');
  }
  const refId = Number(item.refId || item.ref_id || item.id);
  const cantidad = Number(item.cantidad);
  if (!Number.isInteger(refId) || !Number.isInteger(cantidad) || cantidad <= 0) {
    throw saleError(`Artículo o cantidad inválida en línea ${index + 1}`, 400, 'INVALID_SALE_ITEM');
  }
  return { source: source.startsWith('PRODUCTO') ? 'PRODUCTO' : 'REPUESTO', refId, cantidad, linea: index };
}

async function insertLedger(connection, data) {
  try {
    await connection.query(
      `INSERT INTO venta_inventario_aplicaciones
       (empresa_id, sucursal_id, venta_id, linea, tipo_item, referencia_id, cantidad, accion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.empresaId, data.sucursalId, data.ventaId, data.linea,
        data.source, data.refId, data.cantidad, data.accion]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw saleError('El inventario de esta venta ya fue aplicado o revertido', 409, 'SALE_INVENTORY_ALREADY_APPLIED');
    }
    throw error;
  }
}

async function changeStock(connection, data) {
  const isProduct = data.source === 'PRODUCTO';
  const catalog = isProduct ? 'productos' : 'repuestos';
  const existence = isProduct ? 'producto_existencias' : 'repuesto_existencias';
  const refColumn = isProduct ? 'producto_id' : 'repuesto_id';
  const movement = isProduct ? 'producto_movimientos' : 'repuesto_movimientos';

  const [[item]] = await connection.query(
    `SELECT id, nombre FROM ${catalog} WHERE id = ? AND empresa_id = ? FOR UPDATE`,
    [data.refId, data.empresaId]
  );
  if (!item) throw saleError(`${data.source === 'PRODUCTO' ? 'Producto' : 'Repuesto'} no encontrado`, 404, 'SALE_ITEM_NOT_FOUND');

  await connection.query(
    `INSERT INTO ${existence} (empresa_id, sucursal_id, ${refColumn}, existencia)
     VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE ${refColumn} = VALUES(${refColumn})`,
    [data.empresaId, data.sucursalId, data.refId]
  );
  const [[row]] = await connection.query(
    `SELECT existencia FROM ${existence}
     WHERE empresa_id = ? AND sucursal_id = ? AND ${refColumn} = ? FOR UPDATE`,
    [data.empresaId, data.sucursalId, data.refId]
  );
  const anterior = Number(row.existencia);
  const nueva = anterior + data.delta;
  if (nueva < 0) {
    throw saleError(`Stock insuficiente para "${item.nombre}". Disponible: ${anterior}`, 409, 'INSUFFICIENT_SALE_STOCK');
  }

  await insertLedger(connection, data);
  await connection.query(
    `UPDATE ${existence} SET existencia = ?
     WHERE empresa_id = ? AND sucursal_id = ? AND ${refColumn} = ?`,
    [nueva, data.empresaId, data.sucursalId, data.refId]
  );
  await connection.query(
    `INSERT INTO ${movement}
     (empresa_id, sucursal_id, ${refColumn}, tipo, cantidad,
      existencia_anterior, existencia_nueva, nota, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.empresaId, data.sucursalId, data.refId,
      data.accion === 'APLICACION' ? 'venta_salida' : 'venta_anulacion',
      data.delta, anterior, nueva, `${data.accion === 'APLICACION' ? 'Venta' : 'Anulación venta'} ${data.ventaId}`, data.usuarioId]
  );
}

async function applySale(connection, { branchScope, ventaId, items, usuarioId }) {
  requireSpecific(branchScope);
  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  for (let index = 0; index < items.length; index += 1) {
    const item = normalizeItem(items[index], index);
    if (!item) continue;
    await changeStock(connection, {
      ...item, empresaId, sucursalId, ventaId: Number(ventaId), usuarioId,
      delta: -item.cantidad, accion: 'APLICACION',
    });
  }
}

async function reverseSale(connection, { branchScope, ventaId, usuarioId, items = [] }) {
  requireSpecific(branchScope);
  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const [applications] = await connection.query(
    `SELECT linea, tipo_item, referencia_id, cantidad
     FROM venta_inventario_aplicaciones
     WHERE empresa_id = ? AND sucursal_id = ? AND venta_id = ? AND accion = 'APLICACION'
     ORDER BY linea FOR UPDATE`,
    [empresaId, sucursalId, Number(ventaId)]
  );
  if (!applications.length) {
    const inventoryItems = Array.isArray(items)
      ? items.map((item, index) => normalizeItem(item, index)).filter(Boolean)
      : [];
    if (!inventoryItems.length) return;
    throw saleError('La aplicación de inventario de esta venta no está registrada; no es seguro anularla', 409, 'SALE_INVENTORY_APPLICATION_NOT_FOUND');
  }
  for (const item of applications) {
    await changeStock(connection, {
      source: item.tipo_item, refId: Number(item.referencia_id), cantidad: Number(item.cantidad),
      linea: Number(item.linea), empresaId, sucursalId, ventaId: Number(ventaId), usuarioId,
      delta: Number(item.cantidad), accion: 'REVERSA',
    });
  }
}

async function validateCajaScope(connection, { branchScope, cajaId }) {
  if (cajaId === undefined || cajaId === null || cajaId === '') return;
  requireSpecific(branchScope);
  const [[caja]] = await connection.query(
    `SELECT id FROM cajas
     WHERE id = ? AND empresa_id = ? AND sucursal_id = ? AND activa = 1 LIMIT 1`,
    [Number(cajaId), Number(branchScope.empresaId), Number(branchScope.sucursalId)]
  );
  if (!caja) throw saleError('La caja no pertenece a la sucursal activa', 403, 'SALE_CASH_REGISTER_SCOPE_MISMATCH');
}

async function registerFinancialMovement(connection, {
  branchScope, ventaId, pagoIndice, metodo, monto, cajaId, usuarioId, referencia,
}) {
  requireSpecific(branchScope);
  const normalizedMethod = String(metodo || '').toUpperCase();
  const amount = Number(monto);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw saleError('El monto financiero debe ser un entero positivo en centavos', 400, 'INVALID_SALE_FINANCIAL_AMOUNT');
  }
  if (normalizedMethod === 'EFECTIVO' && (cajaId === undefined || cajaId === null || cajaId === '')) {
    throw saleError('Debe seleccionar una caja física para pagos en efectivo', 400, 'SALE_CASH_REGISTER_REQUIRED');
  }
  await validateCajaScope(connection, {
    branchScope,
    cajaId: normalizedMethod === 'EFECTIVO' ? cajaId : null,
  });
  try {
    await connection.query(
      `INSERT INTO venta_movimientos_financieros
       (empresa_id, sucursal_id, venta_id, pago_indice, accion, metodo,
        monto_centavos, caja_id, referencia, usuario_id)
       VALUES (?, ?, ?, ?, 'INGRESO', ?, ?, ?, ?, ?)`,
      [Number(branchScope.empresaId), Number(branchScope.sucursalId), Number(ventaId),
        Number(pagoIndice), normalizedMethod, amount,
        normalizedMethod === 'EFECTIVO' ? Number(cajaId) : null,
        referencia || null, usuarioId || null]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw saleError('El movimiento financiero de la venta ya fue aplicado', 409, 'SALE_FINANCIAL_ALREADY_APPLIED');
    }
    throw error;
  }
  return { requiresLegacyBankMovement: normalizedMethod !== 'EFECTIVO' };
}

async function reverseFinancialMovements(connection, { branchScope, ventaId, usuarioId }) {
  requireSpecific(branchScope);
  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const [movements] = await connection.query(
    `SELECT pago_indice, metodo, monto_centavos, caja_id, referencia
     FROM venta_movimientos_financieros
     WHERE empresa_id = ? AND sucursal_id = ? AND venta_id = ? AND accion = 'INGRESO'
     ORDER BY pago_indice FOR UPDATE`,
    [empresaId, sucursalId, Number(ventaId)]
  );
  let hasNonCash = false;
  for (const movement of movements) {
    hasNonCash = hasNonCash || movement.metodo !== 'EFECTIVO';
    try {
      await connection.query(
        `INSERT INTO venta_movimientos_financieros
         (empresa_id, sucursal_id, venta_id, pago_indice, accion, metodo,
          monto_centavos, caja_id, referencia, usuario_id)
         VALUES (?, ?, ?, ?, 'REVERSA', ?, ?, ?, ?, ?)`,
        [empresaId, sucursalId, Number(ventaId), Number(movement.pago_indice),
          movement.metodo, Number(movement.monto_centavos), movement.caja_id,
          movement.referencia, usuarioId || null]
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw saleError('Los movimientos financieros de esta venta ya fueron revertidos', 409, 'SALE_FINANCIAL_ALREADY_REVERSED');
      }
      throw error;
    }
  }
  return { hasNonCash, count: movements.length };
}

module.exports = {
  applySale,
  registerFinancialMovement,
  requireSpecific,
  reverseFinancialMovements,
  reverseSale,
  saleScopeClause,
  validateCajaScope,
};
