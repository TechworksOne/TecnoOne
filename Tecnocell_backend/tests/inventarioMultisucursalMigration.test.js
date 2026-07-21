const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'migration_inventario_multisucursal_sprint_1_21.sql'),
  'utf8'
);

assert.match(sql, /CREATE TABLE IF NOT EXISTS producto_existencias/);
assert.match(sql, /PRIMARY KEY \(empresa_id, sucursal_id, producto_id\)/);
assert.match(sql, /FOREIGN KEY \(empresa_id, producto_id\)/);
assert.match(sql, /FOREIGN KEY \(empresa_id, sucursal_id\)/);
assert.match(sql, /CHECK \(existencia >= 0\)/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS producto_movimientos/);
assert.match(sql, /SIGNAL SQLSTATE '45000'/);
assert.match(sql, /s\.es_principal = 1/);
assert.match(sql, /COUNT\(DISTINCT s\.id\) <> 1/);
assert.match(sql, /LEFT JOIN sucursales[\s\S]+WHERE NOT EXISTS[\s\S]+GROUP BY p\.empresa_id/);
assert.match(sql, /WHERE NOT EXISTS[\s\S]+producto_existencias pe/);
assert.doesNotMatch(sql, /DELETE FROM productos|DROP COLUMN stock/i);

console.log('OK inventarioMultisucursalMigration: esquema, backfill seguro e idempotencia');
