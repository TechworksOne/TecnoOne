const assert = require('assert');

require.cache[require.resolve('../config/database')] = { exports: {} };
const service = require('../services/repuestoInventoryService');

const specific = { mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] };
const consolidated = { mode: 'consolidated', empresaId: 10, sucursalId: null, allowedSucursalIds: [7, 8] };

function connection(stock = 4, { receipt = true, duplicate = false } = {}) {
  return {
    calls: [],
    async query(sql, params) {
      this.calls.push({ sql, params });
      if (/SELECT id FROM repuestos/.test(sql)) return [[{ id: params[0] }]];
      if (/SELECT existencia FROM repuesto_existencias/.test(sql)) return [[{ existencia: stock }]];
      if (/SELECT id FROM repuesto_movimientos/.test(sql)) return [[receipt ? { id: 1 } : undefined].filter(Boolean)];
      if (/INSERT INTO repuesto_movimientos/.test(sql) && duplicate) {
        const error = new Error('duplicate'); error.code = 'ER_DUP_ENTRY'; throw error;
      }
      return [{ affectedRows: 1 }];
    },
  };
}

async function main() {
  const local = service.stockProjection(specific);
  assert.deepStrictEqual(local.params, [7]);
  assert.match(local.sql, /re\.sucursal_id = \?/);
  const all = service.stockProjection(consolidated);
  assert.deepStrictEqual(all.params, [7, 8]);
  assert.match(all.sql, /SUM\(re\.existencia\)/);

  await assert.rejects(
    service.receivePurchase(connection(), { branchScope: consolidated, cantidad: 2 }),
    error => error.code === 'BRANCH_SPECIFIC_REQUIRED'
  );

  const received = connection(4);
  await service.receivePurchase(received, {
    branchScope: specific, compraId: 20, compraItemId: 30,
    repuestoId: 40, cantidad: 2, numeroCompra: 'COM-20',
  });
  assert.match(received.calls.find(c => /SELECT existencia/.test(c.sql)).sql, /FOR UPDATE/);
  assert.deepStrictEqual(
    received.calls.find(c => /UPDATE repuesto_existencias/.test(c.sql)).params,
    [6, 10, 7, 40]
  );

  await assert.rejects(
    service.receivePurchase(connection(4, { duplicate: true }), {
      branchScope: specific, compraId: 20, compraItemId: 30,
      repuestoId: 40, cantidad: 2, numeroCompra: 'COM-20',
    }),
    error => error.code === 'REPUESTO_MOVEMENT_ALREADY_APPLIED'
  );

  await assert.rejects(
    service.reversePurchase(connection(1), {
      branchScope: specific, compraId: 20, compraItemId: 30,
      repuestoId: 40, cantidad: 2, numeroCompra: 'COM-20',
    }),
    error => error.code === 'INSUFFICIENT_REPUESTO_STOCK'
  );

  const reversed = connection(5);
  await service.reversePurchase(reversed, {
    branchScope: specific, compraId: 20, compraItemId: 30,
    repuestoId: 40, cantidad: 2, numeroCompra: 'COM-20',
  });
  assert.deepStrictEqual(
    reversed.calls.find(c => /UPDATE repuesto_existencias/.test(c.sql)).params,
    [3, 10, 7, 40]
  );

  console.log('OK repuestoInventoryService: scope, suma, locks, idempotencia y no negativo');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
