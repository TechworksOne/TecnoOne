const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'migration_ventas_multisucursal_sprint_1_23.sql'), 'utf8'
);
assert.match(sql, /ADD COLUMN IF NOT EXISTS sucursal_id/);
assert.match(sql, /WHERE v\.sucursal_id IS NULL/);
assert.match(sql, /COUNT\(DISTINCT s\.id\) <> 1/);
assert.match(sql, /SIGNAL SQLSTATE '45000'/);
assert.match(sql, /FOREIGN KEY \(empresa_id, sucursal_id\)/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS venta_inventario_aplicaciones/);
assert.match(sql, /UNIQUE KEY uk_venta_inventario_accion/);
assert.match(sql, /CREATE TABLE IF NOT EXISTS venta_movimientos_financieros/);
assert.match(sql, /UNIQUE KEY uk_venta_movimiento_financiero/);
assert.match(sql, /metodo = 'EFECTIVO' AND caja_id IS NOT NULL/);
assert.doesNotMatch(sql, /DELETE FROM ventas|DROP COLUMN/i);
console.log('OK ventasMultisucursalMigration: backfill estricto, FK, ledgers e idempotencia');
