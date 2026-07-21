const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = file => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');

const page = read('src/pages/Products/ProductsPage.tsx');
const store = read('src/store/useCatalog.ts');

assert.match(page, /useSucursalContext/);
assert.match(page, /contextVersion/);
assert.match(page, /Todas las sucursales · existencias en solo consulta/);
assert.match(page, /readOnlyConsolidated/);
assert.match(page, /disabled=\{stockReadOnly\}/);
assert.match(page, /StockAlertsWidget key=\{contextVersion\}/);
assert.match(store, /productLoadSequence/);
assert.match(store, /sequence !== productLoadSequence/);
assert.match(store, /products: \[\]/);
assert.doesNotMatch(store, /productData\.stock =/);

console.log('OK productInventoryFrontend: contexto, solo lectura y respuestas antiguas');
