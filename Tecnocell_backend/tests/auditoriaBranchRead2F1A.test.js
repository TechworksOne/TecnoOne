'use strict';

const assert = require('assert');

const calls = [];
const dbPath = require.resolve('../config/database');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/COUNT\(\*\)/.test(sql)) return [[{ total: 0 }]];
      return [[]];
    },
  },
};
delete require.cache[require.resolve('../controllers/auditoriaController')];
const controller = require('../controllers/auditoriaController');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function list(branchScope, query = {}) {
  const req = { tenant: { empresa_id: 7 }, branchScope, query };
  const res = response();
  await controller.getLogs(req, res);
  return res;
}

(async () => {
  const specific = { mode: 'specific', empresaId: 7, sucursalId: 11, allowedSucursalIds: [11, 12] };
  calls.length = 0;
  let res = await list(specific);
  assert.strictEqual(res.statusCode, 200);
  assert.match(calls[0].sql, /empresa_id = \?[\s\S]*sucursal_id IS NULL OR sucursal_id = \?/);
  assert.deepStrictEqual(calls[0].params.slice(0, 2), [7, 11]);

  calls.length = 0;
  const consolidated = { mode: 'consolidated', empresaId: 7, sucursalId: null, allowedSucursalIds: [11, 12] };
  res = await list(consolidated);
  assert.strictEqual(res.statusCode, 200);
  assert.match(calls[0].sql, /sucursal_id IS NULL OR sucursal_id IN \(\?, \?\)/);
  assert.deepStrictEqual(calls[0].params.slice(0, 3), [7, 11, 12]);

  res = await list(consolidated, { sucursal_id: 13 });
  assert.strictEqual(res.statusCode, 403);
  res = await list(specific, { sucursal_id: 12 });
  assert.strictEqual(res.statusCode, 403);
  res = await list(consolidated, { sucursal_id: 'ALL' });
  assert.strictEqual(res.statusCode, 400);

  calls.length = 0;
  const detailRes = response();
  await controller.getLogById(
    { tenant: { empresa_id: 7 }, branchScope: specific, params: { id: '9' } },
    detailRes
  );
  assert.match(calls[0].sql, /id = \?[\s\S]*empresa_id = \?[\s\S]*sucursal_id IS NULL OR sucursal_id = \?/);
  assert.deepStrictEqual(calls[0].params, ['9', 7, 11]);

  console.log('OK auditoriaBranchRead2F1A: specific, ALL, company-level y filtros autorizados');
})().catch(error => { console.error(error); process.exitCode = 1; });
