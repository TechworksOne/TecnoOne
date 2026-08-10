'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'migration_rbac_empresarial_sprint_2e1.sql'),
  'utf8'
);
const sprint2a = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'migration_caja_sesiones_sprint_2a.sql'),
  'utf8'
);

assert.match(sprint2a, /FROM empresas e\s+CROSS JOIN roles r\s+CROSS JOIN permisos p[\s\S]*UPPER\(r\.nombre\) = 'VENTAS'[\s\S]*p\.codigo = 'cajas\.sesion\.operar'/);

assert.match(migration, /ADD COLUMN empresa_id INT NULL/);
assert.match(migration, /MODIFY empresa_id INT NOT NULL/);
assert.match(migration, /FOREIGN KEY \(empresa_id\) REFERENCES empresas\(id\)/);
assert.match(migration, /UNIQUE KEY uq_roles_empresa_nombre \(empresa_id, nombre\)/);
assert.match(migration, /FROM users u\s+INNER JOIN user_roles ur ON ur\.user_id = u\.id/);
assert.doesNotMatch(migration, /empresas\s+(?:e\s+)?CROSS JOIN\s+roles/i);
assert.doesNotMatch(migration, /INSERT IGNORE INTO tmp_role_empresa_2e1[\s\S]{0,150}SELECT rp\.rol_id/);
assert.match(migration, /DELETE rp[\s\S]*UPPER\(r\.nombre\) = 'VENTAS'[\s\S]*p\.codigo = 'cajas\.sesion\.operar'/);
assert.match(migration, /anomalía distinta a contaminación Sprint 2A/);
assert.match(migration, /rol global sin usuarios empresariales; requiere resolución manual/);
assert.doesNotMatch(migration, /DELETE FROM rol_permisos/);
assert.doesNotMatch(migration, /DELETE FROM roles WHERE empresa_id IS NULL/);
assert.match(migration, /UPDATE user_roles ur[\s\S]*SET ur\.role_id = role_map\.new_role_id/);
assert.match(migration, /UPDATE rol_permisos rp[\s\S]*SET rp\.rol_id = role_map\.new_role_id/);
assert.match(migration, /INFORMATION_SCHEMA\.COLUMNS[\s\S]*COLUMN_NAME = 'empresa_id'/);
assert.match(migration, /tipo_usuario = 'PLATAFORMA'/);
assert.match(migration, /COALESCE\(u\.es_super_admin, 0\) = 1/);
assert.match(migration, /CREATE TRIGGER trg_user_roles_empresa_bi/);
assert.match(migration, /CREATE TRIGGER trg_rol_permisos_empresa_bi/);
assert.match(migration, /CREATE TRIGGER trg_users_roles_empresa_bu/);
assert.match(migration, /CREATE TRIGGER trg_roles_empresa_bu/);
assert.match(migration, /CALL migrate_rbac_empresarial_2e1\(\)/);

// Dataset equivalente al hallazgo real: la matriz nace solo de users -> user_roles.
const roles = [
  { id: 10, nombre: 'ADMINISTRADOR' },
  { id: 20, nombre: 'TECNICO' },
  { id: 30, nombre: 'VENTAS' },
];
const assignments = [
  { user: 101, empresa: 1, role: 10 }, { user: 102, empresa: 2, role: 10 },
  { user: 103, empresa: 8, role: 10 }, { user: 104, empresa: 1, role: 20 },
  { user: 105, empresa: 1, role: 30 }, { user: 106, empresa: 2, role: 30 },
];
const contaminatedCompanies = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20];
const grants = [
  { empresa: 1, role: 30, permiso: 'cajas.sesion.operar' },
  { empresa: 2, role: 30, permiso: 'cajas.sesion.operar' },
  ...contaminatedCompanies.map(empresa => ({ empresa, role: 30, permiso: 'cajas.sesion.operar' })),
  { empresa: 1, role: 20, permiso: 'ordenes_trabajo.ver' },
];
const realPairs = new Set(assignments.map(row => `${row.role}:${row.empresa}`));
const materialized = roles.flatMap(role =>
  [...realPairs]
    .filter(pair => pair.startsWith(`${role.id}:`))
    .map(pair => ({ role: role.nombre, empresa: Number(pair.split(':')[1]) }))
);
assert.deepStrictEqual(materialized.filter(row => row.role === 'VENTAS').map(row => row.empresa), [1, 2]);
assert.deepStrictEqual(materialized.filter(row => row.role === 'TECNICO').map(row => row.empresa), [1]);
assert.deepStrictEqual(materialized.filter(row => row.role === 'ADMINISTRADOR').map(row => row.empresa), [1, 2, 8]);

const knownContamination = row =>
  !realPairs.has(`${row.role}:${row.empresa}`) &&
  roles.find(role => role.id === row.role)?.nombre === 'VENTAS' &&
  row.permiso === 'cajas.sesion.operar';
const preservedGrants = grants.filter(row => realPairs.has(`${row.role}:${row.empresa}`));
assert.strictEqual(grants.filter(knownContamination).length, contaminatedCompanies.length);
assert.strictEqual(preservedGrants.length, 3);
assert.ok(preservedGrants.some(row => row.role === 20 && row.permiso === 'ordenes_trabajo.ver'));

const unknown = { empresa: 9, role: 20, permiso: 'reparaciones.editar' };
assert.strictEqual(realPairs.has(`${unknown.role}:${unknown.empresa}`), false);
assert.strictEqual(knownContamination(unknown), false, 'una anomalía distinta debe provocar SIGNAL');

assert.strictEqual(new Set(assignments.map(row => `${row.user}:${row.role}`)).size, assignments.length);

console.log('rbacMigration2E1.test.js OK');
