'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateProfit } = require('../utils/reportFinancialMetrics');
const { sendSafeControllerError } = require('../utils/safeControllerError');

const root = path.join(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

// Formula normal.
assert.deepStrictEqual(
  calculateProfit({ totalIngresos: 10000, costoTotal: 6000, egresosTotal: 500 }),
  { gananciaBruta: 4000, perdidasTotal: 500, gananciaNeta: 3500 }
);

// El total ya descontado no vuelve a restar el descuento informativo.
assert.strictEqual(
  calculateProfit({ totalIngresos: 9000, costoTotal: 6000, egresosTotal: 0 }).gananciaNeta,
  3000
);

// Anuladas no entran en la formula; normal y combinada conservan el mismo resultado.
assert.strictEqual(calculateProfit({ totalIngresos: 0, costoTotal: 0 }).gananciaNeta, 0);
assert.strictEqual(
  calculateProfit({ totalIngresos: 9000, costoTotal: 6000, egresosTotal: 500 }).gananciaNeta,
  2500
);

const reports = read('Tecnocell_backend/controllers/reportesController.js');
assert.doesNotMatch(reports, /gananciaBruta\s*-\s*perdidasTotal\s*-\s*descuentosTotal/);
assert.doesNotMatch(reports, /\(egresos\[0\]\.total\s*\|\|\s*0\)\s*\+\s*\(anuladas/);

const routes = read('src/routes.tsx');
assert.doesNotMatch(routes, /path:\s*["']\/fel["']/);
assert.doesNotMatch(routes, /FelPage/);

const repairs = read('src/pages/Repairs/RepairsPage.tsx');
assert.match(repairs, /contextVersion/);
assert.match(repairs, /requestSequence/);
assert.match(repairs, /readOnlyConsolidated/);
assert.match(repairs, /setSelectedRepair\(null\)/);
assert.match(repairs, /setShowDetailPin\(false\)/);

const purchaseForm = read('src/pages/Purchases/PurchaseFormPage.tsx');
const repairForm = read('src/pages/Repairs/RepairFormSimple.tsx');
const repairFlowDetail = read('src/pages/FlujoReparaciones/FlujoReparacionDetailPage.tsx');
assert.match(purchaseForm, /branchMode\s*===\s*["']consolidated["']/);
assert.match(repairForm, /branchMode\s*===\s*["']consolidated["']/);
assert.match(repairFlowDetail, /if \(isConsolidated\) return null/);

const agenda = read('Tecnocell_backend/controllers/agendaController.js');
const agendaMigration = read('Tecnocell_backend/scripts/migration_agenda_eventos_sprint_2h3.sql');
assert.doesNotMatch(agenda, /CREATE TABLE IF NOT EXISTS agenda_eventos|ensureEventosTable/);
assert.match(agendaMigration, /CREATE TABLE IF NOT EXISTS agenda_eventos/);

const sqlError = new Error('ER_BAD_FIELD_ERROR secret_table.internal_column');
let responseStatus;
let responseBody;
sendSafeControllerError({
  status(value) { responseStatus = value; return this; },
  json(value) { responseBody = value; return value; },
}, sqlError, 'Error interno');
assert.strictEqual(responseStatus, 500);
assert.deepStrictEqual(responseBody, { message: 'Error interno' });
assert.match(sqlError.message, /secret_table\.internal_column/); // disponible para console.error

console.log('OK hardening2H3: formulas, ALL, FEL, Agenda y errores seguros');
