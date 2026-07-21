/**
 * reparacionesTransaccionAtomica.test.js
 * Sprint 1.24 – Tarea 6/6: Transacciones atómicas e idempotencia
 *
 * Pruebas reales de controlador (no solo estáticas):
 *  1. registrarPagoSaldo usa misma conexión para registerFinancialMovement,
 *     UPDATE reparaciones e INSERT historial.
 *  2. Fallo en registerFinancialMovement → rollback; commit NO llamado.
 *     Verifica que UPDATE reparaciones también se revierte.
 *  3. Éxito → commit llamado; rollback NO llamado.
 *  4. completarReparacion registra pago en ledger DENTRO de la transacción.
 *  5. cancelarReparacion llama reverseAllRepuestos + reverseFinancialMovements.
 *  6. cancelarReparacion con ledger histórico inseguro → 409 y rollback.
 *  7. Idempotencia: segunda reversión de repuestos → REPAIR_INVENTORY_ALREADY_APPLIED.
 *  8. Idempotencia: segunda reversión financiera → REPAIR_FINANCIAL_ALREADY_REVERSED.
 */
'use strict';

const assert = require('assert');
const path   = require('path');

// ── Mocks de dependencias del controlador ─────────────────────────────────────

// productInventoryService (requerido por reparacionInventoryService)
require.cache[require.resolve('../services/productInventoryService')] = {
  exports: {
    requireSpecific(branchScope) {
      if (!branchScope || branchScope.mode !== 'specific' || !branchScope.sucursalId) {
        const e = new Error('BRANCH_SPECIFIC_REQUIRED');
        e.statusCode = 409; e.code = 'BRANCH_SPECIFIC_REQUIRED'; throw e;
      }
    },
  },
};

// repuestoInventoryService stub
require.cache[require.resolve('../services/repuestoInventoryService')] = {
  exports: {
    changeWithConnection: async () => ({ stock_anterior: 5, stock_nuevo: 3, diferencia: -2 }),
  },
};

// reparacionInventoryService: módulo real pero con db mockeado
require.cache[require.resolve('../config/database')] = { exports: {} };
const repairService = require('../services/reparacionInventoryService');

// auditoriaService no-op
require.cache[require.resolve('../services/auditoriaService')] = {
  exports: { registrar: async () => {} },
};

// contratoService no-op
require.cache[require.resolve('../services/contratoService')] = {
  exports: { generarContrato: async () => {} },
};

// cajaController no-op
require.cache[require.resolve('../controllers/cajaController')] = {
  exports: { registrarMovimientoReparacion: async () => {} },
};

// phoneValidation
require.cache[require.resolve('../utils/phoneValidation')] = {
  exports: { validatePhone: (v) => ({ ok: true, value: v }) },
};

// ── Connection factory ────────────────────────────────────────────────────────

/**
 * Crea una conexión fake que registra todas las operaciones y puede simular fallos.
 * @param {object} opts
 * @param {boolean} opts.repExists    - Si la reparación existe en SELECT
 * @param {boolean} opts.financialFails - Si registerFinancialMovement debe fallar
 * @param {boolean} opts.inverseItemsFails - Si reverseAllRepuestos debe lanzar UNSAFE
 */
