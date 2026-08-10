'use strict';

const assert = require('assert');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const dbPath = path.join(backendRoot, 'config', 'database.js');
const servicePath = path.join(backendRoot, 'services', 'auditoriaService.js');

const poolCalls = [];
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    async query(sql, params) {
      poolCalls.push({ sql, params });
      return [{ insertId: 1 }];
    },
  },
};
delete require.cache[servicePath];
const auditoriaService = require(servicePath);

const req = {
  tenant: { empresa_id: 7 },
  user: { id: 19, name: 'Auditora' },
  method: 'POST',
  baseUrl: '/api/caja',
  path: '/test',
  get() { return null; },
};

const base = {
  req,
  empresaId: 7,
  accion: 'PRUEBA',
  entidad: 'caja_chica',
  descripcion: 'Prueba de auditoría',
};

(async () => {
  const legacy = await auditoriaService.registrar(base);
  assert.strictEqual(legacy, true);
  assert.strictEqual(poolCalls.length, 1, 'Las llamadas legacy deben continuar usando el pool');

  const txCalls = [];
  const connection = {
    async query(sql, params) {
      txCalls.push({ sql, params });
      return [{ insertId: 2 }];
    },
  };
  const transactional = await auditoriaService.registrar({
    ...base,
    connection,
    strict: true,
  });
  assert.strictEqual(transactional, true);
  assert.strictEqual(txCalls.length, 1);
  assert.strictEqual(poolCalls.length, 1);

  const failing = {
    async query() { throw new Error('fallo de auditoría'); },
  };
  const compatibleFailure = await auditoriaService.registrar({
    ...base,
    connection: failing,
  });
  assert.strictEqual(compatibleFailure, false, 'El modo por defecto conserva el comportamiento tolerante');

  await assert.rejects(
    auditoriaService.registrar({ ...base, connection: failing, strict: true }),
    /fallo de auditoría/
  );

  console.log('OK auditoriaTransaccional2D5: pool legacy y conexión estricta retrocompatible');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
