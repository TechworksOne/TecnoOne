const assert = require('assert');
const fs = require('fs');
const path = require('path');
const calls = [];
let existing = true;
const model = {
  listar: async scope => { calls.push(['listar', scope]); return []; },
  sucursalPertenece: async (empresaId, sucursalId) => empresaId === 10 && sucursalId === 7,
  crear: async data => { calls.push(['crear', data]); return { id: 1, ...data }; },
  editar: async data => { calls.push(['editar', data]); return existing ? data : null; },
  cambiarEstado: async data => { calls.push(['estado', data]); return existing ? data : null; },
  eliminar: async data => { calls.push(['eliminar', data]); return existing; },
};
require.cache[require.resolve('../models/cajaModel')] = { exports: model };
const controller = require('../controllers/cajaCatalogoController');
function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
async function invoke(method, req) { const res = response(); await controller[method](req, res); return res; }
const normal = (overrides = {}) => ({ user: { id: 5, empresaId: 10 }, tenant: { empresa_id: 10 }, sucursal: { id: 7 }, params: {}, query: {}, body: {}, ...overrides });

async function main() {
  calls.length = 0;
  await invoke('listar', normal());
  assert.deepStrictEqual(calls[0][1], { empresaId: 10, sucursalId: 7 });
  await invoke('crear', normal({ body: { nombre: 'Caja A', codigo: 'a', sucursal_id: 999, empresa_id: 999 } }));
  assert.strictEqual(calls.at(-1)[1].empresaId, 10);
  assert.strictEqual(calls.at(-1)[1].sucursalId, 7);
  assert.strictEqual(calls.at(-1)[1].codigo, 'A');
  await invoke('editar', normal({ params: { cajaId: '2' }, body: { nombre: 'X', codigo: 'X' }, sucursal: { id: 8 } }));
  assert.strictEqual(calls.at(-1)[1].sucursalId, 8);
  existing = false;
  const rejected = await invoke('cambiarEstado', normal({ params: { cajaId: '2' }, body: { activa: false } }));
  assert.strictEqual(rejected.statusCode, 404);
  existing = true;
  await invoke('listar', { user: { esSuperAdmin: true }, params: { empresaId: '22' }, query: {}, body: {} });
  assert.deepStrictEqual(calls.at(-1)[1], { empresaId: 22, sucursalId: null });
  const mismatch = await invoke('crear', { user: { esSuperAdmin: true }, params: { empresaId: '22' }, query: {}, body: { sucursal_id: 7, nombre: 'X', codigo: 'X' } });
  assert.strictEqual(mismatch.statusCode, 403);
  const migration = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'migration_cajas_sprint_1_19.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS cajas/);
  assert.match(migration, /NOT EXISTS \(SELECT 1 FROM cajas/);
  assert.match(migration, /FOREIGN KEY \(empresa_id, sucursal_id\)/);
  assert.match(migration, /UNIQUE KEY uk_cajas_sucursal_codigo/);
  assert.doesNotMatch(migration, /ALTER TABLE (caja_chica|cuentas_bancarias)/i);
  const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'cajaCatalogoRoutes.js'), 'utf8');
  assert.match(routes, /tenantScope, checkEmpresaActiva, sucursalContext/);
  assert.match(routes, /cajas\.ver/);
  assert.match(routes, /cajas\.administrar/);
  console.log('OK cajaCatalogo: tenants, sucursales, creacion, rechazo, backfill, permisos y Super Admin');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

