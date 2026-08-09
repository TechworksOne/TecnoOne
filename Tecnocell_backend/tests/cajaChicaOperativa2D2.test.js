'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

const controller = fs.readFileSync(
  path.join(
    root,
    'Tecnocell_backend/controllers/cajaController.js'
  ),
  'utf8'
);

const routes = fs.readFileSync(
  path.join(
    root,
    'Tecnocell_backend/routes/cajaRoutes.js'
  ),
  'utf8'
);

assert.match(
  controller,
  /function bloquearCajaChicaYObtenerSaldo/
);

assert.match(
  controller,
  /FROM sucursales[\s\S]{0,180}FOR UPDATE/
);

assert.match(
  controller,
  /WHERE empresa_id = \?[\s\S]{0,80}sucursal_id = \?/
);

assert.match(
  controller,
  /CAJA_CHICA_SALDO_INSUFICIENTE/
);

assert.match(
  controller,
  /Fondo repuesto exitosamente/
);

assert.match(
  controller,
  /scope\.sucursalId/
);

assert.match(
  controller,
  /INSERT INTO caja_chica \([\s\S]{0,120}sucursal_id/
);

assert.doesNotMatch(
  controller,
  /registrarMovimientoCajaChica[\s\S]{0,900}realizado_por\s*\}\s*=\s*req\.body/
);

assert.match(
  routes,
  /\/retiro-banco[\s\S]{0,160}requireBranchSpecific/
);

assert.match(
  routes,
  /\/depositar-banco[\s\S]{0,160}requireBranchSpecific/
);

assert.match(
  routes,
  /\/transferir-caja-a-banco[\s\S]{0,160}requireBranchSpecific/
);

console.log(
  'OK cajaChicaOperativa2D2: saldo protegido, mutex por sucursal y puentes bancarios scoped'
);

// Verificaciones específicas para evitar falsos positivos.
const confirmarStart = controller.indexOf(
  'exports.confirmarMovimientoCajaChica = async'
);
const confirmarEnd = controller.indexOf(
  '// Confirmar movimiento bancario',
  confirmarStart
);
const confirmarBlock = controller.slice(
  confirmarStart,
  confirmarEnd
);

assert.match(
  confirmarBlock,
  /beginTransaction/
);
assert.match(
  confirmarBlock,
  /bloquearCajaChicaYObtenerSaldo/
);
assert.match(
  confirmarBlock,
  /sucursal_id = \?[\s\S]{0,100}FOR UPDATE/
);
assert.match(
  confirmarBlock,
  /CAJA_CHICA_SALDO_INSUFICIENTE/
);

const depositoStart = controller.indexOf(
  'exports.depositarAlBanco = async'
);
const depositoEnd = controller.indexOf(
  '// ========== INGRESO MANUAL DIRECTO A BANCO ==========',
  depositoStart
);
const depositoBlock = controller.slice(
  depositoStart,
  depositoEnd
);

assert.match(
  depositoBlock,
  /bloquearCajaChicaYObtenerSaldo/
);
assert.match(
  depositoBlock,
  /scope\.sucursalId/
);
assert.match(
  depositoBlock,
  /INSERT INTO caja_chica \([\s\S]{0,120}sucursal_id/
);
assert.match(
  depositoBlock,
  /FOR UPDATE/
);

console.log(
  'OK cajaChicaOperativa2D2 funciones criticas verificadas'
);
