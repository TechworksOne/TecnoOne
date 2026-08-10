'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relative), 'utf8');
}

const permissions = read('src/lib/permissions.ts');
const auth = read('src/store/useAuth.ts');
const protectedRoute = read('src/components/common/ProtectedRoute.tsx');
const routes = read('src/routes.tsx');
const sidebar = read('src/components/common/Sidebar.tsx');
const dashboard = read('src/pages/Dashboard/DashboardPage.tsx');
const products = read('src/pages/Products/ProductsPage.tsx');
const repuestos = read('src/pages/Repuestos/RepuestosPage.tsx');
const ot = read('src/pages/OrdenesTrabajo/OrdenesTrabajoPage.tsx');
const repairs = read('src/pages/Repairs/RepairsPage.tsx');
const flow = read('src/pages/FlujoReparaciones/FlujoReparacionDetailPage.tsx');
const agenda = read('src/pages/Agenda/AgendaPage.tsx');
const caja = read('src/pages/CajaBancos/CajaBancosPage.tsx');
const profile = read('src/pages/Profile/ProfilePage.tsx');

assert.doesNotMatch(permissions, /ADMIN_ONLY_ROUTES|canAccessRoute|canViewCosts|function isAdmin/);
assert.match(protectedRoute, /permission\s*\?\s*hasPermission\(permission\)/);
assert.doesNotMatch(protectedRoute, /canAccessRoute|ADMIN_ONLY_ROUTES/);
assert.match(routes, /path: "\/pago-tarjeta"[\s\S]*PPM\('ventas\.crear'/);
assert.match(routes, /path: "\/permisos"[\s\S]*PERMISSIONS\.PERMISOS_ADMINISTRAR/);
assert.doesNotMatch(routes, /ADMIN_VENTAS|APR\(|adminOnly/);

assert.match(sidebar, /hasPermission\(permission\)/);
assert.doesNotMatch(sidebar, /adminOnly|effectiveRoles|roles: \["ADMINISTRADOR/);

assert.match(dashboard, /data\.dashboardType === 'tecnico'/);
assert.match(dashboard, /data\.dashboardType === 'ventas'/);
assert.doesNotMatch(dashboard, /isAdminUser|isTecnicoUser|isVentasUser|ADMINISTRADOR/);
assert.match(dashboard, /ACTIVE_BRANCH_STORAGE_KEY/);
assert.match(dashboard, /"X-Sucursal-Id": activeBranch/);
assert.match(dashboard, /contextVersion/);

for (const source of [products, repuestos]) {
  assert.match(source, /hasPermission\(PERMISSIONS\.COSTOS_VER\)/);
  assert.doesNotMatch(source, /canViewCosts|isAdmin/);
}

assert.match(ot, /ORDENES_TRABAJO_VER_TODAS/);
assert.match(ot, /REPARACIONES_ASIGNAR_TECNICO/);
assert.match(ot, /canViewAllOrders/);
assert.match(ot, /canAssignTech/);
assert.match(repairs, /hasPermission\('reparaciones\.asignar_tecnico'\)/);
assert.match(repairs, /if \(canAssignTech\)[\s\S]*getTecnicos/);
assert.match(flow, /hasPermission\('reparaciones\.asignar_tecnico'\)/);
assert.match(agenda, /hasPermission\('agenda\.editar'\)/);
assert.doesNotMatch(agenda, /roles\?\.includes\('ADMINISTRADOR'\)/);

assert.match(caja, /hasPermission\('bancos\.administrar'\)/);
assert.match(caja, /hasPermission\('tarjetas\.ver'\)/);
assert.match(caja, /hasPermission\('tarjetas\.administrar'\)/);
assert.doesNotMatch(caja, /const isAdmin|roles\.includes\('ADMINISTRADOR'\)/);
assert.match(profile, /hasPermission\('costos\.ver'\)/);
assert.doesNotMatch(profile, /Acceso de administrador|userIsAdmin|canViewCosts/);

assert.match(auth, /state\.user\?\.role === "superadmin"/);
assert.match(auth, /return state\.permissions\.includes\(permission\)/);
assert.doesNotMatch(auth, /state\.permissions\.includes\("\*"\)/);

console.log('OK rbacFrontendAuthorization2E3: permisos efectivos sin bypass empresarial por rol');
