'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const service = fs.readFileSync(
  path.join(root, 'services', 'reparacionInventoryService.js'),
  'utf8'
);

const controller = fs.readFileSync(
  path.join(root, 'controllers', 'reparacionController.js'),
  'utf8'
);

const migration = fs.readFileSync(
  path.join(
    root,
    'scripts',
    'migration_reparaciones_multisucursal_sprint_1_24.sql'
  ),
  'utf8'
);

const gitignore = fs.readFileSync(
  path.join(root, '..', '.gitignore'),
  'utf8'
);

assert.ok(
  service.includes('async function consumeRegalia(connection'),
  'Falta consumeRegalia'
);

assert.ok(
  service.includes('async function reverseRegalia(connection'),
  'Falta reverseRegalia'
);

assert.ok(
  service.includes('async function reverseAllRegalias(connection'),
  'Falta reverseAllRegalias'
);

assert.ok(
  service.includes('INSERT INTO producto_existencias'),
  'Debe usar producto_existencias'
);

assert.ok(
  service.includes('INSERT INTO producto_movimientos'),
  'Debe registrar producto_movimientos'
);

assert.ok(
  service.includes(
    'INSERT INTO reparacion_regalia_inventario_aplicaciones'
  ),
  'Debe registrar el ledger de regalías'
);

const inicioRegalias = controller.indexOf(
  '// ── 3. Procesar regalías'
);

const finRegalias = controller.indexOf(
  '// ── 4. Procesar pago final',
  inicioRegalias
);

assert.ok(
  inicioRegalias !== -1 && finRegalias !== -1,
  'No se encontró la sección de regalías'
);

const seccionRegalias = controller.slice(
  inicioRegalias,
  finRegalias
);

assert.ok(
  seccionRegalias.includes(
    'reparacionInventoryService.consumeRegalia'
  ),
  'El controlador debe consumir regalías mediante el servicio'
);

assert.ok(
  !/UPDATE productos[\s\S]*?SET stock/.test(seccionRegalias),
  'Las regalías no deben modificar productos.stock'
);

assert.ok(
  controller.includes(
    'reparacionInventoryService.reverseAllRegalias'
  ),
  'La cancelación debe revertir las regalías'
);

assert.ok(
  migration.includes(
    'CREATE TABLE IF NOT EXISTS reparacion_regalia_inventario_aplicaciones'
  ),
  'Falta la tabla ledger de regalías en la migración'
);

assert.ok(
  gitignore.includes(
    '!Tecnocell_backend/scripts/migration_reparaciones_multisucursal_sprint_1_24.sql'
  ),
  'La migración 1.24 sigue ignorada'
);

console.log(
  '✅ Regalías multisucursal: estructura, ledger y reversión validados'
);
