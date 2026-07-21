const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'repuestoRoutes.js'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'repuestoController.js'), 'utf8');
const purchases = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'compraController.js'), 'utf8');

assert.match(routes, /branchScope, repuestoController\.getAllRepuestos/);
assert.match(routes, /branchScope, repuestoController\.registrarMovimiento/);
assert.match(controller, /stockProjection\(req\.branchScope/);
assert.match(controller, /DIRECT_STOCK_UPDATE_FORBIDDEN/);
assert.match(controller, /repuestoInventoryService\.adjust/);
assert.match(controller, /repuestoInventoryService\.listMovements/);
assert.doesNotMatch(controller, /UPDATE repuestos SET stock =/);
assert.match(purchases, /repuestoInventoryService\.receivePurchase/);
assert.match(purchases, /repuestoInventoryService\.reversePurchase/);
assert.doesNotMatch(purchases, /UPDATE repuestos SET stock/);

console.log('OK repuestoInventoryRoutes: lecturas scoped y cero stock empresarial');
