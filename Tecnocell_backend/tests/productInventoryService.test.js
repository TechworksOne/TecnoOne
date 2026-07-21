const assert = require('assert');

let poolQueryCalls = [];
let connection;
const db = {
  getConnection: async () => connection,
  query: async (sql, params) => {
    poolQueryCalls.push({ sql, params });
    return [[{ id: 1 }]];
  },
};
require.cache[require.resolve('../config/database')] = { exports: db };
const service = require('../services/productInventoryService');

function makeConnection({ current = 5, productExists = true } = {}) {
  return {
    calls: [], committed: false, rolledBack: false, released: false,
    async beginTransaction() { this.calls.push(['begin']); },
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; },
    release() { this.released = true; },
    async query(sql, params) {
      this.calls.push([sql, params]);
      if (/SELECT id FROM productos/.test(sql)) return [[productExists ? { id: params[0] } : undefined].filter(Boolean)];
      if (/SELECT existencia/.test(sql)) return [[{ existencia: current }]];
      return [{ affectedRows: 1 }];
    },
  };
}

const specific = { mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] };
const consolidated = { mode: 'consolidated', empresaId: 10, sucursalId: null, allowedSucursalIds: [7, 8] };

async function main() {
  const localProjection = service.stockProjection(specific);
  assert.deepStrictEqual(localProjection.params, [7]);
  assert.match(localProjection.sql, /pe\.sucursal_id = \?/);

  const consolidatedProjection = service.stockProjection(consolidated);
  assert.deepStrictEqual(consolidatedProjection.params, [7, 8]);
  assert.match(consolidatedProjection.sql, /SUM\(pe\.existencia\)/);
  assert.match(consolidatedProjection.sql, /IN \(\?,\?\)/);

  await assert.rejects(
    service.ajustarExistencia({ branchScope: consolidated, productoId: 1, cantidad: 1 }),
    error => error.code === 'BRANCH_SPECIFIC_REQUIRED'
  );

  connection = makeConnection({ current: 5 });
  const result = await service.ajustarExistencia({
    branchScope: specific, productoId: 3, cantidad: -2,
    tipo: 'ajuste', nota: 'conteo', usuarioId: 9,
  });
  assert.deepStrictEqual(result, { stock_anterior: 5, stock_nuevo: 3, diferencia: -2 });
  assert.strictEqual(connection.committed, true);
  assert.strictEqual(connection.released, true);
  const update = connection.calls.find(call => /UPDATE producto_existencias/.test(call[0]));
  assert.deepStrictEqual(update[1], [3, 10, 7, 3]);
  assert.match(connection.calls.find(call => /SELECT id FROM productos/.test(call[0]))[0], /FOR UPDATE/);
  assert.match(connection.calls.find(call => /SELECT existencia/.test(call[0]))[0], /FOR UPDATE/);
  const movement = connection.calls.find(call => /INSERT INTO producto_movimientos/.test(call[0]));
  assert.deepStrictEqual(movement[1].slice(0, 3), [10, 7, 3]);

  connection = makeConnection({ current: 1 });
  await assert.rejects(
    service.ajustarExistencia({
      branchScope: specific, productoId: 3, cantidad: -2,
      tipo: 'salida', nota: null, usuarioId: 9,
    }),
    error => error.code === 'INSUFFICIENT_STOCK'
  );
  assert.strictEqual(connection.rolledBack, true);
  assert.strictEqual(connection.committed, false);

  poolQueryCalls = [];
  await assert.rejects(
    service.listarMovimientos({ branchScope: consolidated, productoId: 3, limit: 50 }),
    error => error.code === 'BRANCH_SPECIFIC_REQUIRED'
  );
  await service.listarMovimientos({ branchScope: specific, productoId: 3, limit: 50 });
  assert.deepStrictEqual(poolQueryCalls[0].params, [3, 10, 7, 50]);
  assert.match(poolQueryCalls[0].sql, /pm\.empresa_id = \?/);
  assert.match(poolQueryCalls[0].sql, /pm\.sucursal_id = \?/);

  console.log('OK productInventoryService: tenant, sucursal, suma, transaccion y no negativo');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