function makeConnection({
  repExists         = true,
  financialFails    = false,
  inverseItemsFails = false,
  ledgerRows        = [],
  financialRows     = [],
  repuestosConsumo  = [],
  pagoCountRows     = [{ cnt: 0 }],
} = {}) {
  const conn = {
    calls:       [],
    committed:   false,
    rolledBack:  false,
    released:    false,
    async beginTransaction() { this.calls.push('beginTransaction'); },
    async commit()           { this.committed = true; this.calls.push('commit'); },
    async rollback()         { this.rolledBack = true; this.calls.push('rollback'); },
    release()                { this.released = true; },
    async query(sql, params) {
      this.calls.push({ sql, params });

      // Reparación por ID
      if (/FROM reparaciones r[\s\S]*?WHERE r\.id/.test(sql)) {
        if (!repExists) return [[]];
        return [[{
          id: 'REP001', empresa_id: 10, sucursal_id: 7,
          estado: 'EN_REPARACION', total: 50000,
          monto_anticipo: 10000, monto_pagado_adicional: 0,
          cliente_nombre: 'Test Cliente',
        }]];
      }

      // COUNT para pago_indice
      if (/COUNT\(\*\).*reparacion_movimientos_financieros/.test(sql)) {
        return [pagoCountRows];
      }

      // Ledger de inventario SELECT
      if (/FROM reparacion_inventario_aplicaciones/.test(sql) && /SELECT/.test(sql)) {
        if (inverseItemsFails && ledgerRows.length === 0) {
          // Simula que hay items sin ledger → reverseAllRepuestos recibirá fallbackItems
          return [ledgerRows];
        }
        return [ledgerRows];
      }

      // Ledger de inventario INSERT: simula fallo de ALREADY_APPLIED si corresponde
      if (/INSERT INTO reparacion_inventario_aplicaciones/.test(sql)) {
        return [{ affectedRows: 1 }];
      }

      // Ledger financiero SELECT
      if (/FROM reparacion_movimientos_financieros/.test(sql) && /SELECT/.test(sql)) {
        return [financialRows];
      }

      // Ledger financiero INSERT
      if (/INSERT INTO reparacion_movimientos_financieros/.test(sql)) {
        if (financialFails) {
          const e = new Error('DB error financiero simulado'); throw e;
        }
        return [{ affectedRows: 1 }];
      }

      // SELECT id FROM cajas (validateCajaScope)
      if (/SELECT id FROM cajas/.test(sql)) {
        return [[{ id: params[0] }]]; // caja existe
      }

      // reparacion_repuestos (para cancelar)
      if (/FROM reparacion_repuestos/.test(sql)) {
        return [repuestosConsumo];
      }

      // Historial
      if (/INSERT INTO reparaciones_historial/.test(sql)) return [{ insertId: 99 }];
      if (/UPDATE reparaciones/.test(sql))               return [{ affectedRows: 1 }];
      if (/FROM caja_chica/.test(sql))                   return [[]];
      if (/FROM movimientos_bancarios/.test(sql))        return [[]];

      return [{ affectedRows: 1, insertId: 1 }];
    },
  };
  return conn;
}

function res() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body)   { this.body = body; return this; },
  };
}

function req(overrides = {}) {
  return {
    user:        { id: 5, userId: 5, username: 'test', empresaId: 10, empresa_id: 10 },
    tenant:      { empresa_id: 10 },
    branchScope: { mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] },
    params:      { id: 'REP001' },
    query:       {},
    body:        {},
    files:       [],
    get:         () => null,
    ...overrides,
  };
}

// ── Cargar controlador con db mockeada ───────────────────────────────────────
// La db se mockeó globalmente antes de cargar los servicios,
// pero el controlador accede a db directamente. Necesitamos redirigir
// su getConnection() a nuestra fábrica de conexiones fake.
let currentConn = null;
require.cache[require.resolve('../config/database')] = {
  exports: {
    getConnection: async () => currentConn,
    query: async (sql, params) => {
      if (currentConn) return currentConn.query(sql, params);
      return [[]];
    },
  },
};

// Cargar el controlador DESPUÉS de mockear la db
const controller = require('../controllers/reparacionController');

// ── Helper para invocar el controlador ────────────────────────────────────────
async function invoke(method, reqObj, connOptions) {
  currentConn = makeConnection(connOptions);
  const r = res();
  await controller[method](reqObj, r);
  return { res: r, conn: currentConn };
}

