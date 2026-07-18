const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relative), 'utf8');
}

const service = read('src/services/sucursalService.ts');
const manager = read('src/components/sucursales/SucursalManager.tsx');
const routes = read('src/routes.tsx');
const superDetail = read('src/pages/SuperAdmin/SuperAdminEmpresaDetailPage.tsx');

assert.match(service, /\/admin\/sucursales/);
assert.match(service, /\/superadmin\/empresas\/\$\{empresaId\}\/sucursales/);
assert.match(service, /PLAN_LIMIT_CONFLICT/);
assert.match(service, /BRANCH_NOT_FOUND/);
assert.match(service, /DUPLICATE_BRANCH_CODE|BRANCH_CODE_CONFLICT/);
assert.match(service, /PRIMARY_BRANCH_REQUIRED/);
assert.match(manager, /Nueva sucursal/);
assert.match(manager, /Principal/);
assert.match(manager, /cambiarEstado/);
assert.match(routes, /path: "\/sucursales"/);
assert.match(superDetail, /<SucursalManager/);
assert.doesNotMatch(manager, /sucursal activa|seleccionar sucursal/i);

console.log('OK sucursalFrontendUi: CRUD, errores y vistas basicas validados');
