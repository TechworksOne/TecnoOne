'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const controllerPath = path.join(backendRoot, 'controllers', 'cajaController.js');
const dbPath = path.join(backendRoot, 'config', 'database.js');
const auditPath = path.join(backendRoot, 'services', 'auditoriaService.js');

const controllerSource = fs.readFileSync(controllerPath, 'utf8');
const routesSource = fs.readFileSync(path.join(backendRoot, 'routes', 'cajaRoutes.js'), 'utf8');
const migration = fs.readFileSync(
  path.join(backendRoot, 'scripts', 'migration_caja_chica_arqueos_reposicion_sprint_2d5.sql'),
  'utf8'
);

assert.match(migration, /CREATE TABLE IF NOT EXISTS caja_chica_arqueos/);
assert.match(migration, /FOREIGN KEY \(empresa_id, sucursal_id\)/);
assert.match(migration, /FOREIGN KEY \(usuario_id, empresa_id\)[\s\S]{0,100}REFERENCES users\(id, empresa_id\)/);
assert.match(migration, /caja\.arquear/);
assert.match(migration, /caja\.reponer_manual/);
assert.match(migration, /caja\.reponer/);
assert.doesNotMatch(migration, /CREATE TABLE.*reposicion/is);
assert.doesNotMatch(migration, /(ALTER|INSERT|UPDATE|DELETE|CREATE|DROP)\s+(TABLE\s+)?caja_sesiones/i);
assert.doesNotMatch(migration, /FROM empresas e\s+CROSS JOIN roles r/);
assert.match(migration, /FROM users u[\s\S]{0,100}INNER JOIN user_roles ur[\s\S]{0,100}INNER JOIN roles r/);

assert.match(routesSource, /GET|caja-chica\/arqueos/);
assert.match(routesSource, /caja-chica\/arqueos[\s\S]{0,180}requireBranchSpecific/);
assert.match(routesSource, /reposiciones\/manual[\s\S]{0,180}caja\.reponer_manual[\s\S]{0,180}requireBranchSpecific/);
assert.match(routesSource, /reposiciones\/banco[\s\S]{0,220}caja\.reponer[\s\S]{0,220}bancos\.administrar[\s\S]{0,180}requireBranchSpecific/);
assert.doesNotMatch(controllerSource, /const\s*\{[^}]*sucursal_id[^}]*\}\s*=\s*req\.body/);
assert.doesNotMatch(controllerSource, /caja_sesiones/);
assert.match(controllerSource, /randomUUID\(\)/);
assert.match(controllerSource, /referencia_id/);
assert.match(controllerSource, /FROM sucursales[\s\S]{0,180}FOR UPDATE/);

function makeResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function baseRequest(body = {}) {
  return {
    body,
    query: {},
    method: 'POST',
    path: '/test',
    baseUrl: '/api/caja',
    tenant: { empresa_id: 7 },
    user: { id: 19, name: 'Auditora', empresa_id: 7 },
    branchScope: {
      mode: 'specific',
      empresaId: 7,
      sucursalId: 11,
      allowedSucursalIds: [11],
    },
    get() { return null; },
  };
}

function loadController(connection, auditCalls) {
  delete require.cache[controllerPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      getConnection: async () => connection,
      query: async () => { throw new Error('Pool query inesperado'); },
    },
  };
  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      registrar: async payload => {
        auditCalls.push(payload);
        assert.strictEqual(payload.connection, connection);
        assert.strictEqual(payload.strict, true);
        assert.strictEqual(payload.scope, 'branch');
        return true;
      },
    },
  };
  return require(controllerPath);
}

function connectionFor(handler) {
  const calls = [];
  return {
    calls,
    committed: false,
    rolledBack: false,
    released: false,
    async beginTransaction() { calls.push({ sql: 'BEGIN' }); },
    async query(sql, params) {
      calls.push({ sql, params });
      return handler(sql, params, calls);
    },
    async commit() { this.committed = true; calls.push({ sql: 'COMMIT' }); },
    async rollback() { this.rolledBack = true; calls.push({ sql: 'ROLLBACK' }); },
    release() { this.released = true; },
  };
}

async function testArqueo() {
  const auditCalls = [];
  const conn = connectionFor(async sql => {
    if (/FROM sucursales/.test(sql)) return [[{ id: 11 }]];
    if (/AS saldo[\s\S]*FROM caja_chica/.test(sql)) return [[{ saldo: '125.50' }]];
    if (/MAX\(id\)/.test(sql)) return [[{ id: 44 }]];
    if (/INSERT INTO caja_chica_arqueos/.test(sql)) return [{ insertId: 9 }];
    throw new Error(`SQL inesperado: ${sql}`);
  });
  const controller = loadController(conn, auditCalls);
  const res = makeResponse();

  await controller.registrarArqueoCajaChica(
    baseRequest({ monto_contado: 120, observaciones: 'Conteo físico' }),
    res
  );

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.payload.data.resultado, 'FALTANTE');
  assert.strictEqual(res.payload.data.diferencia, -5.5);
  assert.strictEqual(res.payload.data.saldo_teorico, 125.5);
  assert.strictEqual(conn.committed, true);
  assert.strictEqual(conn.rolledBack, false);
  assert.strictEqual(auditCalls.length, 1);
  assert.ok(!conn.calls.some(call => /INSERT INTO caja_chica \(/.test(call.sql)));
  assert.ok(!conn.calls.some(call => /cuentas_bancarias|movimientos_bancarios/.test(call.sql)));
}

