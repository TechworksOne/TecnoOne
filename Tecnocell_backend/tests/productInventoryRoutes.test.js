const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'productRoutes.js'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'productController.js'), 'utf8');

assert.doesNotMatch(routes, /router\.use\(branchScope\)/);
assert.match(routes, /router\.patch\('\/:id\/stock'[\s\S]+branchScope[\s\S]+productController\.adjustStock/);
assert.match(routes, /router\.post\('\/'[\s\S]+productController\.createProduct/);
assert.match(routes, /router\.put\('\/:id'[\s\S]+productController\.updateProduct/);
assert.match(routes, /router\.delete\('\/:id'[\s\S]+productController\.deleteProduct/);
assert.doesNotMatch(controller, /deleteProduct[\s\S]{0,200}requireSpecific/);
assert.match(controller, /stockProjection\(req\.branchScope/);
assert.match(controller, /DIRECT_STOCK_UPDATE_FORBIDDEN/);
assert.match(controller, /ajustarExistencia\(\{/);
assert.match(controller, /listarMovimientos\(\{/);
assert.doesNotMatch(controller, /UPDATE productos\s+SET stock = \?/);
assert.doesNotMatch(controller, /INSERT INTO kardex/);

console.log('OK productInventoryRoutes: branchScope, lecturas y escrituras protegidas');
