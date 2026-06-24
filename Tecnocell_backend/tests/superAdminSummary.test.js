const assert = require('assert');

const queries = [];
const db = {
  query: async sql => {
    queries.push(sql);
    if (/FROM\s+empresas/i.test(sql)) {
      return [[{
        empresas_totales: 4,
        empresas_activas: 1,
        empresas_demo: 1,
        empresas_suspendidas: 1,
        empresas_canceladas: 1,
      }]];
    }
    return [[{ usuarios_totales: 3 }]];
  },
};

require.cache[require.resolve('../config/database')] = { exports: db };
require.cache[require.resolve('../services/superAdminAuditService')] = {
  exports: { registrar: async () => true },
};

const controller = require('../controllers/superAdminController');

function normalize(sql) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

async function main() {
  const companySql = normalize(controller.SUPER_ADMIN_SUMMARY_SQL);
  const usersSql = normalize(controller.SUPER_ADMIN_USERS_SUMMARY_SQL);

  assert.match(
    companySql,
    /lower\(coalesce\(estado, ''\)\) = 'activa' and lower\(coalesce\(plan, ''\)\) <> 'demo'/,
    'Una empresa demo activa no debe contarse como activa comercial'
  );
  assert.match(
    companySql,
    /lower\(coalesce\(plan, ''\)\) = 'demo' and lower\(coalesce\(estado, ''\)\) in \('activa', 'demo'\)/,
    'estado=activa, plan=demo debe contarse como demo'
  );
  assert.match(
    companySql,
    /lower\(coalesce\(estado, ''\)\) = 'cancelada'/,
    'Una empresa cancelada debe contarse en su métrica exclusiva'
  );
  assert.match(
    usersSql,
    /coalesce\(tipo_usuario, 'empresa'\) = 'empresa' and coalesce\(es_super_admin, 0\) = 0/,
    'Los usuarios de plataforma y SUPER_ADMIN deben excluirse'
  );

  const res = {
    body: null,
    json(body) { this.body = body; return this; },
  };
  await controller.getMe({ superAdmin: { id: 99 } }, res);

  assert.deepStrictEqual(res.body.data.resumen, {
    empresas_totales: 4,
    empresas_activas: 1,
    empresas_demo: 1,
    empresas_suspendidas: 1,
    empresas_canceladas: 1,
    usuarios_totales: 3,
  });
  assert.strictEqual(queries.length, 2);
  console.log('OK superAdminSummary: semántica y respuesta validadas');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
