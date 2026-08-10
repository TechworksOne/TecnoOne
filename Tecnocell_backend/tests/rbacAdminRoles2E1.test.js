'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controller = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'adminUsuariosController.js'), 'utf8'
);
const permissionController = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'permisoController.js'), 'utf8'
);
const authMiddleware = fs.readFileSync(
  path.join(__dirname, '..', 'middleware', 'authMiddleware.js'), 'utf8'
);

assert.match(controller, /FROM roles r[\s\S]{0,180}WHERE r\.empresa_id = \?/);
assert.match(controller, /SELECT id FROM roles WHERE empresa_id = \? AND nombre = \?/);
assert.match(controller, /INSERT INTO roles \(empresa_id, nombre, descripcion, activo, es_sistema\)/);
assert.match(controller, /SELECT id FROM roles WHERE id = \? AND empresa_id = \?/);
assert.match(controller, /UPDATE roles SET[\s\S]{0,160}WHERE id = \? AND empresa_id = \?/);
assert.match(controller, /FROM roles\s+WHERE empresa_id = \?[\s\S]{0,100}AND activo = 1[\s\S]{0,100}AND nombre IN/);
assert.match(controller, /roles no pertenecen a la empresa o están inactivos/);
assert.doesNotMatch(controller, /INSERT INTO roles \(nombre, descripcion\)/);

assert.match(permissionController, /WHERE r\.empresa_id = \?/);
assert.match(permissionController, /WHERE r\.id = \? AND r\.empresa_id = \?/);
assert.match(permissionController, /rp\.empresa_id = \? AND rp\.rol_id = \?/);
assert.match(authMiddleware, /r\.empresa_id = u\.empresa_id/);
assert.match(authMiddleware, /r\.activo = 1/);

console.log('rbacAdminRoles2E1.test.js OK');
