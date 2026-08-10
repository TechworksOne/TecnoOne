'use strict';

const assert = require('assert');

let estado = 'PENDIENTE';
let saldo = 0;
let lockOwner = null;
const waiters = [];
let nextConnectionId = 1;
let audits = 0;

function acquire(connection) {
  if (lockOwner === null || lockOwner === connection.id) {
    lockOwner = connection.id;
    return Promise.resolve();
  }
  return new Promise(resolve => waiters.push({ connection, resolve }));
}

function release(connection) {
  if (lockOwner !== connection.id) return;
  lockOwner = null;
  const next = waiters.shift();
  if (next) {
    lockOwner = next.connection.id;
    next.resolve();
  }
}

function createConnection() {
  const connection = {
    id: nextConnectionId++,
    async beginTransaction() {},
    async commit() { release(connection); },
    async rollback() { release(connection); },
    release() { release(connection); },
    async query(sql) {
      if (/SELECT \* FROM movimientos_bancarios/.test(sql)) {
        await acquire(connection);
        return [[{
          id: 77, empresa_id: 3, cuenta_id: 9, tipo_movimiento: 'INGRESO',
          monto: 100, estado, referencia_tipo: null, referencia_id: null,
        }]];
      }
      if (/UPDATE movimientos_bancarios SET estado = 'CONFIRMADO'/.test(sql)) {
        estado = 'CONFIRMADO';
        return [{ affectedRows: 1 }];
      }
      if (/UPDATE cuentas_bancarias SET saldo_actual/.test(sql)) {
        saldo += 100;
        return [{ affectedRows: 1 }];
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
  return connection;
}

const fakeDb = {
  async getConnection() { return createConnection(); },
  async query() { throw new Error('La confirmacion no debe usar db.query fuera de su transaccion'); },
};

require.cache[require.resolve('../config/database')] = { exports: fakeDb };
require.cache[require.resolve('../services/auditoriaService')] = {
  exports: { async registrar(options) {
    assert.ok(options.connection, 'auditoria debe usar la misma conexion');
    assert.strictEqual(options.strict, true);
    audits += 1;
  } },
};

const controller = require('../controllers/cajaController');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function main() {
  const req = {
    params: { id: '77' },
    tenant: { empresa_id: 3 },
    user: { id: 5, empresa_id: 3 },
  };
  const first = response();
  const second = response();
  await Promise.all([
    controller.confirmarMovimientoBancario(req, first),
    controller.confirmarMovimientoBancario(req, second),
  ]);
  assert.deepStrictEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
  assert.strictEqual(saldo, 100, 'dos confirmaciones concurrentes deben aplicar el saldo una sola vez');
  assert.strictEqual(audits, 1, 'solo la confirmacion efectiva se audita');
  console.log('OK bancoConfirmacionConcurrencia2H2: doble confirmacion aplica saldo una vez');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
