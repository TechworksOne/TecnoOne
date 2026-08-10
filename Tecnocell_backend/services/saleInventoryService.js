const cajaSesionModel = require('../models/cajaSesionModel');
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

async function priceSaleItems(connection, { branchScope, items }) {
  requireSpecific(branchScope);
  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const priced = [];

  for (let index = 0; index < items.length; index += 1) {
    const normalized = normalizeItem(items[index], index);
    if (!normalized) {
      throw saleError(`El servicio de la linea ${index + 1} no tiene un precio autorizado en catalogo`, 400, 'SALE_SERVICE_PRICE_NOT_AUTHORIZED');
    }
    const isProduct = normalized.source === 'PRODUCTO';
    const catalog = isProduct ? 'productos' : 'repuestos';
    const existence = isProduct ? 'producto_existencias' : 'repuesto_existencias';
    const refColumn = isProduct ? 'producto_id' : 'repuesto_id';
    const priceExpression = isProduct ? 'ROUND(c.precio_venta * 100)' : 'c.precio_publico';
    const [[row]] = await connection.query(
      `SELECT c.id, c.nombre, ${priceExpression} AS precio_centavos,
              COALESCE(e.existencia, 0) AS existencia
       FROM ${catalog} c
       LEFT JOIN ${existence} e
         ON e.empresa_id = c.empresa_id AND e.${refColumn} = c.id AND e.sucursal_id = ?
       WHERE c.id = ? AND c.empresa_id = ? LIMIT 1 FOR UPDATE`,
      [sucursalId, normalized.refId, empresaId]
    );
    if (!row) throw saleError('Articulo no encontrado en la empresa', 404, 'SALE_ITEM_NOT_FOUND');
    if (Number(row.existencia) < normalized.cantidad) {
      throw saleError(`Stock insuficiente para "${row.nombre}"`, 409, 'INSUFFICIENT_SALE_STOCK');
    }
    const unitPrice = Number(row.precio_centavos);
    if (!Number.isInteger(unitPrice) || unitPrice < 0) {
      throw saleError(`Precio no valido para "${row.nombre}"`, 409, 'INVALID_AUTHORIZED_SALE_PRICE');
    }
    priced.push({
      ...items[index],
      source: normalized.source,
      ref_id: normalized.refId,
      refId: normalized.refId,
      nombre: row.nombre,
      cantidad: normalized.cantidad,
      precio_unitario: unitPrice,
      precioUnit: unitPrice,
      subtotal: unitPrice * normalized.cantidad,
    });
  }

  return {
    items: priced,
    subtotal: priced.reduce((sum, item) => sum + item.subtotal, 0),
  };
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
  branchScope, ventaId, pagoIndice, metodo, monto, usuarioId, referencia,
}) {
  requireSpecific(branchScope);

  const normalizedMethod = String(metodo || '').toUpperCase();
  const amount = Number(monto);

  if (!Number.isInteger(amount) || amount <= 0) {
    throw saleError(
      'El monto financiero debe ser un entero positivo en centavos',
      400,
      'INVALID_SALE_FINANCIAL_AMOUNT'
    );
  }

  let sesionCaja = null;

  if (normalizedMethod === 'EFECTIVO') {
    sesionCaja = await cajaSesionModel.resolverActivaParaOperacion(
      connection,
      {
        empresaId: Number(branchScope.empresaId),
        sucursalId: Number(branchScope.sucursalId),
        usuarioId,
      }
    );

    // Defensa adicional de scope.
    await validateCajaScope(connection, {
      branchScope,
      cajaId: sesionCaja.caja_id,
    });
  }

  try {
    await connection.query(
      `INSERT INTO venta_movimientos_financieros
       (empresa_id, sucursal_id, venta_id, pago_indice, accion, metodo,
        monto_centavos, caja_id, caja_sesion_id, referencia, usuario_id)
       VALUES (?, ?, ?, ?, 'INGRESO', ?, ?, ?, ?, ?, ?)`,
      [
        Number(branchScope.empresaId),
        Number(branchScope.sucursalId),
        Number(ventaId),
        Number(pagoIndice),
        normalizedMethod,
        amount,
        sesionCaja ? Number(sesionCaja.caja_id) : null,
        sesionCaja ? Number(sesionCaja.id) : null,
        referencia || null,
        usuarioId || null,
      ]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw saleError(
        'El movimiento financiero de la venta ya fue aplicado',
        409,
        'SALE_FINANCIAL_ALREADY_APPLIED'
      );
    }
    throw error;
  }

  return {
    requiresLegacyBankMovement: normalizedMethod !== 'EFECTIVO',
    cajaId: sesionCaja ? Number(sesionCaja.caja_id) : null,
    cajaSesionId: sesionCaja ? Number(sesionCaja.id) : null,
  };
}

async function reverseFinancialMovements(connection, {
  branchScope, ventaId, usuarioId,
}) {
  requireSpecific(branchScope);

  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);

  const [movements] = await connection.query(
    `SELECT
       pago_indice,
       metodo,
       monto_centavos,
       caja_id,
       caja_sesion_id,
       referencia
     FROM venta_movimientos_financieros
     WHERE empresa_id = ?
       AND sucursal_id = ?
       AND venta_id = ?
       AND accion = 'INGRESO'
     ORDER BY pago_indice
     FOR UPDATE`,
    [empresaId, sucursalId, Number(ventaId)]
  );

  const hasCash = movements.some(
    movement => String(movement.metodo || '').toUpperCase() === 'EFECTIVO'
  );

  let sesionReversa = null;

  if (hasCash) {
    sesionReversa = await cajaSesionModel.resolverActivaParaOperacion(
      connection,
      {
        empresaId,
        sucursalId,
        usuarioId,
      }
    );

    await validateCajaScope(connection, {
      branchScope,
      cajaId: sesionReversa.caja_id,
    });
  }

  let hasNonCash = false;

  for (const movement of movements) {
    const metodo = String(movement.metodo || '').toUpperCase();
    const esEfectivo = metodo === 'EFECTIVO';

    hasNonCash = hasNonCash || !esEfectivo;

    try {
      await connection.query(
        `INSERT INTO venta_movimientos_financieros
         (empresa_id, sucursal_id, venta_id, pago_indice, accion, metodo,
          monto_centavos, caja_id, caja_sesion_id, referencia, usuario_id)
         VALUES (?, ?, ?, ?, 'REVERSA', ?, ?, ?, ?, ?, ?)`,
        [
          empresaId,
          sucursalId,
          Number(ventaId),
          Number(movement.pago_indice),
          metodo,
          Number(movement.monto_centavos),
          esEfectivo ? Number(sesionReversa.caja_id) : null,
          esEfectivo ? Number(sesionReversa.id) : null,
          movement.referencia || null,
          usuarioId || null,
        ]
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw saleError(
          'Los movimientos financieros de esta venta ya fueron revertidos',
          409,
          'SALE_FINANCIAL_ALREADY_REVERSED'
        );
      }
      throw error;
    }
  }

  return { hasNonCash, count: movements.length };
}

module.exports = {
  applySale,
  priceSaleItems,
  registerFinancialMovement,
  requireSpecific,
  reverseFinancialMovements,
  reverseSale,
  saleScopeClause,
  validateCajaScope,
};
