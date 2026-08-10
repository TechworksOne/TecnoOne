'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'migration_auditoria_multisucursal_sprint_2f1a.sql'),
  'utf8'
);

assert.match(sql, /ADD COLUMN IF NOT EXISTS sucursal_id BIGINT UNSIGNED NULL/i);
assert.match(sql, /ADD COLUMN IF NOT EXISTS metadata JSON NULL/i);
assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_auditoria_empresa_sucursal_fecha/i);
assert.match(sql, /\(empresa_id, sucursal_id, created_at\)/i);
assert.doesNotMatch(sql, /FOREIGN KEY[\s\S]*sucursal/i);
assert.match(sql, /DROP TRIGGER IF EXISTS trg_auditoria_logs_append_only_update/i);
assert.match(sql, /BEFORE UPDATE ON auditoria_logs/i);
assert.match(sql, /BEFORE DELETE ON auditoria_logs/i);
assert.match(sql, /SIGNAL SQLSTATE '45000'/i);
assert.doesNotMatch(sql, /INSERT[\s\S]*ALL/i);

console.log('OK auditoriaMigration2F1A: columnas, índice, idempotencia y append-only');
