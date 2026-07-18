const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relative), 'utf8');
}

const service = read('src/services/sucursalContextService.ts');
const store = read('src/store/useSucursalContext.ts');
const selector = read('src/components/common/SucursalSelector.tsx');
const config = read('src/services/config.ts');

assert.match(service, /\/auth\/mis-sucursales/);
assert.match(store, /find\(item => item\.id === stored\)/);
assert.match(store, /find\(item => Boolean\(item\.es_predeterminada\)\)/);
assert.match(store, /\?\? sucursales\[0\]/);
assert.match(store, /localStorage\.setItem/);
assert.match(config, /X-Sucursal-Id/);
assert.match(config, /interceptors\.request\.use/);
assert.match(selector, /Sucursal activa/);
assert.match(selector, /el filtrado operativo llegará en una fase posterior/);
assert.match(selector, /user\.es_super_admin/);

console.log('OK sucursalSelectorFrontend: fallback, persistencia, interceptor y selector validados');
