const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = file => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
const page = read('src/pages/Cajas/CajasPage.tsx');
const manager = read('src/components/cajas/CajaManager.tsx');
const service = read('src/services/cajaCatalogoService.ts');

assert.match(page, /sucursalActiva\?\.id/);
assert.match(page, /contextVersion/);
assert.match(page, /mode === 'consolidated'/);
assert.match(manager, /requestSequence/);
assert.match(manager, /readOnlyConsolidated/);
assert.match(manager, /Vista consolidada de solo consulta/);
assert.doesNotMatch(page, /sucursal_id/);
assert.match(service, /X-Sucursal-Id/);
assert.match(service, /if \(!platform\)/);
assert.match(manager, /platform && !editing/);
assert.match(manager, /activar.*desactivar/);

console.log('OK cajaCatalogoFrontend: recarga segura y consolidado de solo consulta');
