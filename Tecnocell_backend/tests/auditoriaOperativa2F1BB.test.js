'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const reparacion = read('controllers/reparacionController.js');
const ot = read('controllers/otController.js');
const agenda = read('controllers/agendaController.js');
const repuesto = read('controllers/repuestoController.js');
const repuestoService = read('services/repuestoInventoryService.js');
const usuarios = read('controllers/adminUsuariosController.js');
const permisos = read('controllers/permisoController.js');
const sucursales = read('controllers/sucursalController.js');
const empresa = read('controllers/empresaController.js');
const auditoria = read('services/auditoriaService.js');

function event(source, action, scope) {
  const index = source.indexOf(`accion: '${action}'`);
  assert.ok(index >= 0, `falta ${action}`);
  const block = source.slice(Math.max(0, index - 250), index + 900);
  assert.match(block, new RegExp(`scope: '${scope}'`), `${action} debe usar ${scope}`);
  return { index, block };
}

function transactional(source, action) {
  const { index, block } = event(source, action, 'branch');
  assert.match(block, /connection,?\s*(?:\r?\n\s*)?strict: true|connection,\s*strict: true/);
  assert.ok(source.indexOf('commit()', index) > index, `${action} debe preceder commit`);
}

for (const action of ['REPARACION_CREADA', 'REPARACION_ESTADO_CAMBIADO', 'REPARACION_CANCELADA', 'REPARACION_FINALIZADA']) {
  transactional(reparacion, action);
}
assert.strictEqual((reparacion.match(/accion: 'REPARACION_CREADA'/g) || []).length, 1);
event(ot, 'REPARACION_TECNICO_ASIGNADO', 'branch');
event(agenda, 'REPARACION_FECHA_ENTREGA_CAMBIADA', 'branch');
assert.match(reparacion, /repuestos_consumidos/);

assert.match(repuesto, /'INVENTARIO_ENTRADA'/);
assert.match(repuesto, /'INVENTARIO_AJUSTE'/);
assert.match(repuesto, /'INVENTARIO_SALIDA'/);
assert.match(repuesto, /scope: 'branch'/);
assert.match(repuestoService, /await data\.audit\(connection, result\)[\s\S]{0,100}await connection\.commit\(\)/);
assert.match(repuestoService, /empresa_id = \?[\s\S]{0,100}sucursal_id = \?/);

for (const action of ['USUARIO_CREADO', 'USUARIO_EDITADO', 'USUARIO_ESTADO_CAMBIADO', 'USUARIO_ROL_CAMBIADO', 'ROL_CREADO']) {
  event(usuarios, action, 'company');
}
event(permisos, 'ROL_PERMISOS_CAMBIADOS', 'company');
assert.match(permisos, /ROL_PERMISOS_CAMBIADOS[\s\S]{0,500}connection,[\s\S]{0,80}strict: true[\s\S]{0,100}commit\(\)/);

for (const action of ['USUARIO_SUCURSAL_ASIGNADA', 'USUARIO_SUCURSAL_RETIRADA', 'USUARIO_SUCURSAL_DEFAULT_CAMBIADA']) {
  assert.match(sucursales, new RegExp(`'${action}'`));
}
assert.match(sucursales, /for \(const \[accion, cambio\] of eventos\)[\s\S]{0,350}scope: 'company'/);
for (const action of ['SUCURSAL_CREADA', 'SUCURSAL_EDITADA', 'SUCURSAL_ESTADO_CAMBIADO']) event(sucursales, action, 'company');
event(empresa, 'EMPRESA_CONFIGURACION_EDITADA', 'company');
assert.match(empresa, /datosAnteriores: empresaAnterior/);

assert.match(auditoria, /password\|contrasen/);
assert.match(auditoria, /token\|cookie/);
assert.match(auditoria, /base64\|imagen/);
assert.match(auditoria, /String\(candidate\)\.toUpperCase\(\) === 'ALL'/);
assert.match(auditoria, /Number\(candidate\) !== Number\(branch\.sucursalId\)/);
assert.doesNotMatch(reparacion.slice(reparacion.indexOf("accion: 'REPARACION_CREADA'"), reparacion.indexOf("accion: 'REPARACION_CREADA'") + 800), /datosNuevos: req\.body/);

console.log('OK auditoriaOperativa2F1BB: reparaciones, inventario, usuarios, RBAC, sucursales y empresa');
