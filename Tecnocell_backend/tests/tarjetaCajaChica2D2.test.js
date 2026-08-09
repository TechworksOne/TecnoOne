'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  __dirname,
  '..',
  '..',
);

const controller = fs.readFileSync(
  path.join(
    root,
    'Tecnocell_backend/controllers/tarjetaCreditoController.js',
  ),
  'utf8',
);

const routes = fs.readFileSync(
  path.join(
    root,
    'Tecnocell_backend/routes/tarjetaCreditoRoutes.js',
  ),
  'utf8',
);

const service = fs.readFileSync(
  path.join(
    root,
    'src/services/tarjetaCreditoService.ts',
  ),
  'utf8',
);

const page = fs.readFileSync(
  path.join(
    root,
    'src/pages/CajaBancos/CajaBancosPage.tsx',
  ),
  'utf8',
);

const start = controller.indexOf(
  'exports.registrarPago = async'
);

const end = controller.indexOf(
  '// ── POST /api/tarjetas-credito/:id/ajustes',
  start,
);

assert.ok(start >= 0);
assert.ok(end > start);

const pago = controller.slice(start, end);

// El contrato entrante es CENTAVOS.
assert.match(
  pago,
  /const montoCentavos = Number\(monto\)/
);

// No debe multiplicarse por 100 otra vez.
assert.doesNotMatch(
  pago,
  /qToCents\(monto\)/
);

// Caja/Banco trabajan en quetzales.
assert.match(
  pago,
  /const montoQuetzales\s*=\s*centsToQ\(montoCentavos\)/
);

// Tarjeta conserva centavos.
assert.match(
  pago,
  /tarjeta_credito_movimientos[\s\S]*montoCentavos/
);

// Caja Chica queda scoped.
assert.match(
  pago,
  /INSERT INTO caja_chica \([\s\S]{0,150}sucursal_id/
);

assert.match(
  pago,
  /CAJA_CHICA_SALDO_INSUFICIENTE/
);

assert.match(
  pago,
  /FROM sucursales[\s\S]{0,180}FOR UPDATE/
);

assert.match(
  pago,
  /cuentas_bancarias[\s\S]{0,200}FOR UPDATE/
);

assert.match(
  pago,
  /BANCO_SALDO_INSUFICIENTE/
);

// La ruta de escritura exige branch específico.
assert.match(
  routes,
  /require\('\.\.\/middleware\/branchScope'\)/
);

assert.match(
  routes,
  /require\('\.\.\/middleware\/requireBranchSpecific'\)/
);

assert.match(
  routes,
  /\/:id\/pagos[\s\S]{0,180}branchScope[\s\S]{0,180}requireBranchSpecific/
);

// Header explícito.
assert.match(
  service,
  /ACTIVE_BRANCH_STORAGE_KEY/
);

assert.match(
  service,
  /X-Sucursal-Id/
);

// Consolidado no puede abrir/ejecutar pago.
assert.match(
  page,
  /Selecciona una sucursal específica para registrar el pago/
);

// El frontend actualmente convierte Q -> centavos antes del service.
assert.match(
  page,
  /Math\.round\([\s\S]{0,100}\* 100\)/
);

console.log(
  'OK tarjetaCajaChica2D2: unidades correctas, saldo protegido y pago scoped por sucursal',
);
