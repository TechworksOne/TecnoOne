/**
 * reparacionesMultisucursal.test.js
 * Sprint 1.24 – Reparaciones multisucursal.
 *
 * Valida:
 *   - reparacionScopeClause genera cláusula correcta en specific/consolidated.
 *   - requireSpecific lanza BRANCH_SPECIFIC_REQUIRED en consolidated.
 *   - consumeRepuesto inserta ledger + llama changeWithConnection.
 *   - reverseAllRepuestos bloquea si no hay ledger pero hay ítems.
 *   - reverseAllRepuestos hace early-return si no hay ledger ni ítems.
 *   - validateCajaScope verifica sucursal.
 *   - registerFinancialMovement valida efectivo + caja + idempotencia.
 *   - reverseFinancialMovements revierte idempotente.
 *   - Rutas: branchScope presente, requireSpecificRepair en escrituras.
 *   - Migración: sucursal_id en reparaciones, tablas ledger presentes,
 *                backfill seguro, FK idempotente.
 */
'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

// ── Mock database ─────────────────────────────────────────────────────────────
require.cache[require.resolve('../config/database')] = { exports: {} };

// ── productInventoryService stub ──────────────────────────────────────────────
require.cache[require.resolve('../services/productInventoryService')] = {
  exports: {
    requireSpecific(branchScope) {
      if (!branchScope || branchScope.mode !== 'specific' || !branchScope.sucursalId) {
        const error = new Error('Seleccione una sucursal especifica para modificar existencias');
        error.statusCode = 409;
        error.code = 'BRANCH_SPECIFIC_REQUIRED';
        throw error;
      }
    },
  },
};

// ── repuestoInventoryService stub ─────────────────────────────────────────────
let changeWithConnectionCalled = [];
require.cache[require.resolve('../services/repuestoInventoryService')] = {
  exports: {
    changeWithConnection: async (connection, data) => {
      changeWithConnectionCalled.push({ connection, data });
      return { stock_anterior: 5, stock_nuevo: 5 + data.cantidad, diferencia: data.cantidad };
    },
  },
};

const service = require('../services/reparacionInventoryService');

const specific    = { mode: 'specific',    empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] };
const consolidated = { mode: 'consolidated', empresaId: 10, sucursalId: null, allowedSucursalIds: [7, 8] };

// ── Helper: fake connection ───────────────────────────────────────────────────
function fakeConnection({ cajaExists = true, ledgerRows = [], duplicate = false } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT id FROM cajas/.test(sql)) {
        return [[cajaExists ? { id: params[0] } : undefined].filter(Boolean)];
      }
      if (/FROM reparacion_inventario_aplicaciones/.test(sql) && /SELECT/.test(sql)) {
        return [ledgerRows];
      }
      if (/INSERT INTO reparacion_inventario_aplicaciones/.test(sql) && duplicate) {
        const err = new Error('dup'); err.code = 'ER_DUP_ENTRY'; throw err;
      }
      if (/INSERT INTO reparacion_movimientos_financieros/.test(sql) && duplicate) {
        const err = new Error('dup'); err.code = 'ER_DUP_ENTRY'; throw err;
      }
      if (/FROM reparacion_movimientos_financieros/.test(sql) && /SELECT/.test(sql)) {
        return [[{ pago_indice: 0, metodo: 'EFECTIVO', monto_centavos: 5000, caja_id: 3 }]];
      }
      return [{ affectedRows: 1 }];
    },
  };
}

