const assert = require('assert');

const pool = { getConnection: async () => null, query: async () => [[]] };
require.cache[require.resolve('../config/database')] = { exports: pool };
require.cache[require.resolve('../services/superAdminAuditService')] = {
  exports: { registrar: async () => true },
};

const controller = require('../controllers/subscriptionController');

function makeConnection({
  empresaEstado = 'activa',
  vencimiento = '2026-07-22',
  tipo = 'comercial',
  failHistory = false,
} = {}) {
  const calls = [];
  const connection = {
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
          plan: 'pro',
          fecha_inicio: '2026-01-01',
          fecha_vencimiento: vencimiento,
        }]];
      }
      if (/FROM suscripciones WHERE empresa_id = \? FOR UPDATE/.test(sql)) {
        return [[{
          id: 20,
          empresa_id: 10,
          plan: 'pro',
          tipo,
          estado: tipo === 'prueba' ? 'prueba' : 'vigente',
          fecha_inicio: '2026-01-01',
          fecha_vencimiento: vencimiento,
          dias_gracia: 5,
          fecha_fin_gracia: vencimiento ? require('../services/subscriptionAccessService').addDays(vencimiento, 5) : null,
          duracion_meses: null,
          proxima_a_vencer_dias: 7,
        }]];
      }
      if (/INSERT INTO historial_suscripciones/.test(sql) && failHistory) {
        throw new Error('history failed');
      }
      return [{ affectedRows: 1 }];
    },
  };
  return connection;
}

async function verifyMonths(months, expected) {
  const connection = makeConnection();
  const result = await controller.renovarSuscripcionTransaccional(connection, {
    empresaId: 10,
    meses: months,
    diasGracia: 5,
    motivo: 'QA',
    superAdminId: 99,
    hoy: '2026-06-22',
  });
  assert.strictEqual(result.next.fecha_vencimiento, expected);
  assert.strictEqual(result.next.estado, 'vigente');
  assert(connection.calls.some(sql => /INSERT INTO historial_suscripciones/.test(sql)));
}

async function main() {
  await verifyMonths(1, '2026-08-22');
  await verifyMonths(3, '2026-10-22');
  await verifyMonths(6, '2027-01-22');
  await verifyMonths(12, '2027-07-22');

  const expired = makeConnection({ vencimiento: '2026-06-01' });
  const expiredResult = await controller.renovarSuscripcionTransaccional(expired, {
    empresaId: 10,
    meses: 1,
    diasGracia: 0,
    superAdminId: 99,
    hoy: '2026-06-22',
  });
  assert.strictEqual(expiredResult.next.fecha_vencimiento, '2026-07-22');

  const suspended = makeConnection({ empresaEstado: 'suspendida', vencimiento: '2026-06-01' });
  const suspendedResult = await controller.renovarSuscripcionTransaccional(suspended, {
    empresaId: 10,
    meses: 1,
    diasGracia: 0,
    superAdminId: 99,
    hoy: '2026-06-22',
  });
  assert.strictEqual(suspendedResult.estado_empresa, 'activa');

  const cancelled = makeConnection({ empresaEstado: 'cancelada', vencimiento: '2026-06-01' });
  const cancelledResult = await controller.renovarSuscripcionTransaccional(cancelled, {
    empresaId: 10,
    meses: 1,
    diasGracia: 0,
    superAdminId: 99,
    hoy: '2026-06-22',
  });
  assert.strictEqual(cancelledResult.estado_empresa, 'cancelada');
  assert.strictEqual(cancelledResult.requiere_reactivacion_explicita, true);

  const failing = makeConnection({ failHistory: true });
  pool.getConnection = async () => failing;
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await controller.renovarSuscripcion({
      params: { id: 10 },
      body: { meses: 1, dias_gracia: 0 },
      superAdmin: { id: 99 },
    }, res);
  } finally {
    console.error = originalError;
  }
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(failing.rolledBack, true);
  assert.strictEqual(failing.committed, false);
  assert.strictEqual(failing.released, true);

  console.log('OK subscriptionRenewal: renovación, reactivación, historial y rollback validados');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
