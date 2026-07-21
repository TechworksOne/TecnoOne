const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'migration_contexto_multisucursal_sprint_1_20.sql'),
  'utf8'
);

assert.match(sql, /sucursales\.contexto_consolidado/);
assert.match(sql, /ON DUPLICATE KEY UPDATE/);
assert.match(sql, /INSERT IGNORE INTO rol_permisos/);
assert.match(sql, /UPPER\(r\.nombre\) = 'ADMINISTRADOR'/);
assert.doesNotMatch(sql, /INSERT INTO sucursales/i);

console.log('OK branchScopeMigration: permiso idempotente sin sucursal ficticia');
