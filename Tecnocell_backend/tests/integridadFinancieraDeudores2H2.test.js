'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

require.cache[require.resolve('../config/database')] = { exports: {} };
const saleInventoryService = require('../services/saleInventoryService');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

async function testAuthoritativePrices() {
  const calls = [];
  const connection = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/FROM productos c/.test(sql)) return [[{ id: 9, nombre: 'Telefono', precio_centavos: 12550, existencia: 4 }]];
      if (/FROM repuestos c/.test(sql)) return [[{ id: 7, nombre: 'Pantalla', precio_centavos: 8000, existencia: 2 }]];
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
  const result = await saleInventoryService.priceSaleItems(connection, {
    branchScope: { mode: 'specific', empresaId: 3, sucursalId: 18 },
    items: [
      { source: 'PRODUCTO', ref_id: 9, cantidad: 2, precio_unitario: 1, subtotal: 2 },
      { source: 'REPUESTO', ref_id: 7, cantidad: 1, precio_unitario: 1, subtotal: 1 },
    ],
  });
  assert.strictEqual(result.subtotal, 33100);
  assert.strictEqual(result.items[0].precio_unitario, 12550);
  assert.strictEqual(result.items[1].precio_unitario, 8000);
  assert.deepStrictEqual(calls[0].params, [18, 9, 3]);
  await assert.rejects(
    saleInventoryService.priceSaleItems(connection, {
      branchScope: { mode: 'consolidated', empresaId: 3, allowedSucursalIds: [18] },
      items: [{ source: 'PRODUCTO', ref_id: 9, cantidad: 1 }],
    }),
    error => error.code === 'BRANCH_SPECIFIC_REQUIRED'
  );
}

async function main() {
  await testAuthoritativePrices();

  const caja = read('controllers/cajaController.js');
  const cajaRoutes = read('routes/cajaRoutes.js');
  assert.match(cajaRoutes, /bancos\/movimiento[^\n]*requireBranchSpecific/);
  assert.match(cajaRoutes, /bancos\/confirmar\/:id[^\n]*requireBranchSpecific/);
  assert.match(caja, /\['INGRESO', 'EGRESO'\]\.includes/);
  assert.match(caja, /montoNormalizado <= 0/);
  assert.match(caja, /SELECT \* FROM movimientos_bancarios[^`]+FOR UPDATE/);
  assert.match(caja, /connection\.beginTransaction\(\)/);
  assert.match(caja, /connection,\s*\n\s*strict: true/);
  assert.match(caja, /await connection\.commit\(\)/);
  assert.match(caja, /await connection\.rollback\(\)/);

  const venta = read('controllers/ventaController.js');
  const saleService = read('services/saleInventoryService.js');
  assert.match(venta, /priceSaleItems\(connection/);
  assert.match(venta, /SALE_TOTAL_MISMATCH/);
  assert.match(venta, /items: itemsAutorizados/);
  assert.match(venta, /monto: totalAutorizado/);
  assert.match(saleService, /precio_venta \* 100/);
  assert.match(saleService, /c\.precio_publico/);
  assert.match(saleService, /e\.sucursal_id = \?/);

  const routes = read('routes/deudoresRoutes.js');
  const deudores = read('controllers/deudoresController.js');
  const migration = read('scripts/migration_deudores_multisucursal_sprint_2h2.sql');
  assert.match(routes, /router\.use\(branchScope\)/);
  assert.match(routes, /requireBranchSpecific, deudoresController\.createDeudor/);
  assert.match(routes, /requireBranchSpecific, deudoresController\.registrarPago/);
  assert.match(routes, /requireBranchSpecific, deudoresController\.anularDeudor/);
  assert.match(deudores, /sucursal_id IN/);
  assert.match(deudores, /AND sucursal_id = \? LIMIT 1 FOR UPDATE/);
  assert.match(deudores, /DEUDOR_PAGO_REGISTRADO/);
  assert.match(deudores, /DEUDOR_ANULADO/);
  assert.match(deudores, /scope: 'branch'/);
  assert.match(deudores, /connection,\s*\n\s*strict: true/);
  assert.doesNotMatch(deudores, /UPDATE productos SET stock/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS sucursal_id/);
  assert.match(migration, /JOIN ventas/);
  assert.match(migration, /JOIN reparaciones/);
  assert.match(migration, /FOREIGN KEY \(empresa_id, sucursal_id\)/);

  console.log('OK integridadFinancieraDeudores2H2: bancos, precios autoritativos, scope, rollback y auditoria');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
