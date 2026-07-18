const assert = require('assert');
const fs = require('fs');
const path = require('path');

let connection;
const pool = {
  getConnection: async () => connection,
  query: async (...args) => connection.query(...args),
};
require.cache[require.resolve('../config/database')] = { exports: pool };
const service = require('../services/sucursalService');

function makeConnection({ availableIds = [11], principalId = 11 } = {}) {
  return {
    committed: false,
    rolledBack: false,
    released: false,
    inserts: [],
    async beginTransaction() {},
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; },
    release() { this.released = true; },
    async query(sql, params = []) {
      if (/SELECT id FROM users WHERE id = \? AND empresa_id = \?/.test(sql)) return [[{ id: params[0] }]];
      if (/SELECT id FROM sucursales[\s\S]+activa = 1/.test(sql)) {
        return [availableIds.map(id => ({ id }))];
      }
      if (/SELECT \* FROM sucursales[\s\S]+es_principal = 1/.test(sql)) {
        return [[{ id: principalId, empresa_id: 10, activa: 1, es_principal: 1 }]];
      }
      if (/INSERT INTO usuario_sucursales/.test(sql)) {
        this.inserts.push(params);
        return [{ affectedRows: 1 }];
      }
      if (/FROM usuario_sucursales us/.test(sql)) {
        return [this.inserts.map(params => ({
          id: params[1], empresa_id: params[2], nombre: `Sucursal ${params[1]}`,
          activa: 1, es_predeterminada: params[3],
        }))];
      }
      return [{ affectedRows: 1 }];
    },
  };
}

async function main() {
  connection = makeConnection();
  await assert.rejects(
    service.actualizarSucursalesUsuario(10, 5, { sucursal_ids: [], predeterminada_id: 11 }),
    error => error.code === 'BRANCH_ASSIGNMENT_REQUIRED'
  );

  connection = makeConnection();
  await assert.rejects(
    service.actualizarSucursalesUsuario(10, 5, { sucursal_ids: [11], predeterminada_id: 12 }),
    error => error.code === 'DEFAULT_BRANCH_REQUIRED'
  );
  await assert.rejects(
    service.actualizarSucursalesUsuario(10, 5, { sucursal_ids: [11] }),
    error => error.code === 'DEFAULT_BRANCH_REQUIRED'
  );

  connection = makeConnection({ availableIds: [11] });
  await assert.rejects(
    service.actualizarSucursalesUsuario(10, 5, { sucursal_ids: [11, 99], predeterminada_id: 11 }),
    error => error.code === 'BRANCH_COMPANY_MISMATCH'
  );
  assert.strictEqual(connection.rolledBack, true);

  connection = makeConnection({ principalId: 11 });
  const assigned = await service.asignarSucursalPrincipalUsuario(10, 5);
  assert.strictEqual(assigned[0].id, 11);
  assert.strictEqual(assigned[0].es_predeterminada, 1);
  assert.strictEqual(connection.committed, true);
  assert.strictEqual(connection.released, true);

  const adminRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'adminRoutes.js'), 'utf8');
  const superRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'superAdminRoutes.js'), 'utf8');
  const adminController = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'adminUsuariosController.js'), 'utf8');
  const superController = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'superAdminController.js'), 'utf8');
  assert.match(adminRoutes, /router\.use\(verifyToken\)[\s\S]+router\.use\(tenantScope\)[\s\S]+usuarios\/:id\/sucursales/);
  assert.match(adminRoutes, /requirePermission\('usuarios\.administrar'\)/);
  assert.match(superRoutes, /router\.use\(verifyToken\)[\s\S]+router\.use\(verifySuperAdmin\)[\s\S]+empresas\/:empresaId\/usuarios\/:userId\/sucursales/);
  assert.match(adminController, /asignarSucursalPrincipalUsuario\([\s\S]+connection/);
  assert.match(superController, /asignarSucursalPrincipalUsuario\([\s\S]+connection/);

  console.log('OK usuarioSucursales: tenant, minimo, predeterminada, fallback y proteccion validados');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
