'use strict';

const assert = require('assert');
const dbPath = require.resolve('../config/database');
const servicePath = require.resolve('../services/permisoService');

async function main() {
  const calls = [];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      async query(sql, params) {
        calls.push({ sql, params });
        return [[
          { codigo: 'usuarios.administrar' },
          { codigo: 'permisos.administrar' },
        ]];
      },
    },
  };
  delete require.cache[servicePath];
  const service = require(servicePath);

  assert.deepStrictEqual(await service.getEffectivePermissions({ user: { id: 8 } }), []);
  const permissions = await service.getEffectivePermissions({
    tenant: { empresa_id: 3 },
    user: { id: 8, empresa_id: 99 },
  });
  assert.deepStrictEqual(permissions, ['usuarios.administrar', 'permisos.administrar']);
  assert.deepStrictEqual(calls[0].params, [3, 8]);
  assert.match(calls[0].sql, /SELECT DISTINCT p\.codigo/);
  assert.match(calls[0].sql, /u\.empresa_id = \?/);
  assert.match(calls[0].sql, /r\.empresa_id = u\.empresa_id/);
  assert.match(calls[0].sql, /r\.activo = 1/);
  assert.match(calls[0].sql, /rp\.empresa_id = r\.empresa_id/);
  assert.match(calls[0].sql, /u\.tipo_usuario = 'EMPRESA'/);
  assert.doesNotMatch(calls[0].sql, /\*/);
  assert.strictEqual(await service.hasPermission({ tenant: { empresa_id: 3 }, user: { id: 8 } }, 'usuarios.administrar'), true);
  assert.strictEqual(service.isSuperadmin, undefined);

  const requirePermissionSource = require('fs').readFileSync(
    require.resolve('../middleware/requirePermission'), 'utf8'
  );
  assert.doesNotMatch(requirePermissionSource, /permissions\.includes\('\*'\)/);
  assert.match(requirePermissionSource, /permissions\.includes\(code\)/);
  console.log('rbacEffectivePermissions2E1.test.js OK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