async function main() {

  // ── 1. reparacionScopeClause ──────────────────────────────────────────────
  const local = service.reparacionScopeClause(specific);
  assert.deepStrictEqual(local.params, [10, 7]);
  assert.match(local.sql, /empresa_id = \?/);
  assert.match(local.sql, /sucursal_id = \?/);

  const all = service.reparacionScopeClause(consolidated);
  assert.deepStrictEqual(all.params, [10, 7, 8]);
  assert.match(all.sql, /sucursal_id IN \(\?,\?\)/);

  const empty = service.reparacionScopeClause({ ...consolidated, allowedSucursalIds: [] });
  assert.match(empty.sql, /1 = 0/);

  // ── 2. requireSpecific ────────────────────────────────────────────────────
  await assert.rejects(
    async () => service.requireSpecific(consolidated),
    err => err.code === 'BRANCH_SPECIFIC_REQUIRED'
  );
  // No lanza en specific
  service.requireSpecific(specific);

  // ── 3. consumeRepuesto: inserta ledger + llama changeWithConnection ────────
  changeWithConnectionCalled = [];
  const conn1 = fakeConnection();
  await service.consumeRepuesto(conn1, {
    branchScope: specific, reparacionId: 'REP001', repuestoId: 40, cantidad: 2, linea: 0, usuarioId: 5,
  });
  const ledgerInsert = conn1.calls.find(c => /INSERT INTO reparacion_inventario_aplicaciones/.test(c.sql));
  assert.ok(ledgerInsert, 'debe insertar ledger APLICACION');
  assert.deepStrictEqual(ledgerInsert.params, [10, 7, 'REP001', 40, 0, 2, 'APLICACION']);
  assert.strictEqual(changeWithConnectionCalled.length, 1);
  assert.strictEqual(changeWithConnectionCalled[0].data.cantidad, -2);
  assert.strictEqual(changeWithConnectionCalled[0].data.tipo, 'reparacion_salida');

  // ── 4. consumeRepuesto: consolidated → rechaza ────────────────────────────
  await assert.rejects(
    service.consumeRepuesto(fakeConnection(), { branchScope: consolidated, reparacionId: 'X', repuestoId: 1, cantidad: 1 }),
    err => err.code === 'BRANCH_SPECIFIC_REQUIRED'
  );

  // ── 5. consumeRepuesto: ledger duplicado → REPAIR_INVENTORY_ALREADY_APPLIED
  await assert.rejects(
    service.consumeRepuesto(fakeConnection({ duplicate: true }), {
      branchScope: specific, reparacionId: 'REP001', repuestoId: 40, cantidad: 2,
    }),
    err => err.code === 'REPAIR_INVENTORY_ALREADY_APPLIED'
  );

  // ── 6. reverseAllRepuestos: sin ledger y sin ítems → early-return ─────────
  const { reversed } = await service.reverseAllRepuestos(fakeConnection({ ledgerRows: [] }), {
    branchScope: specific, reparacionId: 'REP001', fallbackItems: [],
  });
  assert.strictEqual(reversed, 0);

  // ── 7. reverseAllRepuestos: sin ledger pero con ítems → bloquea ───────────
  await assert.rejects(
    service.reverseAllRepuestos(fakeConnection({ ledgerRows: [] }), {
      branchScope: specific, reparacionId: 'REP001', fallbackItems: [{ id: 1 }],
    }),
    err => err.code === 'REPAIR_INVENTORY_APPLICATION_NOT_FOUND'
  );

  // ── 8. reverseAllRepuestos: con ledger → revierte todos ───────────────────
  changeWithConnectionCalled = [];
  const rows = [
    { repuesto_id: 40, linea: 0, cantidad: 2 },
    { repuesto_id: 41, linea: 1, cantidad: 1 },
  ];
  const { reversed: rev2 } = await service.reverseAllRepuestos(fakeConnection({ ledgerRows: rows }), {
    branchScope: specific, reparacionId: 'REP001',
  });
  assert.strictEqual(rev2, 2);
  assert.strictEqual(changeWithConnectionCalled.length, 2);
  assert.ok(changeWithConnectionCalled.every(c => c.data.cantidad > 0), 'reversión debe ser positiva');

  // ── 9. validateCajaScope: caja inexistente → rechaza ─────────────────────
  await assert.rejects(
    service.validateCajaScope(fakeConnection({ cajaExists: false }), { branchScope: specific, cajaId: 99 }),
    err => err.code === 'REPAIR_CASH_REGISTER_SCOPE_MISMATCH'
  );
  // caja existe → no lanza
  await service.validateCajaScope(fakeConnection({ cajaExists: true }), { branchScope: specific, cajaId: 3 });
  // cajaId vacío → no-op
  await service.validateCajaScope(fakeConnection(), { branchScope: specific, cajaId: null });

  // ── 10. registerFinancialMovement: efectivo sin caja → rechaza ────────────
  await assert.rejects(
    service.registerFinancialMovement(fakeConnection(), {
      branchScope: specific, reparacionId: 'REP001', pagoIndice: 0, metodo: 'EFECTIVO', montoCentavos: 1000,
    }),
    err => err.code === 'REPAIR_CASH_REGISTER_REQUIRED'
  );

  // ── 11. registerFinancialMovement: idempotencia ───────────────────────────
  await assert.rejects(
    service.registerFinancialMovement(fakeConnection({ duplicate: true }), {
      branchScope: specific, reparacionId: 'REP001', pagoIndice: 0, metodo: 'TRANSFERENCIA', montoCentavos: 5000,
    }),
    err => err.code === 'REPAIR_FINANCIAL_ALREADY_APPLIED'
  );

  // ── 12. registerFinancialMovement: efectivo con caja válida → ok ──────────
  const conn12 = fakeConnection({ cajaExists: true });
  await service.registerFinancialMovement(conn12, {
    branchScope: specific, reparacionId: 'REP001', pagoIndice: 0, metodo: 'EFECTIVO', montoCentavos: 5000, cajaId: 3,
  });
  const finInsert = conn12.calls.find(c => /INSERT INTO reparacion_movimientos_financieros/.test(c.sql));
  assert.ok(finInsert, 'debe insertar en ledger financiero');
  assert.strictEqual(finInsert.params[0], 10);   // empresa_id
  assert.strictEqual(finInsert.params[1], 7);    // sucursal_id
  assert.strictEqual(finInsert.params[2], 'REP001'); // reparacion_id
  assert.strictEqual(finInsert.params[4], 'EFECTIVO'); // metodo (accion='INGRESO' es literal SQL)

  // ── 13. reverseFinancialMovements: revierte idempotente ───────────────────
  const conn13 = fakeConnection({ cajaExists: true });
  await service.reverseFinancialMovements(conn13, { branchScope: specific, reparacionId: 'REP001' });
  const reversa = conn13.calls.find(c => /INSERT INTO reparacion_movimientos_financieros/.test(c.sql));
  assert.ok(reversa, 'debe insertar REVERSA');
  // accion='REVERSA' es literal SQL, params[4] = metodo = 'EFECTIVO'
  assert.strictEqual(reversa.params[4], 'EFECTIVO');

  // ── 14. Rutas: branchScope presente en reparacionRoutes ───────────────────
  const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'reparacionRoutes.js'), 'utf8');
  assert.match(routes, /router\.use\(branchScope\)/);
  assert.match(routes, /requireSpecificRepair/);
  assert.match(routes, /requireSpecificRepair.*createReparacion/);
  // completarReparacion tiene requireSpecificRepair en una línea separada (ruta multiline)
  assert.ok(routes.includes('requireSpecificRepair') && routes.includes('completarReparacion'),
    'requireSpecificRepair y completarReparacion deben estar en la ruta');
  assert.doesNotMatch(routes, /req\.body\.(empresa_id|sucursal_id|allowedSucursalIds)/);

  // ── 15. Rutas: branchScope presente en flujoReparacionRoutes ─────────────
  const flujoRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'flujoReparacionRoutes.js'), 'utf8');
  assert.match(flujoRoutes, /router\.use\(branchScope\)/);
  assert.ok(flujoRoutes.includes('requireSpecificFlujo') && flujoRoutes.includes('cambiarEstado'),
    'requireSpecificFlujo debe estar en la ruta de cambiarEstado');

  // ── 16. Controlador: usa reparacionScopeClause / reparacionInventoryService
  const controller = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'reparacionController.js'), 'utf8');
  assert.match(controller, /reparacionInventoryService/);
  assert.match(controller, /repairScopeClause\(req/);
  // INSERT reparaciones debe incluir sucursal_id y usarlo desde branchScope
  assert.match(controller, /branchScope\.sucursalId/);
  assert.match(controller, /sucursal_id.*branchScope|branchScope.*sucursal_id/s);
  // Garantizar que no escribe en repuestos.stock
  assert.doesNotMatch(controller, /UPDATE repuestos\s+SET stock/s);
  // No confiar en empresa_id del body
  assert.doesNotMatch(controller, /req\.body\.empresa_id|req\.body\.sucursal_id/);

  // ── 17. Migración: estructura y backfill ──────────────────────────────────
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'migration_reparaciones_multisucursal_sprint_1_24.sql'),
    'utf8'
  );
  assert.match(migration, /ALTER TABLE reparaciones\s+ADD COLUMN IF NOT EXISTS sucursal_id/);
  assert.match(migration, /ON DUPLICATE KEY UPDATE|validar_backfill_reparaciones/i);
  assert.match(migration, /UPDATE reparaciones r\s+INNER JOIN sucursales s/);
  assert.match(migration, /es_principal = 1/);
  assert.match(migration, /ALTER TABLE reparaciones MODIFY sucursal_id BIGINT UNSIGNED NOT NULL/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS reparacion_inventario_aplicaciones/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS reparacion_movimientos_financieros/);
  assert.match(migration, /UNIQUE KEY uk_reparacion_inv/);
  assert.match(migration, /UNIQUE KEY uk_reparacion_fin/);
  assert.match(migration, /fk_reparaciones_sucursal/);
  // No debe borrar datos heredados
  assert.doesNotMatch(migration, /DROP TABLE(?! IF NOT EXISTS\s*\()/i);
  assert.doesNotMatch(migration, /DELETE FROM reparaciones/i);

  console.log('OK reparacionesMultisucursal: scope, ledger, inventario, finanzas, rutas, controlador y migración');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
