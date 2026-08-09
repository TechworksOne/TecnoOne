'use strict';

/**
 * cajaSesion.test.js
 *
 * Cubre:
 *  1. getSesionActiva — specific y consolidated
 *  2. abrirSesion — caja de otra sucursal rechazada (model devuelve null)
 *  3. abrirSesion — doble apertura de caja (CAJA_YA_TIENE_SESION_ABIERTA)
 *  4. abrirSesion — usuario con otra sesión abierta (USUARIO_YA_TIENE_SESION_ABIERTA)
 *  5. abrirSesion — fondo inválido rechazado
 *  6. cerrarSesion — sesión de otra sucursal rechazada (model devuelve null)
 *  7. cerrarSesion — diferencia calculada correctamente
 *  8. getHistorial — specific y consolidated
 *  9. Routes: branchScope presente, requireBranchSpecific en abrir/cerrar
 * 10. Migración: estructura, FK compuesta, columnas generadas, permisos
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

// ── Mock model ────────────────────────────────────────────────────────────────
let mockMode = 'ok';
const mockModel = {
  listarActivas: async ({ empresaId, sucursalIds }) => {
    return [{ id: 1, empresa_id: empresaId, sucursal_ids: sucursalIds, estado: 'ABIERTA' }];
  },
  listar: async ({ empresaId, sucursalIds }) => {
    return [{ id: 1, empresa_id: empresaId, estado: 'CERRADA' }];
  },
  crear: async ({ empresaId, sucursalId, cajaId, usuarioId, fondoInicial }) => {
    if (mockMode === 'caja_not_found') return null;
    if (mockMode === 'caja_dup') {
      const e = new Error('La caja ya tiene una sesión abierta');
      e.statusCode = 409; e.code = 'CAJA_YA_TIENE_SESION_ABIERTA'; throw e;
    }
    if (mockMode === 'user_dup') {
      const e = new Error('El usuario ya tiene una sesión de caja abierta en esta empresa');
      e.statusCode = 409; e.code = 'USUARIO_YA_TIENE_SESION_ABIERTA'; throw e;
    }
    return { id: 99, empresa_id: empresaId, sucursal_id: sucursalId, caja_id: cajaId,
             estado: 'ABIERTA', fondo_inicial_centavos: fondoInicial };
  },
  cerrar: async ({ sesionId, empresaId, sucursalId, efectivoContado }) => {
    if (mockMode === 'sesion_not_found') return null;
    const esperado = 1000;
    return { sesionId: Number(sesionId), diferencia: efectivoContado - esperado,
             efectivoEsperado: esperado, efectivoContado };
  },
};
require.cache[require.resolve('../models/cajaSesionModel')] = { exports: mockModel };

const controller = require('../controllers/cajaSesionController');

// ── Helpers ───────────────────────────────────────────────────────────────────
function res() {
  const r = { statusCode: 200, body: null };
  r.status = c => { r.statusCode = c; return r; };
  r.json   = b => { r.body = b; return r; };
  return r;
}

const specific = (overrides = {}) => ({
  user: { id: 5, userId: 5 },
  branchScope: { mode: 'specific', empresaId: 10, sucursalId: 7, allowedSucursalIds: [7, 8] },
  params: {}, query: {}, body: {},
  ...overrides,
});
const consolidated = (overrides = {}) => ({
  ...specific(overrides),
  branchScope: { mode: 'consolidated', empresaId: 10, sucursalId: null, allowedSucursalIds: [7, 8] },
});

async function invoke(method, req) {
  const r = res();
  await controller[method](req, r);
  return r;
}

async function main() {
  // ── 1. getSesionActiva specific ────────────────────────────────────────────
  mockMode = 'ok';
  const activa = await invoke('getSesionActiva', specific());
  assert.strictEqual(activa.statusCode, 200);
  assert.ok(Array.isArray(activa.body.data), 'data debe ser array');

  // ── 2. getSesionActiva consolidated ───────────────────────────────────────
  const activaAll = await invoke('getSesionActiva', consolidated());
  assert.strictEqual(activaAll.statusCode, 200);
  assert.ok(Array.isArray(activaAll.body.data));

  // ── 3. abrirSesion — caja de otra sucursal (model devuelve null) ──────────
  mockMode = 'caja_not_found';
  const notFound = await invoke('abrirSesion', specific({ body: { caja_id: 99, fondo_inicial_centavos: 500 } }));
  assert.strictEqual(notFound.statusCode, 404);
  assert.strictEqual(notFound.body.code, 'CAJA_NO_ENCONTRADA');

  // ── 4. abrirSesion — doble apertura ──────────────────────────────────────
  mockMode = 'caja_dup';
  const doble = await invoke('abrirSesion', specific({ body: { caja_id: 1, fondo_inicial_centavos: 0 } }));
  assert.strictEqual(doble.statusCode, 409);
  assert.strictEqual(doble.body.code, 'CAJA_YA_TIENE_SESION_ABIERTA');

  // ── 5. abrirSesion — usuario ya tiene sesión ──────────────────────────────
  mockMode = 'user_dup';
  const userDup = await invoke('abrirSesion', specific({ body: { caja_id: 2, fondo_inicial_centavos: 0 } }));
  assert.strictEqual(userDup.statusCode, 409);
  assert.strictEqual(userDup.body.code, 'USUARIO_YA_TIENE_SESION_ABIERTA');

  // ── 6. abrirSesion — fondo inválido ──────────────────────────────────────
  mockMode = 'ok';
  const fondoMal = await invoke('abrirSesion', specific({ body: { caja_id: 1, fondo_inicial_centavos: -1 } }));
  assert.strictEqual(fondoMal.statusCode, 400);
  assert.strictEqual(fondoMal.body.code, 'FONDO_INVALIDO');

  // ── 7. abrirSesion — sin caja_id ─────────────────────────────────────────
  const sinCaja = await invoke('abrirSesion', specific({ body: {} }));
  assert.strictEqual(sinCaja.statusCode, 400);
  assert.strictEqual(sinCaja.body.code, 'CAJA_REQUERIDA');

  // ── 8. abrirSesion — éxito ───────────────────────────────────────────────
  const abierta = await invoke('abrirSesion', specific({ body: { caja_id: 3, fondo_inicial_centavos: 1000 } }));
  assert.strictEqual(abierta.statusCode, 201);
  assert.strictEqual(abierta.body.data.caja_id, 3);
  assert.strictEqual(abierta.body.data.fondo_inicial_centavos, 1000);

  // ── 9. cerrarSesion — sesión de otra sucursal (model devuelve null) ───────
  mockMode = 'sesion_not_found';
  const cierre404 = await invoke('cerrarSesion', specific({ params: { id: '99' }, body: { efectivo_contado_centavos: 1200, fondo_siguiente_centavos: 0 } }));
  assert.strictEqual(cierre404.statusCode, 404);
  assert.strictEqual(cierre404.body.code, 'SESION_NO_ENCONTRADA');

  // ── 10. cerrarSesion — diferencia calculada correctamente ─────────────────
  mockMode = 'ok';
  // mock: esperado = 1000, contado = 1200 → diferencia = +200
  const cierre = await invoke('cerrarSesion', specific({ params: { id: '5' }, body: { efectivo_contado_centavos: 1200, fondo_siguiente_centavos: 0, notas_cierre: 'turno noche' } }));
  assert.strictEqual(cierre.statusCode, 200);
  assert.strictEqual(cierre.body.data.diferencia, 200,    'diferencia = contado - esperado');
  assert.strictEqual(cierre.body.data.efectivoEsperado, 1000);
  assert.strictEqual(cierre.body.data.efectivoContado,  1200);

  // contado menor → diferencia negativa (faltante)
  const cierreNeg = await invoke('cerrarSesion', specific({ params: { id: '6' }, body: { efectivo_contado_centavos: 800, fondo_siguiente_centavos: 0 } }));
  assert.strictEqual(cierreNeg.body.data.diferencia, -200, 'diferencia negativa = faltante');

  // ── 11. cerrarSesion — conteo inválido rechazado ──────────────────────────
  const conteoBad = await invoke('cerrarSesion', specific({ params: { id: '7' }, body: { efectivo_contado_centavos: -5, fondo_siguiente_centavos: 0 } }));
  assert.strictEqual(conteoBad.statusCode, 400);
  assert.strictEqual(conteoBad.body.code, 'CONTEO_INVALIDO');

  // ── 12. getHistorial specific ────────────────────────────────────────────
  const hist = await invoke('getHistorial', specific({ query: { page: '1', limit: '10' } }));
  assert.strictEqual(hist.statusCode, 200);
  assert.ok(Array.isArray(hist.body.data));

  // ── 13. getHistorial consolidated ───────────────────────────────────────
  const histAll = await invoke('getHistorial', consolidated({ query: {} }));
  assert.strictEqual(histAll.statusCode, 200);

  // ── 14. Routes: branchScope en todas; requireBranchSpecific en escrituras ─
  const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'cajaSesionRoutes.js'), 'utf8');
  assert.match(routes, /router\.use\(.*branchScope\)/, 'branchScope debe estar como middleware global');
  assert.match(routes, /router\.post\('\/abrir'[\s\S]{0,80}requireBranchSpecific/,     'abrir requiere specific');
  assert.match(routes, /router\.post\('\/:id\/cerrar'[\s\S]{0,80}requireBranchSpecific/, 'cerrar requiere specific');
  assert.doesNotMatch(routes, /router\.get\('\/activa'[\s\S]{0,80}requireBranchSpecific/, 'activa no requiere specific');
  assert.doesNotMatch(routes, /router\.get\('\/historial'[\s\S]{0,80}requireBranchSpecific/, 'historial no requiere specific');
  assert.match(routes, /cajas\.sesion\.ver/);
  assert.match(routes, /cajas\.sesion\.operar/);
  assert.match(
    routes,
    /router\.get\('\/activa'[\s\S]{0,100}cajas\.sesion\.operar/,
    'la sesión activa propia debe requerir permiso de operación'
  );
  assert.match(
    routes,
    /router\.get\('\/historial'[\s\S]{0,100}cajas\.sesion\.ver/,
    'el historial administrativo debe requerir permiso de consulta'
  );

  // ── 15. Scope de usuario en sesión activa y cierre ─────────────────────
  const modelSrc = fs.readFileSync(
    path.join(__dirname, '..', 'models', 'cajaSesionModel.js'), 'utf8'
  );
  const controllerSrc = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'cajaSesionController.js'), 'utf8'
  );

  assert.match(
    modelSrc,
    /cs\.usuario_apertura_id = \?/,
    'la sesión activa debe filtrarse por usuario autenticado'
  );
  assert.match(
    modelSrc,
    /AND usuario_apertura_id = \?/,
    'el cierre debe exigir que la sesión pertenezca al usuario'
  );
  assert.match(
    modelSrc,
    /AND c\.sucursal_id = cs\.sucursal_id/,
    'el JOIN de cajas debe incluir sucursal'
  );
  assert.match(
    controllerSrc,
    /listarActivas\([\s\S]{0,180}usuarioId/,
    'controller debe pasar usuarioId al buscar sesión activa'
  );
  assert.match(
    controllerSrc,
    /usuarioId: cerradoPor/,
    'controller debe pasar usuario autenticado al cierre'
  );

  // ── 16. Migración: estructura ───────────────────────────────────────────
  const mig = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'migration_caja_sesiones_sprint_2a.sql'), 'utf8'
  );
  assert.match(mig, /CREATE TABLE IF NOT EXISTS caja_sesiones/);
  // FK compuesta caja
  assert.match(mig, /FOREIGN KEY \(empresa_id, sucursal_id, caja_id\)/);
  assert.match(mig, /REFERENCES cajas\(empresa_id, sucursal_id, id\)/);
  // UK en cajas para la FK
  assert.match(mig, /uk_cajas_empresa_sucursal_id/);
  // Columnas generadas para unicidad de sesión abierta
  assert.match(mig, /sesion_abierta_caja[\s\S]{0,120}PERSISTENT/);
  assert.match(mig, /sesion_abierta_usuario[\s\S]{0,120}PERSISTENT/);
  assert.match(mig, /uk_sesion_caja_abierta/);
  assert.match(mig, /uk_sesion_usuario_abierta/);
  // Permisos
  assert.match(mig, /cajas\.sesion\.ver/);
  assert.match(mig, /cajas\.sesion\.operar/);
  assert.match(mig, /FROM empresas e[\s\S]{0,120}CROSS JOIN roles r/);
  assert.match(mig, /UPPER\(r\.nombre\) = 'ADMINISTRADOR'/);
  assert.match(mig, /UPPER\(r\.nombre\) = 'VENTAS'/);
  // No toca tablas heredadas
  assert.doesNotMatch(mig, /ALTER TABLE (caja_chica|cuentas_bancarias|ventas|reparaciones)/i);

  console.log('OK cajaSesion: sesión activa, abrir, cerrar, diferencia, aislamiento, rutas y migración');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
