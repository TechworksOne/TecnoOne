'use strict';

const assert = require('assert');

const calls = [];
const dbPath = require.resolve('../config/database');
const servicePath = require.resolve('../services/auditoriaService');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { query: async (sql, params) => { calls.push({ sql, params }); return [{ insertId: 1 }]; } },
};
delete require.cache[servicePath];
const auditoria = require(servicePath);

function request(branchScope) {
  return {
    tenant: { empresa_id: 7 },
    user: { id: 19, name: 'Auditora' },
    branchScope,
    method: 'POST',
    baseUrl: '/api/test',
    path: '/write',
    get: () => null,
  };
}

const base = {
  empresaId: 7,
  accion: 'PRUEBA',
  entidad: 'TEST',
  descripcion: 'Prueba de alcance',
};

(async () => {
  await auditoria.registrar({ ...base, req: request(), scope: 'company', metadata: { origen: 'test' } });
  assert.strictEqual(calls.at(-1).params[1], null);
  assert.deepStrictEqual(JSON.parse(calls.at(-1).params[10]), { origen: 'test' });

  const specific = { mode: 'specific', empresaId: 7, sucursalId: 11, allowedSucursalIds: [11, 12] };
  await auditoria.registrar({ ...base, req: request(specific), scope: 'branch' });
  assert.strictEqual(calls.at(-1).params[1], 11);

  await auditoria.registrar({ ...base, req: request(specific), scope: 'branch', sucursalId: 11 });
  assert.strictEqual(calls.at(-1).params[1], 11);

  const beforeRejected = calls.length;
  assert.strictEqual(await auditoria.registrar({ ...base, req: request(specific), scope: 'branch', sucursalId: 12 }), false);
  assert.strictEqual(calls.length, beforeRejected, 'cross-branch no debe insertar');

  const all = { mode: 'consolidated', empresaId: 7, sucursalId: null, allowedSucursalIds: [11, 12] };
  assert.strictEqual(await auditoria.registrar({ ...base, req: request(all), scope: 'branch', sucursalId: 'ALL' }), false);
  await assert.rejects(
    auditoria.registrar({ ...base, req: request(all), scope: 'branch', sucursalId: 11, strict: true }),
    /sucursal específica no autorizada/
  );

  assert.strictEqual(await auditoria.registrar({ ...base, empresaId: 8, req: request(), scope: 'company' }), false);

  await auditoria.registrar({ ...base, req: request() });
  assert.strictEqual(calls.at(-1).params[1], null, 'legacy permanece sin clasificación falsa');

  console.log('OK auditoriaServiceScope2F1A: company, branch, metadata, legacy y aislamiento');
})().catch(error => { console.error(error); process.exitCode = 1; });
