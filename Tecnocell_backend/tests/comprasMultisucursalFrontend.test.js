const assert = require('assert');
const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'pages', 'Purchases', 'PurchasesPage.tsx'),
  'utf8'
);

assert.match(page, /useSucursalContext/);
assert.match(page, /contextVersion/);
assert.match(page, /requestSequence/);
assert.match(page, /sequence !== requestSequence\.current/);
assert.match(page, /Todas las sucursales · solo consulta/);
assert.match(page, /disabled=\{readOnlyConsolidated\}/);
assert.doesNotMatch(page, /selector.*sucursal/i);

console.log('OK comprasMultisucursalFrontend: contexto, stale responses y solo lectura');
