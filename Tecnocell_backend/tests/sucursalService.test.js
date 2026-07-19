const assert = require('assert');

let connection;
const pool = {
  getConnection: async () => connection,
  query: async (...args) => connection.query(...args),
};
require.cache[require.resolve('../config/database')] = { exports: pool };
const service = require('../services/sucursalService');

function makeConnection({ limit = 2, total = 0, active = 0, principal = null, branch = null } = {}) {
  const calls = [];
  const parameters = [];
  return {
    calls,
    parameters,
    committed: false,
    rolledBack: false,
    released: false,
    async beginTransaction() {},
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; },
    release() { this.released = true; },
    async query(sql, params = []) {
      calls.push(sql);
      parameters.push(params);
      if (/FROM empresas e/.test(sql) && /limite_sucursales/.test(sql)) {
        return [[{ limite_sucursales: limit, plan_id: 5, plan_codigo: 'multi', max_sucursales: 99 }]];
      }
      if (/SELECT id FROM sucursales\s+WHERE empresa_id = \?(?: FOR UPDATE)?/.test(sql) && !/activa = 1/.test(sql)) {
        return [Array.from({ length: total }, (_, index) => ({ id: index + 1 }))];
      }
      if (/SELECT id FROM sucursales\s+WHERE empresa_id = \? AND activa = 1/.test(sql)) {
        return [Array.from({ length: active }, (_, index) => ({ id: index + 1 }))];
      }
      if (/es_principal = 1/.test(sql) && /SELECT \*/.test(sql)) {
        return [principal ? [principal] : []];
      }
      if (/FROM empresas WHERE id = \? FOR UPDATE/.test(sql)) {
        return [[{ id: 10, nombre: 'Empresa QA', direccion: null, telefono: null, email: null }]];
      }
      if (/SELECT id FROM sucursales WHERE empresa_id/.test(sql)) return [[]];
      if (/INSERT INTO sucursales/.test(sql)) return [{ insertId: 77, affectedRows: 1 }];
      if (/SELECT \* FROM sucursales WHERE id = \? AND empresa_id = \? FOR UPDATE/.test(sql)) {
        return [branch ? [branch] : []];
      }
      if (/SELECT \* FROM sucursales WHERE id = \? AND empresa_id = \?/.test(sql)) {
        return [[{ id: 77, empresa_id: 10, codigo: 'principal', nombre: 'Empresa QA', activa: 1, es_principal: 1 }]];
      }
      return [{ affectedRows: 1 }];
    },
  };
}

async function main() {
  connection = makeConnection({ limit: 2, total: 2 });
  await assert.rejects(
    service.validarLimiteSucursales(10),
    error => error.code === 'BRANCH_LIMIT_REACHED' && error.used === 2 && error.limit === 2 && error.message === 'La empresa alcanzó el límite de sucursales permitido.'
  );

  connection = makeConnection({ limit: 3, total: 2 });
  const available = await service.validarLimiteSucursales(10);
  assert.strictEqual(available.permitido, true);
  assert.strictEqual(available.limit, 3);

  connection = makeConnection({ limit: 2, total: 0, principal: null });
  const firstBranch = await service.crearSucursal(10, {
    codigo: 'centro',
    nombre: 'Sucursal Centro',
  });
  assert.strictEqual(firstBranch.es_principal, 1);
  const insertIndex = connection.calls.findIndex(sql => /INSERT INTO sucursales/.test(sql));
  assert.strictEqual(connection.parameters[insertIndex].at(-1), 1);

  connection = makeConnection({ limit: 2, total: 0 });
  const ensured = await service.asegurarSucursalPrincipal(10);
  assert.strictEqual(ensured.creada, true);
  assert.strictEqual(ensured.sucursal.id, 77);
  assert(connection.calls.some(sql => /INSERT INTO sucursales/.test(sql)));
  assert(connection.calls.some(sql => /INSERT IGNORE INTO usuario_sucursales/.test(sql)));
  assert.strictEqual(connection.committed, true);
  assert.strictEqual(connection.released, true);

  connection = makeConnection({
    limit: 1,
    total: 2,
    active: 1,
    principal: { id: 1, empresa_id: 10, activa: 1, es_principal: 1 },
    branch: { id: 77, empresa_id: 10, codigo: 'norte', nombre: 'Norte', activa: 0, es_principal: 0 },
  });
  await service.editarSucursal(10, 77, { es_principal: true });
  assert(connection.calls.some(sql => /SET es_principal = 0/.test(sql)));

  connection = makeConnection({
    limit: 2,
    active: 1,
    branch: { id: 77, empresa_id: 10, activa: 1, es_principal: 1 },
  });
  await assert.rejects(
    service.cambiarEstadoSucursal(10, 77, false),
    error => error.code === 'PRIMARY_BRANCH_REQUIRED'
  );
  assert.strictEqual(connection.rolledBack, true);
  assert.strictEqual(connection.released, true);

  console.log('OK sucursalService: tenant, principal, limite, promocion y desactivacion validados');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
