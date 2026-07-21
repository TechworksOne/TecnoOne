const assert = require('assert');

require.cache[require.resolve('../config/database')] = { exports: {} };
const service = require('../services/purchaseInventoryService');

const specific = { mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] };
const consolidated = { mode: 'consolidated', empresaId: 10, sucursalId: null, allowedSucursalIds: [7, 8] };

function connectionWithStock(stock, { received = true, duplicate = false } = {}) {
  return {
    calls: [],
    async query(sql, params) {
      this.calls.push({ sql, params });
      if (/SELECT id FROM compra_inventario_aplicaciones/.test(sql)) {
        return [[received ? { id: 1 } : undefined].filter(Boolean)];
      }
      if (/SELECT existencia FROM producto_existencias/.test(sql)) return [[{ existencia: stock }]];
      if (/INSERT INTO compra_inventario_aplicaciones/.test(sql) && duplicate) {
        const error = new Error('duplicate'); error.code = 'ER_DUP_ENTRY'; throw error;
      }
      return [{ affectedRows: 1 }];
    },
  };
}

async function main() {
  const local = service.purchaseScopeClause(specific);
  assert.deepStrictEqual(local.params, [10, 7]);
  assert.match(local.sql, /sucursal_id = \?/);

  const all = service.purchaseScopeClause(consolidated);
  assert.deepStrictEqual(all.params, [10, 7, 8]);
  assert.match(all.sql, /sucursal_id IN \(\?,\?\)/);

  await assert.rejects(
    service.receiveProduct(connectionWithStock(3), { branchScope: consolidated }),
    error => error.code === 'BRANCH_SPECIFIC_REQUIRED'
  );
  await assert.rejects(
    service.receiveProduct(connectionWithStock(3), {
      branchScope: specific, cantidad: -1,
    }),
    error => error.code === 'INVALID_PURCHASE_QUANTITY'
  );

  const receiveConnection = connectionWithStock(4);
  await service.receiveProduct(receiveConnection, {
    branchScope: specific, compraId: 20, compraItemId: 30,
    productoId: 40, cantidad: 2, usuarioId: 5, numeroCompra: 'COM-20',
  });
  assert.match(receiveConnection.calls.find(c => /SELECT existencia/.test(c.sql)).sql, /FOR UPDATE/);
  assert.deepStrictEqual(
    receiveConnection.calls.find(c => /UPDATE producto_existencias/.test(c.sql)).params,
    [6, 10, 7, 40]
  );
  assert.ok(receiveConnection.calls.some(c => /INSERT INTO producto_movimientos/.test(c.sql)));

  await assert.rejects(
    service.receiveProduct(connectionWithStock(4, { duplicate: true }), {
      branchScope: specific, compraId: 20, compraItemId: 30,
      productoId: 40, cantidad: 2, numeroCompra: 'COM-20',
    }),
    error => error.code === 'PURCHASE_INVENTORY_ALREADY_APPLIED'
  );

  await assert.rejects(
    service.reverseProduct(connectionWithStock(1), {
      branchScope: specific, compraId: 20, compraItemId: 30,
      productoId: 40, cantidad: 2, numeroCompra: 'COM-20',
    }),
    error => error.code === 'UNSAFE_PURCHASE_REVERSAL'
  );

  const reverseConnection = connectionWithStock(5);
  await service.reverseProduct(reverseConnection, {
    branchScope: specific, compraId: 20, compraItemId: 30,
    productoId: 40, cantidad: 2, usuarioId: 5, numeroCompra: 'COM-20',
  });
  assert.deepStrictEqual(
    reverseConnection.calls.find(c => /UPDATE producto_existencias/.test(c.sql)).params,
    [3, 10, 7, 40]
  );
  const reversalMovement = reverseConnection.calls.find(c => /compra_anulacion/.test(c.sql));
  assert.strictEqual(reversalMovement.params[3], -2);

  console.log('OK purchaseInventoryService: scope, locks, idempotencia y reversión segura');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
