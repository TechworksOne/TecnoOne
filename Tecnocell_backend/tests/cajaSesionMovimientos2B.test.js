'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relative) {
  return fs.readFileSync(
    path.join(__dirname, '..', relative),
    'utf8'
  );
}

const model = read('models/cajaSesionModel.js');
const saleService = read('services/saleInventoryService.js');
const repairService = read('services/reparacionInventoryService.js');
const saleController = read('controllers/ventaController.js');
const repairController = read('controllers/reparacionController.js');
const migration = read(
  'scripts/migration_caja_sesion_movimientos_sprint_2b.sql'
);

// Resolver transaccional.
assert.match(model, /resolverActivaParaOperacion/);
assert.match(
  model,
  /estado = 'ABIERTA'[\s\S]{0,160}FOR UPDATE/,
  'la sesión debe bloquearse durante la operación financiera'
);
assert.match(model, /usuario_apertura_id = \?/);

// Cierre usa movimientos reales de la sesión.
assert.match(model, /FROM venta_movimientos_financieros/);
assert.match(model, /FROM reparacion_movimientos_financieros/);
assert.match(model, /caja_sesion_id = \?/);
assert.match(model, /WHEN accion = 'REVERSA' THEN -monto_centavos/);

// Ledgers reciben caja y sesión desde backend.
assert.match(saleService, /caja_sesion_id/);
assert.match(repairService, /caja_sesion_id/);
assert.match(saleService, /resolverActivaParaOperacion/);
assert.match(repairService, /resolverActivaParaOperacion/);

// Controladores ya no deben pasar caja manual al ledger.
assert.doesNotMatch(
  saleController,
  /cajaId:\s*(pago\.caja_id\s*\?\?\s*caja_id|caja_id)/
);
assert.doesNotMatch(
  repairController,
  /cajaId:\s*metodoLedger/
);
assert.doesNotMatch(
  repairController,
  /pagoFinalCajaId/
);

// Migración.
assert.match(
  migration,
  /ADD COLUMN IF NOT EXISTS caja_sesion_id BIGINT UNSIGNED NULL/
);
assert.match(
  migration,
  /MODIFY COLUMN caja_id BIGINT UNSIGNED NULL/
);
assert.match(
  migration,
  /uk_caja_sesiones_movimiento_scope/
);
assert.match(
  migration,
  /FOREIGN KEY \(\s*empresa_id,\s*sucursal_id,\s*caja_id,\s*caja_sesion_id\s*\)/
);
assert.match(
  migration,
  /REFERENCES caja_sesiones \(\s*empresa_id,\s*sucursal_id,\s*caja_id,\s*id\s*\)/
);

console.log(
  'OK cajaSesionMovimientos2B: sesión transaccional, ledgers y cuadre vinculados'
);
