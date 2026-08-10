const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const page = read('src/pages/Reports/ReportesPage.tsx');
const service = read('src/services/reportesService.ts');
const routes = read('src/routes.tsx');

assert.match(routes, /PERMISSIONS\.REPORTES_VER[\s\S]*<ReportesPage/);
assert.doesNotMatch(page, /role\s*===|ADMINISTRADOR|SUPER_ADMIN/);

assert.match(page, /useSucursalContext\(state => state\.mode\)/);
assert.match(page, /useSucursalContext\(state => state\.sucursalActiva\)/);
assert.match(page, /useSucursalContext\(state => state\.contextVersion\)/);
assert.match(page, /Todas las sucursales/);
assert.match(page, /key=\{contextVersion\}/);

assert.match(service, /ACTIVE_BRANCH_STORAGE_KEY/);
assert.match(service, /headers\['X-Sucursal-Id'\]\s*=\s*sucursalId/);
assert.match(page, /mode !== 'consolidated'/);
assert.match(page, /<BranchBreakdown rows=\{data\.por_sucursal\}/);

assert.match(page, /stock_actual/);
assert.doesNotMatch(page, /\.stock\b/);
assert.match(service, /totalPages: number/);
assert.match(page, /data\.totalPages/);
assert.match(page, /sucursal_nombre \|\| sucursalNombre\(v\.sucursal_id\)/);

assert.match(page, /'Codigo','Fecha','Sucursal'/);
assert.match(page, /CSV \(página actual\)/);
assert.match(page, /exportarCSV\(data\.data, sucursalNombre\)/);
assert.match(page, /replace\(\/"\/g, '""'\)/);

for (const metric of ['data.compras', 'data.caja_operativa', 'data.reparaciones', 'data.inventario']) {
  assert.ok(page.includes(metric), `Falta métrica ${metric}`);
}
assert.doesNotMatch(page, /bancos|tarjetas/i);

console.log('Sprint 2G-B frontend report context, breakdown, pagination and CSV: OK');
