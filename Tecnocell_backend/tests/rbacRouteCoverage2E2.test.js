'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const tarjeta = read('routes/tarjetaCreditoRoutes.js');
const dashboard = read('routes/dashboardRoutes.js');
const ot = read('routes/otRoutes.js');
const reparacion = read('routes/reparacionRoutes.js');
const checkEquipo = read('routes/checkEquipoRoutes.js');
const migration = read('scripts/migration_permisos_backend_sprint_2e2.sql');
const authRoutes = read('routes/authRoutes.js');
const dashboardPage = fs.readFileSync(path.join(root, '..', 'src', 'pages', 'Dashboard', 'DashboardPage.tsx'), 'utf8');

for (const permission of ['tarjetas.ver', 'tarjetas.administrar']) {
  assert.match(tarjeta, new RegExp(`requirePermission\\('${permission.replace('.', '\\.')}'\\)`));
}
assert.match(dashboard, /requirePermission\('dashboard\.ver_financiero'\)/);
assert.match(dashboard, /requirePermission\('dashboard\.ver_tecnico'\)/);
assert.match(ot, /requirePermission\('ordenes_trabajo\.ver'\)/);
assert.match(reparacion, /asignar-tecnico'[\s\S]{0,140}requireBranchSpecific/);
assert.match(checkEquipo, /router\.post\('\/'[\s\S]{0,120}requireBranchSpecific/);
assert.match(checkEquipo, /router\.put\('\/:id'[\s\S]{0,120}requireBranchSpecific/);

for (const code of [
  'ordenes_trabajo.ver_todas', 'costos.ver', 'dashboard.ver_financiero',
  'dashboard.ver_ventas', 'dashboard.ver_tecnico',
]) assert.match(migration, new RegExp(code.replace('.', '\\.')));
assert.match(migration, /r\.empresa_id, r\.id, target\.id/);
assert.doesNotMatch(migration, /empresas\s+(?:\w+\s+)?CROSS JOIN\s+roles/i);
assert.doesNotMatch(read('routes/superAdminRoutes.js'), /requirePermission/);
assert.match(authRoutes, /mis-sucursales', verifyToken, tenantScope, sucursalContextController\.listarMisSucursales/);
assert.match(dashboardPage, /useSucursalContext\(state => state\.contextVersion\)/);
assert.match(dashboardPage, /ACTIVE_BRANCH_STORAGE_KEY/);
assert.match(dashboardPage, /localStorage\.getItem\(ACTIVE_BRANCH_STORAGE_KEY\)/);
assert.match(dashboardPage, /"X-Sucursal-Id": activeBranch/);
assert.match(dashboardPage, /\[user, contextVersion, branchContextLoading, branchContextUserId\]/);

console.log('rbacRouteCoverage2E2.test.js OK');
