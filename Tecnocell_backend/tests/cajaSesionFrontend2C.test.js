'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relative) {
  return fs.readFileSync(
    path.join(root, relative),
    'utf8'
  );
}

const service = read(
  'src/services/cajaSesionService.ts'
);

const panel = read(
  'src/components/cajas/CajaSesionPanel.tsx'
);

const cajaBancos = read(
  'src/pages/CajaBancos/CajaBancosPage.tsx'
);

const saleForm = read(
  'src/components/sales/SaleFormModal.tsx'
);

const salesPage = read(
  'src/pages/Sales/SalesPageNew.tsx'
);

const saleNew = read(
  'src/pages/Sales/SaleNewPage.tsx'
);

const ventaService = read(
  'src/services/ventaService.ts'
);

// Servicio de sesión.
assert.match(
  service,
  /\/caja-sesiones\/activa/
);

assert.match(
  service,
  /\/caja-sesiones\/abrir/
);

assert.match(
  service,
  /\/caja-sesiones\/\$\{sesionId\}\/cerrar/
);

assert.match(
  service,
  /CAJA_SESION_REQUERIDA/
);

// La caja física se escoge al abrir sesión.
assert.match(
  panel,
  /empresaCajaApi\.listar/
);

assert.match(
  panel,
  /cajaSesionApi\.abrir/
);

assert.match(
  panel,
  /cajaSesionApi\.cerrar/
);

assert.match(
  panel,
  /Fondo inicial/
);

assert.match(
  panel,
  /Efectivo contado/
);

// Caja y Bancos integra el panel operativo.
assert.match(
  cajaBancos,
  /<CajaSesionPanel\s*\/>/
);

// Venta modal: sin selector ni caja manual.
assert.doesNotMatch(
  saleForm,
  /empresaCajaApi/
);

assert.doesNotMatch(
  saleForm,
  /\bcajaId\b/
);

assert.doesNotMatch(
  saleForm,
  /\bcaja_id\b/
);

assert.match(
  saleForm,
  /cajaSesionApi\.getActiva/
);

assert.match(
  saleForm,
  /Debes abrir una caja/
);

// Pago de venta existente: sin caja manual.
assert.doesNotMatch(
  salesPage,
  /\bpagoCajaId\b/
);

assert.doesNotMatch(
  salesPage,
  /empresaCajaApi/
);

assert.doesNotMatch(
  salesPage,
  /\bcaja_id\b/
);

assert.match(
  salesPage,
  /cajaSesionApi\.getActiva/
);

// Ruta /ventas/nueva también valida sesión.
assert.doesNotMatch(
  saleNew,
  /\bcaja_id\b/
);

assert.match(
  saleNew,
  /cajaSesionApi\.getActiva/
);

assert.match(
  saleNew,
  /Debes abrir una caja/
);

// Contrato de venta ya no acepta caja elegida por frontend.
assert.doesNotMatch(
  ventaService,
  /\bcaja_id\b/
);

console.log(
  'OK cajaSesionFrontend2C: apertura/cierre operativo y ventas sin autoridad manual de caja'
);
