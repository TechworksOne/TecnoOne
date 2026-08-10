const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routes = fs.readFileSync(path.join(root, 'routes', 'reportesRoutes.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'controllers', 'reportesController.js'), 'utf8');
const service = require(path.join(root, 'services', 'reportScopeService'));

const request = branchScope => ({
  user: { id: 5, empresaId: 10 },
  tenant: { empresa_id: 10 },
  branchScope,
});

const specific = service.reportScopeClause(request({
  mode: 'specific', empresaId: 10, sucursalId: 18, allowedSucursalIds: [18, 19],
}), 'v');
assert.match(specific.sql, /v\.empresa_id = \? AND v\.sucursal_id IN \(\?\)/);
assert.deepStrictEqual(specific.params, [10, 18]);

const all = service.reportScopeClause(request({
  mode: 'consolidated', empresaId: 10, sucursalId: null, allowedSucursalIds: [18, 19, 19],
}), 'v');
assert.deepStrictEqual(all.params, [10, 18, 19]);
assert.match(all.sql, /v\.sucursal_id IN \(\?,\?\)/);

const empty = service.reportScopeClause(request({
  mode: 'consolidated', empresaId: 10, sucursalId: null, allowedSucursalIds: [],
}));
assert.strictEqual(empty.sql, ' AND 1 = 0');
assert.deepStrictEqual(empty.params, []);

assert.throws(() => service.normalizeScope(request({
  mode: 'specific', empresaId: 11, sucursalId: 18, allowedSucursalIds: [18],
})), /Contexto empresarial/);
assert.throws(() => service.normalizeScope({
  user: { esSuperAdmin: true }, tenant: { isSuperadmin: true },
  branchScope: { mode: 'consolidated', empresaId: 10, allowedSucursalIds: [18] },
}), /Super Admin/);

const productStock = service.inventoryStockClause(all.scope, 'p', 'producto_id');
assert.match(productStock.sql, /producto_existencias/);
assert.match(productStock.sql, /sucursal_id IN \(\?,\?\)/);
assert.deepStrictEqual(productStock.params, [18, 19]);
const spareStock = service.inventoryStockClause(all.scope, 'r', 'repuesto_id');
assert.match(spareStock.sql, /repuesto_existencias/);

assert.match(routes, /requirePermission\('reportes\.ver'\)[\s\S]*branchScope/);
for (const endpoint of ['resumen', 'diario', 'semanal', 'productos-mas-vendidos', 'historial-ventas', 'metricas-financieras']) {
  assert.match(routes, new RegExp(`router\\.get\\('/${endpoint.replace(/-/g, '\\-')}'`));
}
assert.doesNotMatch(controller, /req\.(query|body)\.sucursal_id/);
assert.match(controller, /por_sucursal/);
assert.match(controller, /producto_existencias/);
assert.match(controller, /repuesto_existencias/);
assert.match(controller, /COUNT\(\*\) AS total FROM ventas v/);
assert.match(controller, /totalPages/);
assert.match(controller, /caja_sesiones/);
assert.match(controller, /FROM compras c/);
assert.match(controller, /FROM reparaciones r/);
assert.match(controller, /producto_movimientos/);
assert.match(controller, /repuesto_movimientos/);
assert.deepStrictEqual(service.validateRange('2026-01-01', '2026-01-31'), {
  desde: '2026-01-01', hasta: '2026-01-31',
});
assert.throws(() => service.validateDate('2026-02-30', 'fecha'), /fecha no es una fecha válida/);
assert.throws(() => service.validateRange('2026-02-01', '2026-01-01'), /desde no puede/);

console.log('Sprint 2G-A report scope, stock, routes and management coverage: OK');
