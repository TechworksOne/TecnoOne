'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const otRoutes = read('routes/otRoutes.js');
const otController = read('controllers/otController.js');
const agendaRoutes = read('routes/agendaRoutes.js');
const agendaController = read('controllers/agendaController.js');
const checkRoutes = read('routes/checkEquipoRoutes.js');
const checkController = read('controllers/checkEquipoController.js');
const repairRoutes = read('routes/reparacionRoutes.js');
const dashboardRoutes = read('routes/dashboardRoutes.js');
const dashboardController = read('controllers/dashboardController.js');
const flujoController = read('controllers/flujoReparacionController.js');

assert.match(otRoutes, /router\.use\(branchScope\)/);
assert.match(otController, /reparacionScopeClause\(req\.branchScope, alias\)/);
assert.match(agendaRoutes, /entregas'[\s\S]{0,100}branchScope/);
assert.match(agendaController, /reparacionScopeClause\(req\.branchScope, alias\)/);
assert.match(checkRoutes, /router\.use\(branchScope\)/);
assert.match(checkController, /reparacionScopeClause\(req\.branchScope, alias\)/);
assert.match(repairRoutes, /fecha-entrega'[\s\S]{0,150}requireBranchSpecific/);
assert.match(dashboardRoutes, /branchScope/);
assert.match(dashboardController, /tenantBranchClause/);
assert.match(dashboardController, /sucursal_id = \?/);
assert.match(dashboardController, /sucursal_id IN/);
assert.match(otController, /usuario_sucursales[\s\S]*us\.sucursal_id = \?/);
assert.match(flujoController, /usuario_sucursales[\s\S]*us\.sucursal_id = \?/);

for (const source of [otController, agendaController, checkController]) {
  assert.doesNotMatch(source, /(?:body|query)\.sucursal_id/);
}

const requireBranchSpecific = require('../middleware/requireBranchSpecific');
const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
let called = false;
requireBranchSpecific({ branchScope: { mode: 'consolidated' } }, res, () => { called = true; });
assert.strictEqual(called, false);
assert.strictEqual(res.statusCode, 400, 'ALL/consolidated debe rechazarse en writes');

console.log('rbacBranchIsolation2E2.test.js OK');
