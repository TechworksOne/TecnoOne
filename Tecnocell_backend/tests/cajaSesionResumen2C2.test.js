'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  __dirname,
  '..',
  '..',
);

function read(relative) {
  return fs.readFileSync(
    path.join(root, relative),
    'utf8',
  );
}

const model = read(
  'Tecnocell_backend/models/cajaSesionModel.js',
);

const controller = read(
  'Tecnocell_backend/controllers/cajaSesionController.js',
);

const routes = read(
  'Tecnocell_backend/routes/cajaSesionRoutes.js',
);

const service = read(
  'src/services/cajaSesionService.ts',
);

const panel = read(
  'src/components/cajas/CajaSesionPanel.tsx',
);

const cajaBancos = read(
  'src/pages/CajaBancos/CajaBancosPage.tsx',
);

// ------------------------------------------------------------
// Backend: una sola fórmula para resumen + cierre.
// ------------------------------------------------------------

assert.match(
  model,
  /async function calcularEfectivoEsperado/,
);

assert.match(
  model,
  /venta_movimientos_financieros/,
);

assert.match(
  model,
  /reparacion_movimientos_financieros/,
);

assert.match(
  model,
  /movimientosEfectivo/,
);

assert.match(
  model,
  /efectivo_esperado_actual_centavos/,
);

const helperCalls = (
  model.match(
    /calcularEfectivoEsperado\(/g,
  ) || []
).length;

assert.ok(
  helperCalls >= 3,
  'definición + resumen + cierre deben reutilizar el helper',
);

assert.match(
  model,
  /async function obtenerResumenActiva/,
);

// ------------------------------------------------------------
// Controller / route.
// ------------------------------------------------------------

assert.match(
  controller,
  /getResumenActiva/,
);

assert.match(
  controller,
  /obtenerResumenActiva/,
);

assert.match(
  routes,
  /\/resumen-activa/,
);

assert.match(
  routes,
  /\/resumen-activa[\s\S]{0,180}cajas\.sesion\.operar[\s\S]{0,180}requireBranchSpecific/,
);

// ------------------------------------------------------------
// Frontend service.
// ------------------------------------------------------------

assert.strictEqual(
  (
    service.match(
      /export interface CajaSesionResumen/g,
    ) || []
  ).length,
  1,
  'CajaSesionResumen no debe estar duplicada',
);

assert.strictEqual(
  (
    service.match(
      /async getResumenActiva\(\)/g,
    ) || []
  ).length,
  1,
  'getResumenActiva no debe estar duplicado',
);

assert.match(
  service,
  /efectivo_esperado_actual_centavos/,
);

// ------------------------------------------------------------
// Panel.
// ------------------------------------------------------------

assert.match(
  panel,
  /CajaSesionResumen/,
);

assert.match(
  panel,
  /getResumenActiva/,
);

assert.match(
  panel,
  /Movimientos en efectivo/,
);

assert.match(
  panel,
  /Efectivo esperado/,
);

assert.match(
  panel,
  /ventas_efectivo_centavos/,
);

assert.match(
  panel,
  /reparaciones_efectivo_centavos/,
);

assert.match(
  panel,
  /efectivo_esperado_actual_centavos/,
);

// Caja Chica queda separada conceptualmente.
assert.match(
  cajaBancos,
  /Fondo para gastos menores/,
);

console.log(
  'OK cajaSesionResumen2C2: resumen operativo comparte cálculo con cierre y Caja Chica permanece separada',
);
