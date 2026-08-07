'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const requireBranchSpecific = require('../middleware/requireBranchSpecific');

const specific     = { mode: 'specific',     sucursalId: 3,    allowedSucursalIds: [3] };
const consolidated = { mode: 'consolidated', sucursalId: null, allowedSucursalIds: [1, 2] };

function fakeRes() {
  const r = { statusCode: null, body: null };
  r.status = code => { r.statusCode = code; return r; };
  r.json   = body  => { r.body = body; };
  return r;
}

// ── 1. specific → llama next() ───────────────────────────────────────────────
let nextCalled = false;
requireBranchSpecific({ branchScope: specific }, fakeRes(), () => { nextCalled = true; });
assert.ok(nextCalled, 'debe llamar next() en modo specific con sucursalId');

// ── 2. consolidated → HTTP 400 + código canónico ─────────────────────────────
const resConsolidated = fakeRes();
requireBranchSpecific(
  { branchScope: consolidated },
  resConsolidated,
  () => assert.fail('no debe llamar next() en consolidated')
);
assert.strictEqual(resConsolidated.statusCode, 400);
assert.strictEqual(resConsolidated.body.code, 'BRANCH_SPECIFIC_REQUIRED');
assert.strictEqual(
  resConsolidated.body.message,
  'Seleccione una sucursal espec\u00edfica para realizar esta operaci\u00f3n.',
);

// ── 3. branchScope ausente / nulo / modo incorrecto → HTTP 400 ───────────────
const badScopes = [null, undefined, {}, { mode: 'specific', sucursalId: null }, { mode: 'other' }];
for (const bs of badScopes) {
  const r = fakeRes();
  requireBranchSpecific({ branchScope: bs }, r, () => assert.fail('no debe llamar next()'));
  assert.strictEqual(r.statusCode, 400);
  assert.strictEqual(r.body.code, 'BRANCH_SPECIFIC_REQUIRED');
}

// ── 4. El middleware NO importa ningún servicio de inventario ─────────────────
const middlewareSrc = fs.readFileSync(
  path.join(__dirname, '..', 'middleware', 'requireBranchSpecific.js'), 'utf8'
);
assert.doesNotMatch(middlewareSrc, /require.*[Ss]ervice/, 'sin dependencia de servicios');
assert.doesNotMatch(middlewareSrc, /productInventory/, 'sin dependencia de productInventoryService');
assert.match(middlewareSrc, /module\.exports = requireBranchSpecific/);

// ── 5. Todos los archivos de rutas multisucursal importan requireBranchSpecific
const routeFiles = [
  'ventaRoutes.js',
  'reparacionRoutes.js',
  'flujoReparacionRoutes.js',
  'compraRoutes.js',
  'cajaCatalogoRoutes.js',
].map(f => ({ name: f, src: fs.readFileSync(path.join(__dirname, '..', 'routes', f), 'utf8') }));

for (const { name, src } of routeFiles) {
  assert.match(src, /requireBranchSpecific/, name + ' debe importar requireBranchSpecific');
  assert.doesNotMatch(
    src,
    /const requireSpecific\w+ = \(req, res, next\)/,
    name + ' no debe tener definicion inline de requireSpecific*'
  );
}

// ── 6. Compra routes: todas las rutas de escritura tienen requireBranchSpecific
const compraRoutes = routeFiles.find(f => f.name === 'compraRoutes.js').src;
assert.match(compraRoutes, /router\.post\('\/productos'[\s\S]{0,80}requireBranchSpecific/);
assert.match(compraRoutes, /router\.post\('\/repuestos'[\s\S]{0,80}requireBranchSpecific/);
assert.match(compraRoutes, /router\.post\('\/'[\s\S]{0,80}requireBranchSpecific/);
assert.match(compraRoutes, /router\.post\('\/:id\/anular'[\s\S]{0,80}requireBranchSpecific/);

// ── 7. Producto routes: PATCH /:id/stock tiene requireBranchSpecific ──────────
const productRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'productRoutes.js'), 'utf8');
assert.match(
  productRoutes,
  /router\.patch\('\/:id\/stock'[\s\S]{0,120}requireBranchSpecific[\s\S]{0,80}productController\.adjustStock/
);

// ── 8. Repuesto routes: POST /:id/movimiento tiene requireBranchSpecific ──────
const repuestoRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'repuestoRoutes.js'), 'utf8');
assert.match(
  repuestoRoutes,
  /router\.post\('\/:id\/movimiento'[\s\S]{0,120}requireBranchSpecific[\s\S]{0,80}repuestoController\.registrarMovimiento/
);

// ── 9. Caja catálogo routes: escrituras tienen requireBranchSpecific ──────────
const cajaRoutes = routeFiles.find(f => f.name === 'cajaCatalogoRoutes.js').src;
assert.match(cajaRoutes, /router\.post\('[^']*'[\s\S]{0,60}requireBranchSpecific/);
assert.match(cajaRoutes, /router\.put\('[^']*'[\s\S]{0,60}requireBranchSpecific/);
assert.match(cajaRoutes, /router\.patch\('[^']*'[\s\S]{0,60}requireBranchSpecific/);
assert.match(cajaRoutes, /router\.delete\('[^']*'[\s\S]{0,60}requireBranchSpecific/);

console.log('OK requireBranchSpecific: independiente, HTTP 400, mensaje canonico, rutas protegidas');
