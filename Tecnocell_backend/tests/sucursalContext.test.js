const assert = require('assert');
const fs = require('fs');
const path = require('path');

let rows = [];
let consolidatedAllowed = false;
const db = { query: async () => [rows] };
require.cache[require.resolve('../config/database')] = { exports: db };
require.cache[require.resolve('../services/permisoService')] = {
  exports: { hasPermission: async () => consolidatedAllowed },
};
const middleware = require('../middleware/branchScope');

function response() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function run({ branchId = '7', user = {}, result = [], canConsolidate = false } = {}) {
  rows = result;
  consolidatedAllowed = canConsolidate;
  const req = {
    user: { id: 5, userId: 5, empresa_id: 10, empresaId: 10, ...user },
    tenant: { empresa_id: 10 },
    get: name => name === 'X-Sucursal-Id' ? branchId : undefined,
  };
  const res = response();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

async function main() {
  const assigned = [
    { id: 7, empresa_id: 10, activa: 1, es_predeterminada: 1 },
    { id: 8, empresa_id: 10, activa: 1, es_predeterminada: 0 },
    { id: 9, empresa_id: 10, activa: 0, es_predeterminada: 0 },
  ];

  let value = await run({ result: assigned });
  assert.strictEqual(value.nextCalled, true);
  assert.deepStrictEqual(value.req.branchScope, {
    mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8],
  });
  assert.strictEqual(value.req.sucursal_id, 7);

  value = await run({ branchId: '99', result: assigned });
  assert.strictEqual(value.res.body.code, 'BRANCH_NOT_ASSIGNED');
  value = await run({ branchId: '9', result: assigned });
  assert.strictEqual(value.res.body.code, 'BRANCH_INACTIVE');
  value = await run({ branchId: 'ALL', result: assigned });
  assert.strictEqual(value.res.body.code, 'CONSOLIDATED_CONTEXT_FORBIDDEN');

  value = await run({ branchId: 'ALL', result: assigned, canConsolidate: true });
  assert.strictEqual(value.nextCalled, true);
  assert.deepStrictEqual(value.req.branchScope, {
    mode: 'consolidated', empresaId: 10, sucursalId: null, allowedSucursalIds: [7, 8],
  });
  assert.strictEqual(value.req.sucursal, null);

  value = await run({ branchId: 'ALL', result: [], canConsolidate: true });
  assert.strictEqual(value.res.body.code, 'USER_BRANCH_REQUIRED');
  value = await run({ user: { esSuperAdmin: true }, result: assigned });
  assert.strictEqual(value.res.body.code, 'SUPERADMIN_BRANCH_CONTEXT_FORBIDDEN');

  assert.strictEqual(require('../middleware/sucursalContext'), middleware);
  const authRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'authRoutes.js'), 'utf8');
  assert.match(authRoutes, /mis-sucursales', verifyToken/);
  const untouchedRoutes = [
    'ventaRoutes.js', 'compraRoutes.js', 'cajaRoutes.js',
    'reportesRoutes.js', 'dashboardRoutes.js',
  ].map(file => fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8')).join('\n');
  assert.doesNotMatch(untouchedRoutes, /branchScope/);

  console.log('OK branchScope: specific, consolidated, permiso, asignacion y compatibilidad');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
