const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'migration_compras_multisucursal_sprint_1_22.sql'),
  'utf8'
);

assert.match(sql, /ADD COLUMN IF NOT EXISTS sucursal_id/);
assert.match(sql, /WHERE c\.sucursal_id IS NULL/);
assert.match(sql, /COUNT\(DISTINCT s\.id\) <> 1/);
assert.match(sql, /SIGNAL SQLSTATE '45000'/);
assert.match(sql, /SET c\.sucursal_id = s\.id[\s\S]+WHERE c\.sucursal_id IS NULL/);
assert.match(sql, /FOREIGN KEY \(empresa_id, sucursal_id\)/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS compra_inventario_aplicaciones/);
assert.match(sql, /UNIQUE KEY uk_compra_inventario_aplicacion/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS repuesto_existencias/);
assert.match(sql, /PRIMARY KEY \(empresa_id, sucursal_id, repuesto_id\)/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS repuesto_movimientos/);
assert.match(sql, /Backfill repuestos ambiguo/);
assert.match(sql, /INSERT INTO repuesto_existencias[\s\S]+WHERE NOT EXISTS/);
assert.doesNotMatch(sql, /DELETE FROM compras|DROP COLUMN/i);

console.log('OK comprasMultisucursalMigration: backfill estricto, FK e idempotencia');
