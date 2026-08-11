'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateRuntimeEnv } = require('../utils/validateRuntimeEnv');

const root = path.join(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function countInsertRows(sql, table) {
  const startPattern = new RegExp('INSERT\\s+INTO\\s+`?' + table + '`?[\\s\\S]*?\\bVALUES\\s+', 'i');
  const match = startPattern.exec(sql);
  if (!match) return 0;
  const values = sql.slice(match.index + match[0].length, sql.indexOf(';', match.index + match[0].length));
  let depth = 0;
  let rows = 0;
  let quoted = false;
  for (let index = 0; index < values.length; index += 1) {
    const char = values[index];
    if (char === "'" && values[index - 1] !== '\\') {
      if (quoted && values[index + 1] === "'") { index += 1; continue; }
      quoted = !quoted;
    }
    if (quoted) continue;
    if (char === '(') { if (depth === 0) rows += 1; depth += 1; }
    if (char === ')') depth -= 1;
  }
  return rows;
}

const validEnv = {
  DB_HOST: 'mysql', DB_USER: 'app', DB_PASSWORD: 'secret',
  DB_NAME: 'tecnoone', JWT_SECRET: 'release-secret-value',
};
assert.doesNotThrow(() => validateRuntimeEnv(validEnv));
assert.throws(() => validateRuntimeEnv({ ...validEnv, JWT_SECRET: '' }), /JWT_SECRET/);
assert.throws(() => validateRuntimeEnv({ ...validEnv, DB_PASSWORD: 'CAMBIAR_EN_SERVIDOR' }), /DB_PASSWORD/);

const server = read('Tecnocell_backend/server.js');
assert.match(server, /validateRuntimeEnv\(\)/);
assert.match(server, /app\.get\('\/health'[\s\S]*SELECT 1[\s\S]*status\(503\)/);
assert.doesNotMatch(server, /status\(500\)\.json\([^\n]*err\.message/);

for (const composeFile of ['docker-compose.yml', 'docker-compose.prod.yml']) {
  const compose = read(composeFile);
  assert.match(compose, /fetch\('http:\/\/localhost:3000\/health'\)/);
  assert.match(compose, /backend:\s*\r?\n\s*condition:\s*service_healthy/);
}

const nginx = read('nginx/nginx.conf');
assert.match(nginx, /location \^~ \/uploads\/[\s\S]*proxy_pass\s+http:\/\/backend:3000/);
assert.doesNotMatch(nginx, /location \^~ \/uploads\/[\s\S]{0,300}\balias\b/);

const uat = read('docs/uat-release-2i.md');
for (const area of ['A Empresa/Super Admin', 'B Sucursales', 'C RBAC', 'D Inventario',
  'E Caja Operativa', 'F Caja Chica', 'G Bancos/Tarjetas', 'H Ventas', 'I Compras',
  'J Reparaciones', 'K Deudores', 'L Auditoria', 'M Reportes', 'N Agenda', 'O Seguridad']) {
  assert.ok(uat.includes(area), `Falta area UAT: ${area}`);
}

const baselinePath = path.join(root, 'Tecnocell_backend', 'database', 'tecnoone_baseline.sql');
assert.ok(fs.existsSync(baselinePath), 'Falta la baseline canonica versionada');
const baseline = fs.readFileSync(baselinePath, 'utf8');
const prodCompose = read('docker-compose.prod.yml');
assert.match(prodCompose, /Tecnocell_backend\/database\/tecnoone_baseline\.sql:\/docker-entrypoint-initdb\.d\/01_baseline\.sql:ro/);
assert.doesNotMatch(prodCompose, /tecnocell_web\.sql/);

const forbiddenDataTables = [
  'empresas', 'sucursales', 'users', 'user_roles', 'roles', 'rol_permisos',
  'clientes', 'proveedores', 'productos', 'ventas', 'compras', 'reparaciones',
  'deudores', 'auditoria_logs', 'caja_sesiones', 'movimientos_bancarios',
];
for (const table of forbiddenDataTables) {
  const insertPattern = new RegExp('INSERT\\s+INTO\\s+`?' + table + '`?', 'i');
  assert.doesNotMatch(baseline, insertPattern, `Baseline contiene datos de ${table}`);
}
for (const [table, expected] of Object.entries({ modulos: 20, permisos: 55, planes: 5, plan_modulos: 95 })) {
  assert.strictEqual(countInsertRows(baseline, table), expected, `${table} debe contener ${expected} filas`);
}

assert.match(baseline, /CREATE TABLE/);
assert.match(baseline, /TRIGGER\s+trg_auditoria_logs_append_only_update/i);
assert.match(baseline, /TRIGGER\s+trg_auditoria_logs_append_only_delete/i);

const backendPackage = read('Tecnocell_backend/package.json');
assert.doesNotMatch(backendPackage, /setup-db|verify-setup|fix-passwords|check-users/);
for (const removed of ['setup-database.js', 'verify-setup.js', 'fix-passwords.js', 'check-users.js']) {
  assert.ok(!fs.existsSync(path.join(root, 'Tecnocell_backend', 'scripts', removed)), `${removed} debe estar retirado`);
}

const releaseText = [backendPackage, read('Tecnocell_backend/README.md'), uat,
  read('Tecnocell_backend/scripts/generate-baseline.js')].join('\n');
const forbiddenLegacy = new RegExp(['admin' + '123', 'DB_' + 'PASS\\b', 'schema\\.sql'].join('|'), 'i');
assert.doesNotMatch(releaseText, forbiddenLegacy);

const backup = read('Tecnocell_backend/scripts/backup_restore_verify_2i.ps1');
assert.match(backup, /--single-transaction/);
assert.match(backup, /Get-FileHash -Algorithm SHA256/);
assert.match(backup, /tecnoone_restore_verify_/);
assert.match(backup, /DROP DATABASE IF EXISTS/);
assert.doesNotMatch(backup, /DROP DATABASE[^\n]*MARIADB_DATABASE/);

console.log('OK uatRelease2I: entorno, health, baseline sanitizada, setup y backup/restore');