async function testReposicionManual() {
  const auditCalls = [];
  const conn = connectionFor(async sql => {
    if (/FROM sucursales/.test(sql)) return [[{ id: 11 }]];
    if (/AS saldo[\s\S]*FROM caja_chica/.test(sql)) return [[{ saldo: '20.00' }]];
    if (/INSERT INTO caja_chica \(/.test(sql)) return [{ insertId: 77 }];
    throw new Error(`SQL inesperado: ${sql}`);
  });
  const controller = loadController(conn, auditCalls);
  const res = makeResponse();

  await controller.reponerCajaChicaManual(
    baseRequest({
      monto: 30,
      concepto: 'Reposición autorizada',
      observaciones: 'Autorizada por administración',
      sucursal_id: 999,
    }),
    res
  );

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.payload.data.saldo_actual, 50);
  const insert = conn.calls.find(call => /INSERT INTO caja_chica \(/.test(call.sql));
  assert.strictEqual(insert.params[0], 7);
  assert.strictEqual(insert.params[1], 11);
  assert.strictEqual(conn.committed, true);
  assert.strictEqual(auditCalls.length, 1);
}

async function testBancoInsuficienteRollback() {
  const auditCalls = [];
  const conn = connectionFor(async sql => {
    if (/FROM sucursales/.test(sql)) return [[{ id: 11 }]];
    if (/AS saldo[\s\S]*FROM caja_chica/.test(sql)) return [[{ saldo: '10.00' }]];
    if (/FROM cuentas_bancarias/.test(sql)) return [[{ id: 3, nombre: 'Banco', saldo_actual: '40.00' }]];
    throw new Error(`SQL inesperado: ${sql}`);
  });
  const controller = loadController(conn, auditCalls);
  const res = makeResponse();

  await controller.reponerCajaChicaDesdeBanco(
    baseRequest({ cuenta_id: 3, monto: 50, concepto: 'Reposición semanal' }),
    res
  );

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.payload.code, 'BANCO_SALDO_INSUFICIENTE');
  assert.strictEqual(conn.rolledBack, true);
  assert.strictEqual(conn.committed, false);
  assert.strictEqual(auditCalls.length, 0);
  assert.ok(!conn.calls.some(call => /INSERT INTO (caja_chica|movimientos_bancarios)/.test(call.sql)));
}

async function testReposicionBancoAtomica() {
  const auditCalls = [];
  const conn = connectionFor(async sql => {
    if (/FROM sucursales/.test(sql)) return [[{ id: 11 }]];
    if (/AS saldo[\s\S]*FROM caja_chica/.test(sql)) return [[{ saldo: '10.00' }]];
    if (/FROM cuentas_bancarias/.test(sql)) return [[{ id: 3, nombre: 'Banco Uno', saldo_actual: '100.00' }]];
    if (/INSERT INTO movimientos_bancarios/.test(sql)) return [{ insertId: 81 }];
    if (/UPDATE cuentas_bancarias/.test(sql)) return [{ affectedRows: 1 }];
    if (/INSERT INTO caja_chica \(/.test(sql)) return [{ insertId: 82 }];
    throw new Error(`SQL inesperado: ${sql}`);
  });
  const controller = loadController(conn, auditCalls);
  const res = makeResponse();

  await controller.reponerCajaChicaDesdeBanco(
    baseRequest({ cuenta_id: 3, monto: 60, concepto: 'Reposición semanal' }),
    res
  );

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(conn.committed, true);
  assert.strictEqual(res.payload.data.saldo_banco_actual, 40);
  assert.strictEqual(res.payload.data.saldo_caja_actual, 70);
  const bancoInsert = conn.calls.find(call => /INSERT INTO movimientos_bancarios/.test(call.sql));
  const cajaInsert = conn.calls.find(call => /INSERT INTO caja_chica \(/.test(call.sql));
  assert.strictEqual(bancoInsert.params.at(-1), cajaInsert.params.at(-1));
  assert.match(bancoInsert.params.at(-1), /^[0-9a-f-]{36}$/);
  const lockSucursal = conn.calls.findIndex(call => /FROM sucursales/.test(call.sql));
  const lockBanco = conn.calls.findIndex(call => /FROM cuentas_bancarias/.test(call.sql));
  assert.ok(lockSucursal >= 0 && lockSucursal < lockBanco);
  assert.strictEqual(auditCalls.length, 1);
}

(async () => {
  await testArqueo();
  await testReposicionManual();
  await testBancoInsuficienteRollback();
  await testReposicionBancoAtomica();
  console.log('OK cajaChicaArqueoReposicion2D5: arqueo, scope, reposiciones, locks, trazabilidad y rollback');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
