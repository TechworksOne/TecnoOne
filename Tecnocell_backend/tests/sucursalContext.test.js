const assert = require('assert');
const fs = require('fs');
const path = require('path');

let rows = [];
const db = { query: async () => [rows] };
require.cache[require.resolve('../config/database')] = { exports: db };
const middleware = require('../middleware/sucursalContext');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function run({ branchId = '7', user = {}, result = [] } = {}) {
  rows = result;
  const req = {
    user: { id: 5, userId: 5, empresa_id: 10, empresaId: 10, ...user },
    get: name => name === 'X-Sucursal-Id' ? branchId : undefined,
  };
  const res = response();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

async function main() {
  let value = await run({ result: [] });
  assert.strictEqual(value.res.body.code, 'BRANCH_NOT_ASSIGNED');
  assert.strictEqual(value.nextCalled, false);

  value = await run({ result: [{ id: 7, empresa_id: 10, activa: 0 }] });
  assert.strictEqual(value.res.body.code, 'BRANCH_INACTIVE');

  value = await run({ result: [{ id: 7, empresa_id: 10, activa: 1, es_predeterminada: 1 }] });
  assert.strictEqual(value.nextCalled, true);
  assert.strictEqual(value.req.sucursal_id, 7);
  assert.strictEqual(value.req.sucursal_context.es_predeterminada, 1);

  value = await run({ user: { esSuperAdmin: true }, result: [{ id: 7, activa: 1 }] });
  assert.strictEqual(value.res.body.code, 'SUPERADMIN_BRANCH_CONTEXT_FORBIDDEN');

  const authRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'authRoutes.js'), 'utf8');
  assert.match(authRoutes, /mis-sucursales', verifyToken/);
  const operationalRoutes = [
    'ventaRoutes.js', 'compraRoutes.js', 'productRoutes.js', 'cajaRoutes.js',
    'reportesRoutes.js', 'dashboardRoutes.js',
  ].map(file => fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8')).join('\n');
  assert.doesNotMatch(operationalRoutes, /sucursalContext/);

  console.log('OK sucursalContext: asignacion, estado, tenant, superadmin y aislamiento validados');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
