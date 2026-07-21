const assert = require('assert');

require.cache[require.resolve('../config/database')] = { exports: {} };
const service = require('../services/saleInventoryService');

const specific = { mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] };
const consolidated = { mode: 'consolidated', empresaId: 10, sucursalId: null, allowedSucursalIds: [7, 8] };

function connection({ stock = 5, applications = [], financial = [], duplicate = false, caja = true } = {}) {
  return {
    calls: [],
    async query(sql, params) {
      this.calls.push({ sql, params });
      if (/SELECT id, nombre FROM productos/.test(sql)) return [[{ id: params[0], nombre: 'Producto' }]];
      if (/SELECT id, nombre FROM repuestos/.test(sql)) return [[{ id: params[0], nombre: 'Repuesto' }]];
      if (/SELECT existencia FROM (producto|repuesto)_existencias/.test(sql)) return [[{ existencia: stock }]];
      if (/FROM venta_inventario_aplicaciones/.test(sql)) return [applications];
      if (/FROM venta_movimientos_financieros/.test(sql)) return [financial];
      if (/SELECT id FROM cajas/.test(sql)) return [[caja ? { id: params[0] } : undefined].filter(Boolean)];
      if (/INSERT INTO venta_inventario_aplicaciones/.test(sql) && duplicate) {
        const error = new Error('duplicate'); error.code = 'ER_DUP_ENTRY'; throw error;
      }
      return [{ affectedRows: 1 }];
    },
  };
}

async function main() {
  const local = service.saleScopeClause(specific);
  assert.deepStrictEqual(local.params, [10, 7]);
  assert.match(local.sql, /sucursal_id = \?/);
  const all = service.saleScopeClause(consolidated);
  assert.deepStrictEqual(all.params, [10, 7, 8]);
  assert.match(all.sql, /IN \(\?,\?\)/);

  await assert.rejects(
    service.applySale(connection(), { branchScope: consolidated, ventaId: 1, items: [] }),
    error => error.code === 'BRANCH_SPECIFIC_REQUIRED'
  );

  const applied = connection({ stock: 5 });
  await service.applySale(applied, {
    branchScope: specific, ventaId: 20, usuarioId: 9,
    items: [
      { source: 'PRODUCTO', refId: 30, cantidad: 2 },
      { source: 'REPUESTO', refId: 40, cantidad: 1 },
      { source: 'SERVICIO', refId: 50, cantidad: 1 },
    ],
  });
  const locks = applied.calls.filter(c => /SELECT existencia/.test(c.sql));
  assert.strictEqual(locks.length, 2);
  assert.ok(locks.every(c => /FOR UPDATE/.test(c.sql)));
  assert.ok(applied.calls.some(c => /UPDATE producto_existencias/.test(c.sql)));
  assert.ok(applied.calls.some(c => /UPDATE repuesto_existencias/.test(c.sql)));
  assert.strictEqual(applied.calls.filter(c => /INSERT INTO venta_inventario_aplicaciones/.test(c.sql)).length, 2);

  await assert.rejects(
    service.applySale(connection({ stock: 1 }), {
      branchScope: specific, ventaId: 20,
      items: [{ source: 'PRODUCTO', refId: 30, cantidad: 2 }],
    }),
    error => error.code === 'INSUFFICIENT_SALE_STOCK'
  );
  await assert.rejects(
    service.applySale(connection({ duplicate: true }), {
      branchScope: specific, ventaId: 20,
      items: [{ source: 'PRODUCTO', refId: 30, cantidad: 1 }],
    }),
    error => error.code === 'SALE_INVENTORY_ALREADY_APPLIED'
  );

  const reversed = connection({
    stock: 3,
    applications: [
      { linea: 0, tipo_item: 'PRODUCTO', referencia_id: 30, cantidad: 2 },
      { linea: 1, tipo_item: 'REPUESTO', referencia_id: 40, cantidad: 1 },
    ],
  });
  await service.reverseSale(reversed, { branchScope: specific, ventaId: 20, usuarioId: 9 });
  assert.strictEqual(reversed.calls.filter(c => /INSERT INTO venta_inventario_aplicaciones/.test(c.sql)).length, 2);
  assert.ok(reversed.calls.some(c => /INSERT INTO (producto|repuesto)_movimientos/.test(c.sql)
    && c.params.includes('venta_anulacion')));

  await service.reverseSale(connection({ applications: [] }), {
    branchScope: specific, ventaId: 21,
    items: [{ source: 'SERVICIO', refId: 50, cantidad: 1 }],
  });

  await assert.rejects(
    service.validateCajaScope(connection({ caja: false }), { branchScope: specific, cajaId: 99 }),
    error => error.code === 'SALE_CASH_REGISTER_SCOPE_MISMATCH'
  );

  await assert.rejects(
    service.registerFinancialMovement(connection(), {
      branchScope: specific, ventaId: 20, pagoIndice: 0, metodo: 'EFECTIVO', monto: 100,
    }),
    error => error.code === 'SALE_CASH_REGISTER_REQUIRED'
  );
  await assert.rejects(
    service.registerFinancialMovement(connection({ caja: false }), {
      branchScope: specific, ventaId: 20, pagoIndice: 0, metodo: 'EFECTIVO', monto: 100, cajaId: 99,
    }),
    error => error.code === 'SALE_CASH_REGISTER_SCOPE_MISMATCH'
  );
  const cash = connection();
  const cashResult = await service.registerFinancialMovement(cash, {
    branchScope: specific, ventaId: 20, pagoIndice: 0, metodo: 'EFECTIVO', monto: 100, cajaId: 3,
  });
  assert.strictEqual(cashResult.requiresLegacyBankMovement, false);
  const cashInsert = cash.calls.find(c => /INSERT INTO venta_movimientos_financieros/.test(c.sql));
  assert.deepStrictEqual(cashInsert.params.slice(0, 3), [10, 7, 20]);

  const transfer = connection();
  const transferResult = await service.registerFinancialMovement(transfer, {
    branchScope: specific, ventaId: 20, pagoIndice: 1, metodo: 'TRANSFERENCIA', monto: 250,
  });
  assert.strictEqual(transferResult.requiresLegacyBankMovement, true);
  assert.strictEqual(transfer.calls.some(c => /SELECT id FROM cajas/.test(c.sql)), false);

  const financialReversal = connection({
    financial: [{ pago_indice: 0, metodo: 'EFECTIVO', monto_centavos: 100, caja_id: 3, referencia: null }],
  });
  const reversalResult = await service.reverseFinancialMovements(financialReversal, {
    branchScope: specific, ventaId: 20, usuarioId: 9,
  });
  assert.deepStrictEqual(reversalResult, { hasNonCash: false, count: 1 });
  assert.ok(financialReversal.calls.some(c => /ORDER BY pago_indice FOR UPDATE/.test(c.sql)));

  console.log('OK saleInventoryService: inventario y finanzas scoped, locks, caja e idempotencia');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
