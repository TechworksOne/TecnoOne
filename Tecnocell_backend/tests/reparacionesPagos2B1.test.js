'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(
    path.join(__dirname, '..', relativePath),
    'utf8'
  );
}

const controller = read(
  'controllers/reparacionController.js'
);

const migration = read(
  'scripts/migration_reparaciones_pagos_adicionales_sprint_2b1.sql'
);

// Esquema requerido.
assert.match(
  migration,
  /ADD COLUMN IF NOT EXISTS monto_pagado_adicional INT NOT NULL DEFAULT 0/
);

assert.match(
  migration,
  /ADD COLUMN IF NOT EXISTS metodo_pago_adicional VARCHAR\(30\) NULL/
);

// El saldo debe contemplar los tres componentes.
assert.match(
  controller,
  /Number\(rep\.monto_anticipo \|\| 0\)[\s\S]{0,180}Number\(rep\.monto_pagado_adicional \|\| 0\)[\s\S]{0,180}Number\(rep\.monto_pago_final \|\| 0\)/
);

// completarReparacion también debe acumular abonos adicionales.
assert.match(
  controller,
  /Number\(reparacion\.monto_anticipo \|\| 0\)[\s\S]{0,180}Number\(reparacion\.monto_pagado_adicional \|\| 0\)[\s\S]{0,180}montoPagoFinalCentavos/
);

// No debe usar índice financiero fijo.
// El anticipo inicial y su reverso usan indice cero legitimamente. Solo los
// pagos posteriores deben usar el indice calculado desde el ledger.

// Debe calcular siguiente índice desde el ledger.
const maxMatches =
  controller.match(
    /COALESCE\(MAX\(pago_indice\), -1\) \+ 1 AS siguiente_indice/g
  ) || [];

assert.ok(
  maxMatches.length >= 2,
  'registrarPagoSaldo y completarReparacion deben calcular siguiente índice'
);

const dynamicIndexMatches = controller.match(/pagoIndice,\s*\n/g) || [];
assert.ok(
  dynamicIndexMatches.length >= 2,
  'registrarPagoSaldo y completarReparacion deben usar el indice dinamico'
);

// Pago adicional mantiene agregados de la reparación.
assert.match(
  controller,
  /SET monto_pagado_adicional = \?[\s\S]{0,220}total_pagado = \?[\s\S]{0,120}estado_pago = \?/
);

// UPDATE scoped debe declarar el mismo alias usado por branch scope.
assert.match(
  controller,
  /UPDATE reparaciones r[\s\S]{0,260}WHERE r\.id = \?\$\{tenant\.sql\}/
);

// Efectivo no toma caja del request.
assert.doesNotMatch(
  controller,
  /const\s*\{\s*monto,\s*metodoPago,\s*cajaId\s*\}\s*=\s*req\.body/
);

console.log(
  'OK reparacionesPagos2B1: esquema, saldo acumulado e índice financiero'
);
