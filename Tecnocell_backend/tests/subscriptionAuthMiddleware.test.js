const assert = require('assert');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'subscription-test-secret';

const users = new Map([
  [1, {
    id: 1,
    username: 'tenant',
    email: 'tenant@example.com',
    name: 'Tenant',
    role: 'admin',
    empresa_id: 10,
    active: 1,
    tipo_usuario: 'EMPRESA',
    es_super_admin: 0,
    empresa_existente_id: 10,
    empresa_estado: 'activa',
    roles_csv: 'ADMINISTRADOR',
  }],
  [2, {
    id: 2,
    username: 'platform',
    email: 'platform@example.com',
    name: 'Platform',
    role: 'superadmin',
    empresa_id: null,
    active: 1,
    tipo_usuario: 'PLATAFORMA',
    es_super_admin: 1,
    empresa_existente_id: null,
    empresa_estado: null,
    roles_csv: '',
  }],
]);

const db = {
  query: async (_sql, params) => [[users.get(Number(params[0]))]],
};
require.cache[require.resolve('../config/database')] = { exports: db };

let accessChecks = 0;
require.cache[require.resolve('../services/subscriptionAccessService')] = {
  exports: {
    evaluarAccesoEmpresa: async () => {
      accessChecks += 1;
      return { permitido: false, code: 'SUSCRIPCION_VENCIDA' };
    },
    mensajeAccesoDenegado: () => 'La suscripción de la empresa se encuentra vencida',
  },
};

const { verifyToken } = require('../middleware/authMiddleware');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function main() {
  const tenantToken = jwt.sign({
    userId: 1,
    empresaId: 10,
    tipoUsuario: 'EMPRESA',
    esSuperAdmin: false,
  }, process.env.JWT_SECRET);
  const tenantRes = response();
  let tenantContinued = false;
  await verifyToken({
    headers: { authorization: `Bearer ${tenantToken}` },
  }, tenantRes, () => { tenantContinued = true; });
  assert.strictEqual(tenantContinued, false);
  assert.strictEqual(tenantRes.statusCode, 403);
  assert.strictEqual(tenantRes.body.code, 'SUSCRIPCION_VENCIDA');

  const platformToken = jwt.sign({
    userId: 2,
    empresaId: null,
    tipoUsuario: 'PLATAFORMA',
    esSuperAdmin: true,
  }, process.env.JWT_SECRET);
  const platformRes = response();
  let platformContinued = false;
  await verifyToken({
    headers: { authorization: `Bearer ${platformToken}` },
  }, platformRes, () => { platformContinued = true; });
  assert.strictEqual(platformContinued, true);
  assert.strictEqual(platformRes.statusCode, 200);
  assert.strictEqual(accessChecks, 1, 'SUPER_ADMIN no debe evaluar suscripción');

  console.log('OK subscriptionAuthMiddleware: token vencido bloqueado y SUPER_ADMIN independiente');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
