'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(
  __dirname,
  '..',
  '..',
);

const caja = fs.readFileSync(
  path.join(
    root,
    'Tecnocell_backend/controllers/cajaController.js',
  ),
  'utf8',
);

const rep = fs.readFileSync(
  path.join(
    root,
    'Tecnocell_backend/controllers/reparacionController.js',
  ),
  'utf8',
);

const service = fs.readFileSync(
  path.join(
    root,
    'Tecnocell_backend/services/reparacionInventoryService.js',
  ),
  'utf8',
);

function block(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(
    endText,
    start,
  );

  assert.ok(
    start >= 0,
    `No se encontró ${startText}`,
  );

  assert.ok(
    end > start,
    `No se encontró fin para ${startText}`,
  );

  return source.slice(start, end);
}

const ventaLegacy = block(
  caja,
  'exports.registrarMovimientoVenta = async',
  'exports.registrarMovimientoReparacion = async',
);

assert.doesNotMatch(
  ventaLegacy,
  /INSERT INTO caja_chica/,
);

assert.match(
  ventaLegacy,
  /EFECTIVO_GESTIONADO_POR_CAJA_OPERATIVA/,
);

const reparacionLegacy = block(
  caja,
  'exports.registrarMovimientoReparacion = async',
  'exports.registrarReversaMovimientoVenta = async',
);

assert.doesNotMatch(
  reparacionLegacy,
  /INSERT INTO caja_chica/,
);

assert.match(
  reparacionLegacy,
  /EFECTIVO_GESTIONADO_POR_CAJA_OPERATIVA/,
);

const reversaVenta = block(
  caja,
  'exports.registrarReversaMovimientoVenta = async',
  '// ========== RETIRO DE BANCO ==========',
);

assert.doesNotMatch(
  reversaVenta,
  /caja_chica/,
);

assert.match(
  reversaVenta,
  /movimientos_bancarios/,
);

// Reparaciones nuevas no escriben comercialmente a Caja Chica.
assert.doesNotMatch(
  rep,
  /INSERT INTO caja_chica/,
);

assert.match(
  rep,
  /registerFinancialMovement\([\s\S]{0,500}pagoIndice:\s*0/,
);

assert.match(
  rep,
  /reverseFinancialPaymentAmount/,
);

const cancelarStart =
  rep.indexOf(
    'exports.cancelarReparacion = async'
  );

assert.ok(
  cancelarStart >= 0,
  'No se encontró cancelarReparacion'
);

const nextExport =
  rep.indexOf(
    '\nexports.',
    cancelarStart + 1,
  );

const cancelarBlock =
  rep.slice(
    cancelarStart,
    nextExport > cancelarStart
      ? nextExport
      : rep.length,
  );

assert.doesNotMatch(
  cancelarBlock,
  /INSERT INTO caja_chica/,
);

assert.match(
  cancelarBlock,
  /monto_pagado_adicional/
);

assert.match(
  cancelarBlock,
  /monto_pago_final/
);

assert.match(
  cancelarBlock,
  /REPAIR_CANCEL_ADDITIONAL_PAYMENTS_REQUIRE_REFUND_FLOW/
);

assert.match(
  cancelarBlock,
  /pagosPosterioresCentavos[\s\S]{0,800}res\.status\(409\)/
);

assert.match(
  rep,
  /reparacion_movimientos_financieros[\s\S]{0,500}EFECTIVO/,
);

assert.match(
  service,
  /async function reverseFinancialPaymentAmount/,
);

assert.match(
  service,
  /monto_centavos[\s\S]{0,600}REVERSA/,
);

assert.match(
  service,
  /resolverActivaParaOperacion/,
);

assert.match(
  service,
  /reverseFinancialPaymentAmount,/,
);

console.log(
  'OK cajaChicaDesacopleComercial2D3: ventas y reparaciones dejan de escribir efectivo comercial en Caja Chica',
);
