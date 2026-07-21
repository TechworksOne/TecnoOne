/**
 * reparacionInventoryService.js
 * Sprint 1.24 – Reparaciones multisucursal.
 *
 * Contrato:
 *   - requireSpecific: lanza BRANCH_SPECIFIC_REQUIRED si no es modo specific.
 *   - reparacionScopeClause: cláusula SQL WHERE empresa+sucursal(es).
 *   - consumeRepuesto / reverseRepuesto: transacción atómica FOR UPDATE + ledger.
 *   - reverseAllRepuestos: revierte desde ledger (seguro si no hay ledger: early-return).
 *   - validateCajaScope / registerFinancialMovement / reverseFinancialMovements.
 *
 * Invariantes:
 *   - Nunca modifica repuestos.stock (columna legado).
 *   - Todas las lecturas de existencias usan repuesto_existencias.
 *   - Idempotencia garantizada por UNIQUE KEY en ledgers.
 */
'use strict';

const productInventoryService = require('./productInventoryService');
const repuestoInventoryService = require('./repuestoInventoryService');

function repairError(message, statusCode = 409, code = 'REPAIR_INVENTORY_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

// ── Scope helpers ─────────────────────────────────────────────────────────────

function requireSpecific(branchScope) {
  productInventoryService.requireSpecific(branchScope);
}

/**
 * Genera cláusula SQL AND empresa_id = ? AND sucursal_id [= ? | IN (?,...)]
 * para filtrar reparaciones según el modo del branchScope.
 */
function reparacionScopeClause(branchScope, alias = 'r') {
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

// ── Ledger de inventario ──────────────────────────────────────────────────────

async function insertInventoryLedger(connection, {
  empresaId, sucursalId, reparacionId, repuestoId, linea, cantidad, accion,
}) {
  try {
    await connection.query(
      `INSERT INTO reparacion_inventario_aplicaciones
       (empresa_id, sucursal_id, reparacion_id, repuesto_id, linea, cantidad, accion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, sucursalId, reparacionId, repuestoId, linea, cantidad, accion]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw repairError(
        'El inventario de esta reparación ya fue aplicado o revertido',
        409,
        'REPAIR_INVENTORY_ALREADY_APPLIED'
      );
    }
    throw error;
  }
}

// ── Operaciones de inventario de repuestos ────────────────────────────────────

/**
 * Consume un repuesto de la sucursal activa.
 * Requiere specific. Transaccional (el caller gestiona la transacción).
 */
async function consumeRepuesto(connection, {
  branchScope, reparacionId, repuestoId, cantidad, linea = 0, usuarioId,
}) {
  requireSpecific(branchScope);
  const empresaId  = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const repId = Number(repuestoId);
  const qty   = Number(cantidad);

  if (!Number.isInteger(qty) || qty <= 0) {
    throw repairError('La cantidad del repuesto debe ser un entero positivo', 400, 'INVALID_REPAIR_QUANTITY');
  }

  await insertInventoryLedger(connection, {
    empresaId, sucursalId, reparacionId, repuestoId: repId, linea, cantidad: qty, accion: 'APLICACION',
  });

  return repuestoInventoryService.changeWithConnection(connection, {
    branchScope,
    repuestoId: repId,
    cantidad: -qty,
    tipo: 'reparacion_salida',
    nota: `Repuesto consumido en reparación ${reparacionId}`,
    usuarioId,
  });
}

/**
 * Revierte el consumo de un repuesto a la sucursal activa.
 * Requiere specific. Transaccional (el caller gestiona la transacción).
 */
async function reverseRepuesto(connection, {
  branchScope, reparacionId, repuestoId, cantidad, linea = 0, usuarioId,
}) {
  requireSpecific(branchScope);
  const empresaId  = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const repId = Number(repuestoId);
  const qty   = Number(cantidad);

  if (!Number.isInteger(qty) || qty <= 0) {
    throw repairError('La cantidad a revertir debe ser un entero positivo', 400, 'INVALID_REPAIR_QUANTITY');
  }

  await insertInventoryLedger(connection, {
    empresaId, sucursalId, reparacionId, repuestoId: repId, linea, cantidad: qty, accion: 'REVERSA',
  });

  return repuestoInventoryService.changeWithConnection(connection, {
    branchScope,
    repuestoId: repId,
    cantidad: qty,
    tipo: 'reparacion_devolucion',
    nota: `Reversa de repuesto en reparación ${reparacionId}`,
    usuarioId,
  });
}

/**
 * Revierte todos los repuestos aplicados a una reparación.
 * Si no hay ledger registrado y no hay ítems, retorna { reversed: 0, unsafe: false }.
 * Si no hay ledger pero hay ítems, lanza REPAIR_INVENTORY_APPLICATION_NOT_FOUND
 * para bloquear reversión insegura de reparaciones históricas sin trazabilidad.
 */
async function reverseAllRepuestos(connection, {
  branchScope, reparacionId, usuarioId, fallbackItems = [],
}) {
  requireSpecific(branchScope);
  const empresaId  = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);

  const [applications] = await connection.query(
    `SELECT repuesto_id, linea, cantidad
     FROM reparacion_inventario_aplicaciones
     WHERE empresa_id = ? AND sucursal_id = ? AND reparacion_id = ? AND accion = 'APLICACION'
     ORDER BY linea FOR UPDATE`,
    [empresaId, sucursalId, reparacionId]
  );

  if (!applications.length) {
    // Si había ítems que implican movimientos de inventario, la reversión sería insegura.
    const physicalItems = fallbackItems.filter(Boolean);
    if (physicalItems.length > 0) {
      throw repairError(
        'La aplicación de inventario de esta reparación no está registrada; no es seguro anularla',
        409,
        'REPAIR_INVENTORY_APPLICATION_NOT_FOUND'
      );
    }
    return { reversed: 0, unsafe: false };
  }

  for (const item of applications) {
    await reverseRepuesto(connection, {
      branchScope,
      reparacionId,
      repuestoId: item.repuesto_id,
      cantidad:   item.cantidad,
      linea:      item.linea,
      usuarioId,
    });
  }

  return { reversed: applications.length, unsafe: false };
}

// ── Operaciones financieras ───────────────────────────────────────────────────

/**
 * Valida que una caja pertenezca a la sucursal activa.
 * cajaId nulo/vacío se ignora (no-op).
 */

function normalizeRegaliaType(tipoItem) {
  return String(tipoItem || '').toUpperCase() === 'PRODUCTO'
    ? 'PRODUCTO'
    : 'REPUESTO';
}

async function insertRegaliaLedger(connection, {
  empresaId,
  sucursalId,
  reparacionId,
  tipoItem,
  itemId,
  linea,
  cantidad,
  accion,
}) {
  try {
    await connection.query(
      `INSERT INTO reparacion_regalia_inventario_aplicaciones
       (empresa_id, sucursal_id, reparacion_id, tipo_item,
        item_id, linea, cantidad, accion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        sucursalId,
        reparacionId,
        normalizeRegaliaType(tipoItem),
        Number(itemId),
        Number(linea),
        Number(cantidad),
        accion,
      ]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw repairError(
        'El inventario de esta regalía ya fue aplicado o revertido',
        409,
        'REPAIR_GIFT_INVENTORY_ALREADY_APPLIED'
      );
    }
    throw error;
  }
}

async function changeProductWithConnection(connection, {
  branchScope,
  productoId,
  cantidad,
  tipo,
  nota,
  usuarioId,
}) {
  requireSpecific(branchScope);

  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const productId = Number(productoId);
  const diferencia = Number(cantidad);

  const [[producto]] = await connection.query(
    `SELECT id
     FROM productos
     WHERE id = ? AND empresa_id = ?
     FOR UPDATE`,
    [productId, empresaId]
  );

  if (!producto) {
    throw repairError(
      'Producto no encontrado',
      404,
      'PRODUCT_NOT_FOUND'
    );
  }

  await connection.query(
    `INSERT INTO producto_existencias
     (empresa_id, sucursal_id, producto_id, existencia)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE producto_id = VALUES(producto_id)`,
    [empresaId, sucursalId, productId]
  );

  const [[existencia]] = await connection.query(
    `SELECT existencia
     FROM producto_existencias
     WHERE empresa_id = ?
       AND sucursal_id = ?
       AND producto_id = ?
     FOR UPDATE`,
    [empresaId, sucursalId, productId]
  );

  const anterior = Number(existencia?.existencia || 0);
  const nueva = anterior + diferencia;

  if (nueva < 0) {
    throw repairError(
      `Stock insuficiente. Disponible: ${anterior}`,
      409,
      'INSUFFICIENT_STOCK'
    );
  }

  await connection.query(
    `UPDATE producto_existencias
     SET existencia = ?
     WHERE empresa_id = ?
       AND sucursal_id = ?
       AND producto_id = ?`,
    [nueva, empresaId, sucursalId, productId]
  );

  await connection.query(
    `INSERT INTO producto_movimientos
     (empresa_id, sucursal_id, producto_id, tipo, cantidad,
      existencia_anterior, existencia_nueva, nota, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      empresaId,
      sucursalId,
      productId,
      tipo,
      diferencia,
      anterior,
      nueva,
      nota || null,
      usuarioId || null,
    ]
  );

  return {
    stock_anterior: anterior,
    stock_nuevo: nueva,
    diferencia,
  };
}

async function consumeRegalia(connection, {
  branchScope,
  reparacionId,
  tipoItem,
  itemId,
  cantidad,
  linea = 0,
  usuarioId,
}) {
  requireSpecific(branchScope);

  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const tipo = normalizeRegaliaType(tipoItem);
  const qty = Number(cantidad);

  if (!Number.isInteger(qty) || qty <= 0) {
    throw repairError(
      'La cantidad de la regalía debe ser un entero positivo',
      400,
      'INVALID_REPAIR_GIFT_QUANTITY'
    );
  }

  await insertRegaliaLedger(connection, {
    empresaId,
    sucursalId,
    reparacionId,
    tipoItem: tipo,
    itemId,
    linea,
    cantidad: qty,
    accion: 'APLICACION',
  });

  if (tipo === 'PRODUCTO') {
    return changeProductWithConnection(connection, {
      branchScope,
      productoId: itemId,
      cantidad: -qty,
      tipo: 'reparacion_regalo_salida',
      nota: `Producto regalado en reparación ${reparacionId}`,
      usuarioId,
    });
  }

  return repuestoInventoryService.changeWithConnection(connection, {
    branchScope,
    repuestoId: Number(itemId),
    cantidad: -qty,
    tipo: 'reparacion_regalo_salida',
    nota: `Repuesto regalado en reparación ${reparacionId}`,
    usuarioId,
  });
}

async function reverseRegalia(connection, {
  branchScope,
  reparacionId,
  tipoItem,
  itemId,
  cantidad,
  linea = 0,
  usuarioId,
}) {
  requireSpecific(branchScope);

  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);
  const tipo = normalizeRegaliaType(tipoItem);
  const qty = Number(cantidad);

  await insertRegaliaLedger(connection, {
    empresaId,
    sucursalId,
    reparacionId,
    tipoItem: tipo,
    itemId,
    linea,
    cantidad: qty,
    accion: 'REVERSA',
  });

  if (tipo === 'PRODUCTO') {
    return changeProductWithConnection(connection, {
      branchScope,
      productoId: itemId,
      cantidad: qty,
      tipo: 'reparacion_regalo_reversa',
      nota: `Reversa de regalía de reparación ${reparacionId}`,
      usuarioId,
    });
  }

  return repuestoInventoryService.changeWithConnection(connection, {
    branchScope,
    repuestoId: Number(itemId),
    cantidad: qty,
    tipo: 'reparacion_regalo_reversa',
    nota: `Reversa de regalía de reparación ${reparacionId}`,
    usuarioId,
  });
}

async function reverseAllRegalias(connection, {
  branchScope,
  reparacionId,
  usuarioId,
  fallbackItems = [],
}) {
  requireSpecific(branchScope);

  const empresaId = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);

  const [applications] = await connection.query(
    `SELECT tipo_item, item_id, linea, cantidad
     FROM reparacion_regalia_inventario_aplicaciones
     WHERE empresa_id = ?
       AND sucursal_id = ?
       AND reparacion_id = ?
       AND accion = 'APLICACION'
     ORDER BY linea
     FOR UPDATE`,
    [empresaId, sucursalId, reparacionId]
  );

  if (!applications.length) {
    if (Array.isArray(fallbackItems) && fallbackItems.filter(Boolean).length) {
      throw repairError(
        'Las regalías no tienen ledger; no es seguro revertirlas',
        409,
        'REPAIR_GIFT_APPLICATION_NOT_FOUND'
      );
    }

    return { reversed: 0, unsafe: false };
  }

  for (const item of applications) {
    await reverseRegalia(connection, {
      branchScope,
      reparacionId,
      tipoItem: item.tipo_item,
      itemId: item.item_id,
      cantidad: item.cantidad,
      linea: item.linea,
      usuarioId,
    });
  }

  return {
    reversed: applications.length,
    unsafe: false,
  };
}

async function validateCajaScope(connection, { branchScope, cajaId }) {
  if (cajaId === undefined || cajaId === null || cajaId === '') return;
  requireSpecific(branchScope);
  const [[caja]] = await connection.query(
    `SELECT id FROM cajas
     WHERE id = ? AND empresa_id = ? AND sucursal_id = ? AND activa = 1
     LIMIT 1`,
    [Number(cajaId), Number(branchScope.empresaId), Number(branchScope.sucursalId)]
  );
  if (!caja) {
    throw repairError('La caja no pertenece a la sucursal activa', 403, 'REPAIR_CASH_REGISTER_SCOPE_MISMATCH');
  }
}

/**
 * Registra un movimiento financiero en el ledger de reparaciones.
 * Para efectivo, exige cajaId de la misma sucursal.
 */
async function registerFinancialMovement(connection, {
  branchScope, reparacionId, pagoIndice, metodo, montoCentavos, cajaId, usuarioId,
}) {
  requireSpecific(branchScope);
  const normalizedMethod = String(metodo || '').toUpperCase();
  const amount = Number(montoCentavos);

  if (!Number.isInteger(amount) || amount <= 0) {
    throw repairError(
      'El monto financiero debe ser un entero positivo en centavos',
      400,
      'INVALID_REPAIR_FINANCIAL_AMOUNT'
    );
  }

  if (normalizedMethod === 'EFECTIVO' && (cajaId === undefined || cajaId === null || cajaId === '')) {
    throw repairError(
      'Debe seleccionar una caja física para pagos en efectivo',
      400,
      'REPAIR_CASH_REGISTER_REQUIRED'
    );
  }

  await validateCajaScope(connection, {
    branchScope,
    cajaId: normalizedMethod === 'EFECTIVO' ? cajaId : null,
  });

  try {
    await connection.query(
      `INSERT INTO reparacion_movimientos_financieros
       (empresa_id, sucursal_id, reparacion_id, pago_indice, accion, metodo,
        monto_centavos, caja_id, usuario_id)
       VALUES (?, ?, ?, ?, 'INGRESO', ?, ?, ?, ?)`,
      [
        Number(branchScope.empresaId),
        Number(branchScope.sucursalId),
        reparacionId,
        Number(pagoIndice),
        normalizedMethod,
        amount,
        normalizedMethod === 'EFECTIVO' ? Number(cajaId) : null,
        usuarioId || null,
      ]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw repairError(
        'El movimiento financiero de esta reparación ya fue aplicado',
        409,
        'REPAIR_FINANCIAL_ALREADY_APPLIED'
      );
    }
    throw error;
  }
}

/**
 * Revierte todos los movimientos financieros de una reparación (anulación).
 */
async function reverseFinancialMovements(connection, { branchScope, reparacionId, usuarioId }) {
  requireSpecific(branchScope);
  const empresaId  = Number(branchScope.empresaId);
  const sucursalId = Number(branchScope.sucursalId);

  const [movements] = await connection.query(
    `SELECT pago_indice, metodo, monto_centavos, caja_id
     FROM reparacion_movimientos_financieros
     WHERE empresa_id = ? AND sucursal_id = ? AND reparacion_id = ? AND accion = 'INGRESO'
     ORDER BY pago_indice FOR UPDATE`,
    [empresaId, sucursalId, reparacionId]
  );

  for (const movement of movements) {
    try {
      await connection.query(
        `INSERT INTO reparacion_movimientos_financieros
         (empresa_id, sucursal_id, reparacion_id, pago_indice, accion, metodo,
          monto_centavos, caja_id, usuario_id)
         VALUES (?, ?, ?, ?, 'REVERSA', ?, ?, ?, ?)`,
        [
          empresaId,
          sucursalId,
          reparacionId,
          Number(movement.pago_indice),
          movement.metodo,
          Number(movement.monto_centavos),
          movement.caja_id,
          usuarioId || null,
        ]
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw repairError(
          'Los movimientos financieros de esta reparación ya fueron revertidos',
          409,
          'REPAIR_FINANCIAL_ALREADY_REVERSED'
        );
      }
      throw error;
    }
  }

  return { count: movements.length };
}

module.exports = {
  consumeRegalia,
  consumeRepuesto,
  reparacionScopeClause,
  registerFinancialMovement,
  requireSpecific,
  reverseAllRegalias,
  reverseAllRepuestos,
  reverseFinancialMovements,
  reverseRegalia,
  reverseRepuesto,
  validateCajaScope,
};
