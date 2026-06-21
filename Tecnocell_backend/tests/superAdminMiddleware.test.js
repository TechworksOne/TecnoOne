const assert = require('assert');
const db = { query: async () => [[]] };
require.cache[require.resolve('../config/database')] = { exports: db };
const { verifySuperAdmin } = require('../middleware/superAdminMiddleware');
const tenantScope = require('../middleware/tenantScope');
const { verifyToken } = require('../middleware/authMiddleware');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function runSuperAdminCase(user, expectedStatus, shouldContinue = false) {
  const originalQuery = db.query;
  db.query = async () => [[user]];
  const req = { user: { id: user?.id || 1 } };
  const res = response();
  let continued = false;
  await verifySuperAdmin(req, res, () => { continued = true; });
  db.query = originalQuery;
  assert.strictEqual(res.statusCode, expectedStatus);
  assert.strictEqual(continued, shouldContinue);
}

async function main() {
  await runSuperAdminCase(
    { id: 1, active: 1, tipo_usuario: 'EMPRESA', es_super_admin: 0, empresa_id: 1 },
    403
  );
  await runSuperAdminCase(
    { id: 2, active: 1, tipo_usuario: 'EMPRESA', es_super_admin: 0, empresa_id: 1, role: 'tecnico' },
    403
  );
  await runSuperAdminCase(
    { id: 3, active: 1, tipo_usuario: 'EMPRESA', es_super_admin: 0, empresa_id: 1, role: 'employee' },
    403
  );
  await runSuperAdminCase(
    { id: 4, active: 0, tipo_usuario: 'PLATAFORMA', es_super_admin: 1, empresa_id: null },
    403
  );
  await runSuperAdminCase(
    { id: 5, active: 1, tipo_usuario: 'PLATAFORMA', es_super_admin: 1, empresa_id: null },
    200,
    true
  );

  const invalidReq = { headers: { authorization: 'Bearer token-invalido' } };
  const invalidRes = response();
  verifyToken(invalidReq, invalidRes, () => assert.fail('Un token inválido no debe continuar'));
  assert.strictEqual(invalidRes.statusCode, 401);

  const tenantReq = {
    user: {
      id: 5,
      empresa_id: null,
      tipo_usuario: 'PLATAFORMA',
      es_super_admin: true,
    },
  };
  const tenantRes = response();
  tenantScope(tenantReq, tenantRes, () => assert.fail('SUPER_ADMIN no debe entrar a tenantScope'));
  assert.strictEqual(tenantRes.statusCode, 403);

  console.log('OK superAdminMiddleware: 7 casos validados');
}

main()
  .then(() => {
    setTimeout(() => process.exit(0), 50);
  })
  .catch(error => {
    console.error(error);
    setTimeout(() => process.exit(1), 50);
  });
