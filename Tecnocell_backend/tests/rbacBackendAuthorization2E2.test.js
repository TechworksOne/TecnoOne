'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const backend = path.resolve(__dirname, '..');
const servicePath = require.resolve('../services/permisoService');
const middlewarePath = require.resolve('../middleware/requirePermission');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function main() {
  let effective = [];
  require.cache[servicePath] = {
    id: servicePath, filename: servicePath, loaded: true,
    exports: { getEffectivePermissions: async () => effective },
  };
  delete require.cache[middlewarePath];
  const requirePermission = require(middlewarePath);
  const req = { tenant: { empresa_id: 1 }, user: { id: 7, roles: ['ROL_PERSONALIZADO'] } };
  let nextCalled = false;
  effective = ['tarjetas.administrar'];
  await requirePermission('tarjetas.administrar')(req, response(), () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'un rol personalizado pasa por su permiso efectivo');

  effective = [];
  const denied = response();
  await requirePermission('tarjetas.administrar')(
    { tenant: { empresa_id: 1 }, user: { id: 8, roles: ['ADMINISTRADOR'], role: 'admin' } },
    denied,
    () => assert.fail('ADMINISTRADOR sin permiso no debe pasar')
  );
  assert.strictEqual(denied.statusCode, 403);

  const tarjeta = fs.readFileSync(path.join(backend, 'controllers', 'tarjetaCreditoController.js'), 'utf8');
  const ot = fs.readFileSync(path.join(backend, 'controllers', 'otController.js'), 'utf8');
  const dashboard = fs.readFileSync(path.join(backend, 'controllers', 'dashboardController.js'), 'utf8');
  const product = fs.readFileSync(path.join(backend, 'controllers', 'productController.js'), 'utf8');
  assert.doesNotMatch(tarjeta, /soloAdmin|hasAdmin/);
  assert.doesNotMatch(ot, /function isAdmin|userIsAdmin/);
  assert.match(ot, /hasPermission\(req, 'ordenes_trabajo\.ver_todas'\)/);
  assert.doesNotMatch(dashboard, /function resolveRole|callerRole/);
  assert.match(dashboard, /dashboard\.ver_financiero/);
  assert.match(product, /hasPermission\(req, 'costos\.ver'\)/);

  console.log('rbacBackendAuthorization2E2.test.js OK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
