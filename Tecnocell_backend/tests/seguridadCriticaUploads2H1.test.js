'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  resolveContainedPath,
  resolveRepairUploadDirectory,
  validateRepairImageType,
  validateRepairUploadId,
} = require('../utils/repairUploadPath');
const { withoutDeviceCredentials } = require('../utils/repairCredentials');

const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

function main() {
  const server = read('server.js');
  const route = read('routes/privateUploadsRoutes.js');
  const repairs = read('controllers/reparacionController.js');
  const flow = read('controllers/flujoReparacionController.js');
  const nginx = fs.readFileSync(path.join(__dirname, '..', '..', 'nginx', 'nginx.conf'), 'utf8');

  assert.doesNotMatch(server, /app\.use\(['"]\/uploads['"],\s*express\.static/);
  assert.doesNotMatch(nginx, /location \^~ \/uploads\/[^}]*alias/s);
  assert.match(nginx, /location \^~ \/uploads\/[^}]*proxy_pass\s+http:\/\/backend:3000/s);
  assert.match(server, /app\.use\(['"]\/uploads['"],\s*privateUploadsRoutes\)/);
  assert.match(route, /router\.use\(verifyToken, tenantScope, branchScope\)/);
  assert.match(route, /reparaciones\.ver/);
  assert.match(route, /r\.empresa_id = \?/);
  assert.match(route, /sucursal_id = \?/);
  assert.match(route, /allowedSucursalIds/);
  assert.match(route, /sucursal_id IN/);
  assert.match(route, /ri\.url_path = \?/);
  assert.match(route, /private, no-store/);
  assert.match(route, /X-Content-Type-Options/);
  assert.doesNotMatch(route, /req\.query\.(token|jwt)|[?&]token=/i);

  assert.strictEqual(validateRepairUploadId('42'), '42');
  assert.match(validateRepairUploadId('REP123456'), /^REP/);
  for (const invalid of ['../42', '..\\42', '/tmp/42', 'C:\\tmp\\42', '42/evil', '%2e%2e']) {
    assert.throws(() => validateRepairUploadId(invalid), /no valido/);
  }
  for (const valid of ['recepcion', 'ingreso', 'historial', 'final']) {
    assert.strictEqual(validateRepairImageType(valid), valid);
  }
  assert.throws(() => validateRepairImageType('otro'), /no valido/);
  assert.throws(() => validateRepairImageType('../final'), /no valido/);

  const base = path.join(os.tmpdir(), 'tecnoone-uploads-test');
  const validDirectory = resolveRepairUploadDirectory(base, '42', 'historial');
  assert.ok(validDirectory.startsWith(path.resolve(base) + path.sep));
  assert.throws(() => resolveContainedPath(base, '..', 'secret.txt'), /no valida/);
  assert.match(repairs, /resolveRepairUploadDirectory/);
  assert.match(flow, /resolveRepairUploadDirectory/);

  const safe = withoutDeviceCredentials({
    id: 1, patron_contrasena: '123', acceso_valor: '2580', pin: '0000', password: 'secret', cliente_nombre: 'Cliente',
  });
  assert.deepStrictEqual(safe, { id: 1, cliente_nombre: 'Cliente' });
  assert.match(repairs, /withoutDeviceCredentials\(rep\)/);
  assert.match(flow, /withoutDeviceCredentials\(r\)/);
  assert.match(repairs, /SELECT r\.\* FROM reparaciones r WHERE r\.id = \?/);

  console.log('OK seguridadCriticaUploads2H1: autenticacion, tenant/branch, traversal, historicos y credenciales');
}

main();
