const assert = require('assert');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'scripts', 'migration_suscripciones_sprint_1_15_2.sql');
const sql = fs.readFileSync(file, 'utf8').replace(/\s+/g, ' ').toLowerCase();

assert.match(sql, /create table if not exists suscripciones/);
assert.match(sql, /create table if not exists historial_suscripciones/);
assert.match(sql, /left join suscripciones s on s\.empresa_id = e\.id where s\.id is null/);
assert.match(sql, /where not exists \( select 1 from historial_suscripciones/);
assert.match(sql, /when e\.fecha_vencimiento is null then/);
assert.doesNotMatch(sql, /update empresas set fecha_vencimiento/);
assert.match(sql, /check \(dias_gracia >= 0\)/);

console.log('OK subscriptionMigration: estructura y backfill idempotente validados');
