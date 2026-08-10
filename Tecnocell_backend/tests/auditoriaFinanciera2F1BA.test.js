'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const backend = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(backend, relative), 'utf8');

const caja = read('controllers/cajaController.js');
const sesiones = read('models/cajaSesionModel.js');
const tarjetas = read('controllers/tarjetaCreditoController.js');
const ventas = read('controllers/ventaController.js');
const compras = read('controllers/compraController.js');
const auditoria = read('services/auditoriaService.js');
const migration = read('scripts/migration_auditoria_multisucursal_sprint_2f1a.sql');

function transactionally(source, action) {
  const at = source.indexOf(`accion: '${action}'`);
  assert.ok(at >= 0, `falta ${action}`);
  const block = source.slice(at, at + 1300);
  assert.match(block, /connection,?\s*(?:\n\s*)?strict: true|connection,\s*strict: true/);
  const commit = source.indexOf('commit()', at);
  assert.ok(commit > at, `${action} debe registrarse antes del commit`);
}

assert.match(sesiones, /accion: 'CAJA_SESION_ABIERTA'[\s\S]{0,300}scope: 'branch'|scope: 'branch'[\s\S]{0,300}accion: 'CAJA_SESION_ABIERTA'/);
assert.match(sesiones, /fondo_inicial_centavos[\s\S]{0,500}diferencia_apertura_centavos/);
assert.match(sesiones, /accion: 'CAJA_SESION_CERRADA'/);
assert.match(sesiones, /diferencia_centavos: diferencia/);
assert.match(sesiones, /'SOBRANTE'[\s\S]{0,80}'FALTANTE'/);
transactionally(sesiones, 'CAJA_SESION_ABIERTA');
transactionally(sesiones, 'CAJA_SESION_CERRADA');

assert.match(caja, /accion: 'CAJA_CHICA_MOVIMIENTO_REGISTRADO'/);
assert.match(caja, /accion: 'CAJA_CHICA_MOVIMIENTO_CONFIRMADO'/);
assert.match(caja, /accion: 'CAJA_CHICA_ARQUEO_REGISTRADO'/);
assert.match(caja, /accion: 'CAJA_CHICA_REPOSICION_MANUAL'/);
assert.match(caja, /accion: 'CAJA_CHICA_REPOSICION_BANCO'/);
assert.match(caja, /accion: 'BANCO_CREADO'/);
assert.match(caja, /accion: 'BANCO_EDITADO'/);
assert.match(caja, /accion: 'BANCO_DESACTIVADO'/);
assert.match(caja, /accion: 'BANCO_MOVIMIENTO_REGISTRADO'/);
assert.match(caja, /accion: 'BANCO_TRANSFERENCIA_REGISTRADA'/);
assert.match(caja, /WHERE id = \? AND empresa_id = \?/);

assert.match(tarjetas, /accion: 'TARJETA_CREADA'[\s\S]{0,250}scope: 'company'|scope: 'company'[\s\S]{0,250}accion: 'TARJETA_CREADA'/);
assert.match(tarjetas, /accion: 'TARJETA_EDITADA'/);
assert.match(tarjetas, /accion: 'TARJETA_DESACTIVADA'/);
assert.match(tarjetas, /accion: 'TARJETA_AJUSTE_REGISTRADO'/);
assert.match(tarjetas, /accion: 'TARJETA_PAGO_REGISTRADO'/);
transactionally(tarjetas, 'TARJETA_PAGO_REGISTRADO');

for (const action of ['VENTA_CREADA', 'VENTA_PAGO_REGISTRADO', 'VENTA_ANULADA']) {
  assert.strictEqual((ventas.match(new RegExp(`accion: '${action}'`, 'g')) || []).length, action === 'VENTA_CREADA' ? 2 : 1);
  transactionally(ventas, action);
}
assert.match(ventas, /sucursalId: Number\(req\.branchScope\.sucursalId\)/);
assert.match(ventas, /pago_parcial:/);

assert.match(compras, /accion: 'COMPRA_CREADA'/);
assert.match(compras, /accion: 'COMPRA_ANULADA'/);
assert.match(compras, /origen_financiero:/);
transactionally(compras, 'COMPRA_CREADA');
transactionally(compras, 'COMPRA_ANULADA');

assert.match(auditoria, /String\(candidate\)\.toUpperCase\(\) === 'ALL'/);
assert.match(auditoria, /branch\.mode !== 'specific'/);
assert.match(migration, /BEFORE UPDATE ON auditoria_logs/i);
assert.match(migration, /BEFORE DELETE ON auditoria_logs/i);

console.log('OK auditoriaFinanciera2F1BA: cobertura, scope, unicidad y atomicidad financiera');
