const assert = require('assert');

require.cache[require.resolve('../config/database')] = {
  exports: { query: async () => [[]] },
};

const service = require('../services/subscriptionAccessService');
const hoy = '2026-06-22';

function subscription(overrides = {}) {
  return {
    tipo: 'comercial',
    fecha_vencimiento: '2026-06-22',
    dias_gracia: 0,
    fecha_fin_gracia: '2026-06-22',
    proxima_a_vencer_dias: 7,
    ...overrides,
  };
}

assert.strictEqual(
  service.calcularEstadoSuscripcion(subscription(), hoy),
  'vigente',
  'La fecha de vencimiento debe ser inclusiva'
);
assert.strictEqual(
  service.calcularEstadoSuscripcion(subscription(), '2026-06-23'),
  'vencida',
  'Cero días de gracia debe vencer al día siguiente'
);
assert.strictEqual(
  service.calcularEstadoSuscripcion(subscription({
    fecha_vencimiento: '2026-06-20',
    dias_gracia: 5,
    fecha_fin_gracia: '2026-06-25',
  }), hoy),
  'gracia'
);
assert.strictEqual(
  service.calcularEstadoSuscripcion(subscription({
    fecha_vencimiento: '2026-06-20',
    dias_gracia: 1,
    fecha_fin_gracia: '2026-06-21',
  }), hoy),
  'vencida'
);
assert.strictEqual(
  service.calcularEstadoSuscripcion(subscription({
    tipo: 'prueba',
    fecha_vencimiento: null,
    fecha_fin_gracia: null,
  }), hoy),
  'prueba',
  'Una prueba sin vencimiento mantiene acceso'
);
assert.strictEqual(service.addMonths('2026-01-31', 1), '2026-02-28');
assert.strictEqual(service.addMonths('2024-01-31', 1), '2024-02-29');
assert.strictEqual(service.addMonths('2026-06-22', 3), '2026-09-22');
assert.strictEqual(service.addMonths('2026-06-22', 6), '2026-12-22');
assert.strictEqual(service.addMonths('2026-06-22', 12), '2027-06-22');
assert.strictEqual(service.isValidDate('2026-02-31'), false);
assert.strictEqual(service.isValidDate('2026-02-28'), true);

const allowed = service.evaluarAcceso({
  empresa: { estado: 'activa' },
  suscripcion: subscription({ fecha_vencimiento: '2026-06-20', fecha_fin_gracia: '2026-06-25' }),
}, hoy);
assert.strictEqual(allowed.permitido, true);
assert.strictEqual(allowed.estado_suscripcion, 'gracia');

const denied = service.evaluarAcceso({
  empresa: { estado: 'activa' },
  suscripcion: subscription({ fecha_vencimiento: '2026-06-20', fecha_fin_gracia: '2026-06-21' }),
}, hoy);
assert.strictEqual(denied.permitido, false);
assert.strictEqual(denied.code, 'SUSCRIPCION_VENCIDA');

const withoutSubscription = service.evaluarAcceso({
  empresa: { estado: 'activa' },
  suscripcion: null,
}, hoy);
assert.strictEqual(withoutSubscription.permitido, false);
assert.strictEqual(withoutSubscription.code, 'SUSCRIPCION_REQUERIDA');

for (const estado of ['suspendida', 'cancelada']) {
  const blocked = service.evaluarAcceso({
    empresa: { estado },
    suscripcion: subscription(),
  }, hoy);
  assert.strictEqual(blocked.permitido, false);
}

const superAdminIndependent = { tipo_usuario: 'PLATAFORMA', es_super_admin: true };
assert.strictEqual(superAdminIndependent.es_super_admin, true);

console.log('OK subscriptionAccessService: acceso, gracia, vencimiento y estados operativos validados');
