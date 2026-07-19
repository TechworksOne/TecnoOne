const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = file => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');

const migration = read('Tecnocell_backend/scripts/migration_limite_sucursales_empresa_sprint_1_19.sql');
const controller = read('Tecnocell_backend/controllers/superAdminController.js');
const service = read('Tecnocell_backend/services/sucursalService.js');
const routes = read('Tecnocell_backend/routes/superAdminRoutes.js');

assert.match(migration, /ADD COLUMN IF NOT EXISTS limite_sucursales INT NULL/);
assert.match(migration, /GREATEST\(1, COALESCE\(s\.total, 0\)\)/);
assert.match(migration, /MODIFY COLUMN limite_sucursales INT NOT NULL DEFAULT 1/);
assert.match(migration, /CHECK \(limite_sucursales >= 1\)/);
assert.match(controller, /SELECT COUNT\(\*\) AS total FROM sucursales WHERE empresa_id = \?/);
assert.match(controller, /BRANCH_LIMIT_BELOW_USAGE/);
assert.match(controller, /El límite no puede ser menor que la cantidad de sucursales existentes\./);
assert.match(controller, /limiteSucursales < Number\(usage\.total\)/);
assert.match(service, /WHERE empresa_id = \?\$\{lock/);
assert.doesNotMatch(service, /WHERE empresa_id = \? AND activa = 1\$\{lock/);
assert.match(service, /BRANCH_LIMIT_REACHED/);
assert.match(service, /La empresa alcanzó el límite de sucursales permitido\./);
assert.match(routes, /router\.post\('\/empresas\/:id\/sucursales', sucursalController\.crear\)/);
console.log('OK limiteSucursalesEmpresa: migracion, backfill, conteo total, reduccion y rutas Super Admin');