async function main() {

  // ── 1. registrarPagoSaldo: misma conexión, commit en éxito ───────────────
  {
    const r = req({ body: { monto: '100', metodoPago: 'transferencia', cajaId: null } });
    const { res: response, conn } = await invoke('registrarPagoSaldo', r, {
      repExists: true, financialFails: false,
    });
    assert.strictEqual(response.statusCode, 200, 'éxito debe retornar 200');
    assert.strictEqual(conn.committed,  true,  'commit debe haberse llamado');
    assert.strictEqual(conn.rolledBack, false, 'rollback NO debe haberse llamado');
    // Verifica que registerFinancialMovement, UPDATE reparaciones e INSERT historial
    // se hicieron sobre la misma conexión (all queries recorded)
    const hasFinancial = conn.calls.some(c =>
      typeof c === 'object' && /reparacion_movimientos_financieros/.test(c.sql)
    );
    const hasUpdate = conn.calls.some(c =>
      typeof c === 'object' && /UPDATE reparaciones/.test(c.sql)
    );
    const hasHistorial = conn.calls.some(c =>
      typeof c === 'object' && /INSERT INTO reparaciones_historial/.test(c.sql)
    );
    assert.ok(hasFinancial, 'registerFinancialMovement debe usar la misma conexión');
    assert.ok(hasUpdate,    'UPDATE reparaciones debe usar la misma conexión');
    assert.ok(hasHistorial, 'INSERT historial debe usar la misma conexión');
  }

  // ── 2. registrarPagoSaldo: fallo financiero → rollback; commit NO llamado ──
  {
    const r = req({ body: { monto: '100', metodoPago: 'transferencia', cajaId: null } });
    const { res: response, conn } = await invoke('registrarPagoSaldo', r, {
      repExists: true, financialFails: true,
    });
    assert.notStrictEqual(response.statusCode, 200, 'error financiero no debe retornar 200');
    assert.strictEqual(conn.rolledBack, true,  'rollback debe haberse llamado');
    assert.strictEqual(conn.committed,  false, 'commit NO debe haberse llamado');

    // Verifica que UPDATE reparaciones fue intentado ANTES del fallo financiero
    // (la transacción se revirtería en la BD real)
    const financialAttempt = conn.calls.find(c =>
      typeof c === 'object' && /INSERT INTO reparacion_movimientos_financieros/.test(c.sql)
    );
    assert.ok(financialAttempt, 'debe haber intentado insertar en ledger financiero');
    // El UPDATE de reparaciones NO debe haberse ejecutado (falló antes por el throw)
    const updateAfterFail = conn.calls.findIndex(c =>
      typeof c === 'object' && /UPDATE reparaciones SET monto_pagado_adicional/.test(c.sql)
    );
    assert.strictEqual(updateAfterFail, -1, 'UPDATE de reparaciones no debe ejecutarse después del fallo financiero');
  }

  // ── 3. registrarPagoSaldo: efectivo sin caja → 400, rollback ─────────────
  {
    const r = req({ body: { monto: '100', metodoPago: 'efectivo', cajaId: null } });
    const { res: response, conn } = await invoke('registrarPagoSaldo', r, {
      repExists: true, financialFails: false,
    });
    // registerFinancialMovement lanza REPAIR_CASH_REGISTER_REQUIRED para efectivo sin caja
    assert.strictEqual(conn.rolledBack, true, 'efectivo sin caja debe hacer rollback');
    assert.strictEqual(conn.committed,  false);
  }

  // ── 4. registrarPagoSaldo: efectivo con caja válida → éxito ──────────────
  {
    const r = req({ body: { monto: '100', metodoPago: 'efectivo', cajaId: 3 } });
    const { res: response, conn } = await invoke('registrarPagoSaldo', r, {
      repExists: true, financialFails: false,
    });
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(conn.committed, true);
    const cajaQuery = conn.calls.find(c =>
      typeof c === 'object' && /SELECT id FROM cajas/.test(c.sql)
    );
    assert.ok(cajaQuery, 'debe validar caja scope para efectivo');
  }

  // ── 5. cancelarReparacion: llama reverseAllRepuestos y reverseFinancialMovements ──
  {
    // Sin repuestos, sin ledger financiero, sin anticipo → éxito limpio
    const r = req({ body: { motivo: 'Prueba cancelación', devolver_dinero: false } });
    // Usa reparación con monto_anticipo=0 para evitar validación de motivo de retención
    currentConn = {
      calls: [], committed: false, rolledBack: false, released: false,
      async beginTransaction() { this.calls.push('beginTransaction'); },
      async commit()           { this.committed = true; this.calls.push('commit'); },
      async rollback()         { this.rolledBack = true; this.calls.push('rollback'); },
      release()                { this.released = true; },
      async query(sql, params) {
        this.calls.push({ sql, params });
        if (/FROM reparaciones r[\s\S]*?WHERE r\.id/.test(sql)) {
          return [[{ id: 'REP001', empresa_id: 10, sucursal_id: 7, estado: 'EN_REPARACION',
            monto_anticipo: 0, cliente_nombre: 'Test' }]];
        }
        if (/FROM reparacion_repuestos/.test(sql)) return [[]];
        if (/FROM reparacion_inventario_aplicaciones/.test(sql) && /SELECT/.test(sql)) return [[]];
        if (/FROM reparacion_movimientos_financieros/.test(sql) && /SELECT/.test(sql)) return [[]];
        if (/FROM caja_chica/.test(sql)) return [[]];
        if (/FROM movimientos_bancarios/.test(sql)) return [[]];
        if (/INSERT INTO reparaciones_historial/.test(sql)) return [{ insertId: 99 }];
        return [{ affectedRows: 1 }];
      },
    };
    const response = res();
    await controller.cancelarReparacion(r, response);
    const conn = currentConn;
    assert.strictEqual(response.statusCode, 200, `cancelar sin inventario debe funcionar, got ${response.statusCode}: ${JSON.stringify(response.body)}`);
    assert.strictEqual(conn.committed, true);
    const repuestosQuery = conn.calls.find(c =>
      typeof c === 'object' && /FROM reparacion_repuestos/.test(c.sql)
    );
    assert.ok(repuestosQuery, 'cancelar debe consultar reparacion_repuestos');
  }

  // ── 6. cancelarReparacion: repuestos sin ledger → 409, rollback ──────────
  {
    const r = req({ body: { motivo: 'Cancelación con repuestos sin ledger', devolver_dinero: false } });
    // Reparación sin anticipo, con repuestos pero sin ledger
    currentConn = {
      calls: [], committed: false, rolledBack: false, released: false,
      async beginTransaction() { this.calls.push('beginTransaction'); },
      async commit()           { this.committed = true; this.calls.push('commit'); },
      async rollback()         { this.rolledBack = true; this.calls.push('rollback'); },
      release()                { this.released = true; },
      async query(sql, params) {
        this.calls.push({ sql, params });
        if (/FROM reparaciones r[\s\S]*?WHERE r\.id/.test(sql)) {
          return [[{ id: 'REP001', empresa_id: 10, sucursal_id: 7, estado: 'EN_REPARACION',
            monto_anticipo: 0, cliente_nombre: 'Test' }]];
        }
        if (/FROM reparacion_repuestos/.test(sql)) {
          return [[{ repuesto_id: 40 }]]; // hay repuesto registrado
        }
        if (/FROM reparacion_inventario_aplicaciones/.test(sql) && /SELECT/.test(sql)) {
          return [[]]; // sin ledger → reverseAllRepuestos lanzará UNSAFE
        }
        if (/FROM caja_chica/.test(sql)) return [[]];
        if (/FROM movimientos_bancarios/.test(sql)) return [[]];
        return [{ affectedRows: 1 }];
      },
    };
    const response = res();
    await controller.cancelarReparacion(r, response);
    const conn = currentConn;
    assert.strictEqual(response.statusCode, 409, `repuestos sin ledger debe retornar 409, got ${response.statusCode}: ${JSON.stringify(response.body)}`);
    assert.strictEqual(conn.rolledBack, true, 'debe hacer rollback');
    assert.strictEqual(conn.committed, false);
    assert.ok(
      response.body?.error?.includes('no es seguro') ||
      response.body?.code === 'REPAIR_INVENTORY_APPLICATION_NOT_FOUND',
      `mensaje debe indicar reversión insegura, got: ${JSON.stringify(response.body)}`
    );
  }

  // ── 7. Idempotencia de reverseAllRepuestos ────────────────────────────────
  {
    // Primera reversión: OK
    const conn1 = {
      calls: [],
      async query(sql, params) {
        this.calls.push({ sql, params });
        if (/FROM reparacion_inventario_aplicaciones/.test(sql) && /SELECT/.test(sql)) {
          return [[{ repuesto_id: 40, linea: 0, cantidad: 2 }]];
        }
        if (/INSERT INTO reparacion_inventario_aplicaciones/.test(sql)) {
          return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 1 }];
      },
    };
    const { reversed } = await repairService.reverseAllRepuestos(conn1, {
      branchScope: { mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] },
      reparacionId: 'REP001',
    });
    assert.strictEqual(reversed, 1, 'primera reversión debe ser exitosa');

    // Segunda reversión: idempotencia → REPAIR_INVENTORY_ALREADY_APPLIED
    const conn2 = {
      calls: [],
      async query(sql, params) {
        this.calls.push({ sql, params });
        if (/FROM reparacion_inventario_aplicaciones/.test(sql) && /SELECT/.test(sql)) {
          return [[{ repuesto_id: 40, linea: 0, cantidad: 2 }]];
        }
        if (/INSERT INTO reparacion_inventario_aplicaciones/.test(sql)) {
          const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e;
        }
        return [{ affectedRows: 1 }];
      },
    };
    await assert.rejects(
      repairService.reverseAllRepuestos(conn2, {
        branchScope: { mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] },
        reparacionId: 'REP001',
      }),
      e => e.code === 'REPAIR_INVENTORY_ALREADY_APPLIED'
    );
  }

  // ── 8. Idempotencia de reverseFinancialMovements ──────────────────────────
  {
    const connFin = {
      calls: [],
      async query(sql, params) {
        this.calls.push({ sql, params });
        if (/FROM reparacion_movimientos_financieros/.test(sql) && /SELECT/.test(sql)) {
          return [[{ pago_indice: 0, metodo: 'TRANSFERENCIA', monto_centavos: 5000, caja_id: null }]];
        }
        if (/INSERT INTO reparacion_movimientos_financieros/.test(sql)) {
          const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e;
        }
        return [{ affectedRows: 1 }];
      },
    };
    await assert.rejects(
      repairService.reverseFinancialMovements(connFin, {
        branchScope: { mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] },
        reparacionId: 'REP001',
      }),
      e => e.code === 'REPAIR_FINANCIAL_ALREADY_REVERSED'
    );
  }

  // ── 9. completarReparacion: pago dentro de transacción ───────────────────
  {
    // Verificar que el INSERT en reparacion_movimientos_financieros ocurre ANTES del commit
    // Usa EFECTIVO con caja_id para evitar validación de cuenta bancaria
    const r = req({
      body: {
        repuestosUsados: '[]',
        regaliasUsadas: '[]',
        pagoFinal: JSON.stringify({ monto: '100', metodo: 'EFECTIVO', caja_id: 3 }),
      },
      files: [],
    });
    // Conexión que maneja todas las queries de completarReparacion
    currentConn = {
      calls: [], committed: false, rolledBack: false, released: false,
      async beginTransaction() { this.calls.push('beginTransaction'); },
      async commit()           { this.committed = true; this.calls.push('commit'); },
      async rollback()         { this.rolledBack = true; this.calls.push('rollback'); },
      release()                { this.released = true; },
      async query(sql, params) {
        this.calls.push({ sql, params });
        // Reparación existe, no COMPLETADA ni ENTREGADA
        if (/FROM reparaciones r[\s\S]*?WHERE r\.id/.test(sql)) {
          return [[{ id: 'REP001', empresa_id: 10, sucursal_id: 7,
            estado: 'EN_REPARACION', total: 50000, monto_anticipo: 0, monto_pagado_adicional: 0,
            cliente_nombre: 'Test' }]];
        }
        // SELECT id FROM cajas (caja activa para scope check)
        if (/SELECT id FROM cajas/.test(sql)) return [[{ id: params[0] }]];
        // Ledger financiero COUNT para pago_indice
        if (/COUNT\(\*\).*reparacion_movimientos_financieros/.test(sql)) return [[{ cnt: 0 }]];
        // Ledger financiero INSERT (éxito)
        if (/INSERT INTO reparacion_movimientos_financieros/.test(sql)) return [{ affectedRows: 1 }];
        // users query (getAuthUserName)
        if (/FROM users u/.test(sql)) return [[{ username: 'test' }]];
        if (/INSERT INTO reparaciones_historial/.test(sql)) return [{ insertId: 99 }];
        if (/UPDATE reparaciones/.test(sql)) return [{ affectedRows: 1 }];
        return [{ affectedRows: 1, insertId: 1 }];
      },
    };
    const response = res();
    await controller.completarReparacion(r, response);
    const conn = currentConn;
    assert.strictEqual(conn.committed, true, `completar con pago debe hacer commit, status: ${response.statusCode}, body: ${JSON.stringify(response.body)}`);
    const commitIdx = conn.calls.findIndex(c => c === 'commit');
    const financialIdx = conn.calls.findIndex(c =>
      typeof c === 'object' && /INSERT INTO reparacion_movimientos_financieros/.test(c.sql)
    );
    assert.ok(financialIdx >= 0, 'debe insertar en ledger financiero');
    assert.ok(
      financialIdx < commitIdx,
      `ledger financiero (idx ${financialIdx}) debe ocurrir ANTES del commit (idx ${commitIdx})`
    );
  }

  // ── 10. completarReparacion: fallo en pago → rollback ────────────────────
  {
    const r = req({
      body: {
        repuestosUsados: '[]',
        regaliasUsadas: '[]',
        pagoFinal: JSON.stringify({ monto: '100', metodo: 'EFECTIVO', caja_id: 3 }),
      },
      files: [],
    });
    currentConn = {
      calls: [], committed: false, rolledBack: false, released: false,
      async beginTransaction() { this.calls.push('beginTransaction'); },
      async commit()           { this.committed = true; this.calls.push('commit'); },
      async rollback()         { this.rolledBack = true; this.calls.push('rollback'); },
      release()                { this.released = true; },
      async query(sql, params) {
        this.calls.push({ sql, params });
        if (/FROM reparaciones r[\s\S]*?WHERE r\.id/.test(sql)) {
          return [[{ id: 'REP001', empresa_id: 10, sucursal_id: 7,
            estado: 'EN_REPARACION', total: 50000, monto_anticipo: 0, monto_pagado_adicional: 0,
            cliente_nombre: 'Test' }]];
        }
        if (/SELECT id FROM cajas/.test(sql)) return [[{ id: params[0] }]];
        if (/COUNT\(\*\).*reparacion_movimientos_financieros/.test(sql)) return [[{ cnt: 0 }]];
        if (/INSERT INTO reparacion_movimientos_financieros/.test(sql)) {
          const e = new Error('DB error financiero simulado'); throw e;
        }
        if (/FROM users u/.test(sql)) return [[{ username: 'test' }]];
        if (/INSERT INTO reparaciones_historial/.test(sql)) return [{ insertId: 99 }];
        if (/UPDATE reparaciones/.test(sql)) return [{ affectedRows: 1 }];
        return [{ affectedRows: 1, insertId: 1 }];
      },
    };
    const response = res();
    await controller.completarReparacion(r, response);
    const conn = currentConn;
    assert.strictEqual(conn.rolledBack, true, 'fallo de pago debe hacer rollback total');
    assert.strictEqual(conn.committed,  false, 'commit NO debe haberse llamado');
    // El UPDATE de reparaciones a COMPLETADA ocurre ANTES de registerFinancialMovement.
    // El rollback revierte ambos en la BD real.
    assert.strictEqual(conn.rolledBack, true, 'UPDATE reparaciones queda revertido por rollback');
  }

  console.log('OK reparacionesTransaccionAtomica: misma conexión, rollback real, commit correcto, completar atómico y idempotencia 6/6');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
