const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'compraRoutes.js'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'compraController.js'), 'utf8');

assert.match(routes, /router\.use\(branchScope\)/);
assert.match(controller, /purchaseScopeClause\(req\.branchScope/);
assert.match(controller, /requireSpecific\(req\.branchScope\)/);
assert.match(controller, /receiveProduct\(connection/);
assert.match(controller, /reverseProduct\(connection/);
assert.match(controller, /SELECT \* FROM compras WHERE id = \?\$\{scope\.sql\} FOR UPDATE/);
assert.match(controller, /empresa_id = \? AND sucursal_id = \?/);
assert.doesNotMatch(controller, /UPDATE productos SET stock = stock \+/);
assert.doesNotMatch(controller, /GREATEST\(0, stock - \?\)/);

console.log('OK comprasMultisucursalRoutes: branchScope, aislamiento y cero stock legado de productos');
