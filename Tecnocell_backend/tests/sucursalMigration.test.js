const assert = require('assert');
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'scripts',
  'migration_sucursales_sprint_1_19.sql'
);
const sql = fs.readFileSync(file, 'utf8').replace(/\s+/g, ' ').toLowerCase();

assert.match(sql, /create table if not exists sucursales/);
assert.match(sql, /create table if not exists usuario_sucursales/);
assert.match(sql, /unique index if not exists uk_users_id_empresa on users \(id, empresa_id\)/);
assert.match(sql, /foreign key \(usuario_id, empresa_id\) references users\(id, empresa_id\)/);
assert.match(sql, /unique key uk_sucursales_empresa_codigo \(empresa_id, codigo\)/);
assert.match(sql, /unique key uk_sucursales_principal \(empresa_id, principal_unica\)/);
assert.match(sql, /case when es_principal = 1 then 1 else null end/);
assert.match(sql, /where not exists \( select 1 from sucursales s where s\.empresa_id = e\.id \)/);
assert.match(sql, /having sum\(es_principal = 1\) = 0/);
assert.match(sql, /min\(case when activa = 1 then id end\)/);
assert.match(sql, /set s\.es_principal = 1, s\.activa = 1/);
assert.match(sql, /insert into usuario_sucursales/);
assert.match(sql, /where us\.usuario_id = u\.id/);
assert.doesNotMatch(sql, /drop table|delete from sucursales/);

const superAdminController = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'superAdminController.js'),
  'utf8'
).replace(/\s+/g, ' ');
assert.match(
  superAdminController,
  /sucursalService\.asegurarSucursalPrincipal\( result\.insertId, connection \)/
);

console.log('OK sucursalMigration: estructura, unicidad y backfill idempotente validados');
