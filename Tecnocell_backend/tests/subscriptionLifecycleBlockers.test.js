const assert = require('assert');

let currentConnection;
const db = {
  getConnection: async () => currentConnection,
  query: async () => [[]],
};
require.cache[require.resolve('../config/database')] = { exports: db };

const targetPlan = {
  id: 7,
  codigo: 'pos',
  activo: true,
  asignable: true,
  max_usuarios: 2,
};
require.cache[require.resolve('../services/planAccessService')] = {
  exports: {
    obtenerPlanPorId: async () => targetPlan,
    obtenerPlanPorCodigo: async () => targetPlan,
    aplicarCambioPlanProgramadoTransaccional: async () => ({ aplicado: false }),
  },
};
require.cache[require.resolve('../services/superAdminAuditService')] = {
  exports: { registrar: async () => true },
};

const lifecycle = require('../services/subscriptionLifecycleService');
const superAdminController = require('../controllers/superAdminController');
const subscriptionController = require('../controllers/subscriptionController');

function makeConnection({ empresaEstado = 'suspendida', subscriptionState = 'vigente', activeUsers = 1 } = {}) {
  const calls = [];
  return {
    calls,
    committed: false,
    rolledBack: false,
    released: false,
    async beginTransaction() {},
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; },
    release() { this.released = true; },
    async query(sql) {
      calls.push(sql);
      if (/FROM empresas WHERE id = \? FOR UPDATE/.test(sql)) {
        return [[{
          id: 10,
          estado: empresaEstado,
          plan: 'taller',
          fecha_inicio: '2026-01-01',
          fecha_vencimiento: '2026-06-01',
        }]];
      }
      if (/FROM suscripciones WHERE empresa_id = \? FOR UPDATE/.test(sql)) {
        return [[{
          id: 20,
          empresa_id: 10,
          plan: 'taller',
          plan_id: 3,
          plan_programado_id: 9,
          cambio_plan_efectivo_en: '2026-08-01',
          tipo: 'comercial',
          estado: subscriptionState,
          fecha_inicio: '2026-01-01',
          fecha_vencimiento: '2026-06-01',
          dias_gracia: 0,
          fecha_fin_gracia: '2026-06-01',
          duracion_meses: 1,
        }]];
      }
      if (/SELECT id FROM users/.test(sql)) {
        return [Array.from({ length: activeUsers }, (_, index) => ({ id: index + 1 }))];
      }
      return [{ affectedRows: 1 }];
    },
  };
}

async function main() {
  currentConnection = makeConnection();
  const reactivated = await lifecycle.reactivarEmpresaConSuscripcion(10, {
    superAdminId: 99,
    hoy: '2026-07-17',
  });
  assert.strictEqual(reactivated.nuevo.estado, 'vencida');
  assert(currentConnection.calls.some(sql => /UPDATE suscripciones SET estado = \?/.test(sql)));
  assert(currentConnection.calls.some(sql => /INSERT INTO historial_suscripciones/.test(sql)));

  const renewed = makeConnection({ empresaEstado: 'cancelada', activeUsers: 2 });
  const renewalResult = await lifecycle.renovarSuscripcionTransaccional(renewed, {
    empresaId: 10,
    meses: 1,
    diasGracia: 0,
    planId: 7,
    hoy: '2026-07-17',
  });
  assert.strictEqual(renewalResult.estado_empresa, 'cancelada');
  assert.strictEqual(renewalResult.next.plan_programado_id, null);
  assert(renewed.calls.some(sql => /plan_programado_id = NULL/.test(sql)));

  const overLimit = makeConnection({ activeUsers: 3 });
  await assert.rejects(
    lifecycle.renovarSuscripcionTransaccional(overLimit, {
      empresaId: 10,
      meses: 1,
      planId: 7,
      hoy: '2026-07-17',
    }),
    error => error.code === 'PLAN_LIMIT_CONFLICT' && error.used === 3 && error.limit === 2
  );
  assert(!overLimit.calls.some(sql => /UPDATE suscripciones SET plan/.test(sql)));

  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await superAdminController.updateEmpresaEstado({
    params: { id: 10 },
    body: { estado: 'cancelada' },
  }, response);
  assert.strictEqual(response.statusCode, 409);
  assert.strictEqual(response.body.code, 'EXPLICIT_LIFECYCLE_ENDPOINT_REQUIRED');

  currentConnection = makeConnection({ activeUsers: 3 });
  const limitResponse = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await subscriptionController.updateSuscripcion({
    params: { id: 10 },
    body: { plan: 'pos' },
    superAdmin: { id: 99 },
  }, limitResponse);
  assert.strictEqual(limitResponse.statusCode, 409);
  assert.strictEqual(limitResponse.body.code, 'PLAN_LIMIT_CONFLICT');
  assert.strictEqual(limitResponse.body.used, 3);
  assert.strictEqual(currentConnection.rolledBack, true);
  assert(!currentConnection.calls.some(sql => /UPDATE suscripciones/.test(sql)));

  currentConnection = makeConnection({ activeUsers: 2 });
  const updateResponse = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await subscriptionController.updateSuscripcion({
    params: { id: 10 },
    body: { plan: 'pos', motivo: 'Cambio controlado' },
    superAdmin: { id: 99 },
  }, updateResponse);
  assert.strictEqual(updateResponse.statusCode, 200);
  assert.strictEqual(updateResponse.body.data.plan, 'pos');
  assert.strictEqual(updateResponse.body.data.plan_id, 7);
  assert(currentConnection.calls.some(sql =>
    /plan_programado_id = NULL, cambio_plan_efectivo_en = NULL/.test(sql)
  ));
  assert(currentConnection.calls.some(sql => /UPDATE empresas\s+SET plan = \?/.test(sql)));
  assert(currentConnection.calls.some(sql => /INSERT INTO historial_suscripciones/.test(sql)));
  assert.strictEqual(currentConnection.committed, true);

  console.log('OK subscriptionLifecycleBlockers: historial, limpieza de plan programado y limites validados');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
