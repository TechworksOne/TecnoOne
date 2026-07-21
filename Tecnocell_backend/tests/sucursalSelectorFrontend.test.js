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
const context = read('src/lib/branchContext.ts');
const auth = read('src/services/authService.ts');

assert.match(service, /\/auth\/mis-sucursales/);
assert.match(service, /canUseConsolidated/);
assert.match(service, /defaultSucursalId/);
assert.match(store, /find\(item => item\.id === stored\)/);
assert.match(store, /find\(item => Boolean\(item\.es_predeterminada\)\)/);
assert.match(store, /\?\? sucursales\[0\]/);
assert.match(store, /mode: 'consolidated'/);
assert.match(store, /CONSOLIDATED_BRANCH_VALUE/);
assert.match(store, /contextVersion/);
assert.match(store, /notifyBranchContextChanged/);
assert.match(config, /X-Sucursal-Id/);
assert.match(config, /interceptors\.request\.use/);
assert.match(context, /CONSOLIDATED_BRANCH_VALUE = 'ALL'/);
assert.match(selector, /Sucursal activa/);
assert.match(selector, /Todas las sucursales/);
assert.match(selector, /canUseConsolidated/);
assert.match(selector, /user\.es_super_admin/);
assert.match(auth, /sucursalActivaId\.\$\{currentUser\.id\}/);

console.log('OK sucursalSelectorFrontend: modos, persistencia, invalidacion y selector');
