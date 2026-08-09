'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let mode = 'ok';
let cerrarArgs = null;

const mockModel = {
  listarActivas: async () => [],
  listar: async () => [],

  obtenerSugerenciaApertura: async ({
    empresaId,
    sucursalId,
    cajaId,
  }) => {
    if (mode === 'caja_not_found') {
      return null;
    }

    return {
      caja_id: Number(cajaId),
      empresa_id: Number(empresaId),
      sucursal_id: Number(sucursalId),
      sesion_anterior_id: 45,
      fondo_sugerido_centavos: 50000,
      fecha_cierre_anterior:
        '2026-08-08T18:00:00.000Z',
    };
  },

  crear: async () => ({
    id: 99,
    estado: 'ABIERTA',
  }),

  cerrar: async args => {
    cerrarArgs = args;

    if (mode === 'sesion_not_found') {
      return null;
    }

    const esperado = 250000;
    const contado = Number(args.efectivoContado);
    const fondo = Number(args.fondoSiguiente);

    return {
      sesionId: Number(args.sesionId),
      diferencia: contado - esperado,
      efectivoEsperado: esperado,
      efectivoContado: contado,
      fondoSiguiente: fondo,
      retiroCierre: contado - fondo,
    };
  },
};

require.cache[
  require.resolve('../models/cajaSesionModel')
] = {
  exports: mockModel,
};

const controller =
  require('../controllers/cajaSesionController');

function res() {
  const r = {
    statusCode: 200,
    body: null,
  };

  r.status = code => {
    r.statusCode = code;
    return r;
  };

  r.json = body => {
    r.body = body;
    return r;
  };

  return r;
}

function specific(overrides = {}) {
  return {
    user: {
      id: 5,
      userId: 5,
    },
    branchScope: {
      mode: 'specific',
      empresaId: 10,
      sucursalId: 7,
      allowedSucursalIds: [7],
    },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

async function invoke(method, req) {
  const r = res();
  await controller[method](req, r);
  return r;
}

async function main() {
  // Sugerencia sin caja.
  mode = 'ok';

  const sinCaja = await invoke(
    'getSugerenciaApertura',
    specific({
      query: {},
    }),
  );

  assert.strictEqual(
    sinCaja.statusCode,
    400,
  );

  assert.strictEqual(
    sinCaja.body.code,
    'CAJA_REQUERIDA',
  );

  // Caja inexistente / fuera de scope.
  mode = 'caja_not_found';

  const caja404 = await invoke(
    'getSugerenciaApertura',
    specific({
      query: {
        caja_id: '99',
      },
    }),
  );

  assert.strictEqual(
    caja404.statusCode,
    404,
  );

  assert.strictEqual(
    caja404.body.code,
    'CAJA_NO_ENCONTRADA',
  );

  // Sugerencia del último cierre.
  mode = 'ok';

  const sugerencia = await invoke(
    'getSugerenciaApertura',
    specific({
      query: {
        caja_id: '3',
      },
    }),
  );

  assert.strictEqual(
    sugerencia.statusCode,
    200,
  );

  assert.strictEqual(
    sugerencia.body.data.caja_id,
    3,
  );

  assert.strictEqual(
    sugerencia.body.data.fondo_sugerido_centavos,
    50000,
  );

  // Fondo siguiente negativo.
  const fondoNegativo = await invoke(
    'cerrarSesion',
    specific({
      params: {
        id: '8',
      },
      body: {
        efectivo_contado_centavos: 248000,
        fondo_siguiente_centavos: -1,
      },
    }),
  );

  assert.strictEqual(
    fondoNegativo.statusCode,
    400,
  );

  assert.strictEqual(
    fondoNegativo.body.code,
    'FONDO_SIGUIENTE_INVALIDO',
  );

  // No puede dejar más de lo contado.
  const fondoMayor = await invoke(
    'cerrarSesion',
    specific({
      params: {
        id: '8',
      },
      body: {
        efectivo_contado_centavos: 248000,
        fondo_siguiente_centavos: 249000,
      },
    }),
  );

  assert.strictEqual(
    fondoMayor.statusCode,
    400,
  );

  assert.strictEqual(
    fondoMayor.body.code,
    'FONDO_SIGUIENTE_SUPERA_CONTADO',
  );

  // Cierre correcto:
  // contado Q2480,
  // dejar Q500,
  // retirar Q1980.
  cerrarArgs = null;

  const cierre = await invoke(
    'cerrarSesion',
    specific({
      params: {
        id: '8',
      },
      body: {
        efectivo_contado_centavos: 248000,
        fondo_siguiente_centavos: 50000,
        notas_cierre: 'Cierre del día',
      },
    }),
  );

  assert.strictEqual(
    cierre.statusCode,
    200,
  );

  assert.ok(cerrarArgs);

  assert.strictEqual(
    cerrarArgs.fondoSiguiente,
    50000,
  );

  assert.strictEqual(
    cierre.body.data.efectivoContado,
    248000,
  );

  assert.strictEqual(
    cierre.body.data.fondoSiguiente,
    50000,
  );

  assert.strictEqual(
    cierre.body.data.retiroCierre,
    198000,
  );

  // Un cliente viejo que omita el fondo siguiente
  // debe ser rechazado para evitar retirar todo por error.
  cerrarArgs = null;

  const cierreSinFondo = await invoke(
    'cerrarSesion',
    specific({
      params: {
        id: '9',
      },
      body: {
        efectivo_contado_centavos: 100000,
      },
    }),
  );

  assert.strictEqual(
    cierreSinFondo.statusCode,
    400,
  );

  assert.strictEqual(
    cierreSinFondo.body.code,
    'FONDO_SIGUIENTE_REQUERIDO',
  );

  assert.strictEqual(
    cerrarArgs,
    null,
  );

  // Fuente del modelo.
  const model = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'models',
      'cajaSesionModel.js',
    ),
    'utf8',
  );

  assert.match(
    model,
    /fondo_siguiente_centavos/,
  );

  assert.match(
    model,
    /fondo_sugerido_centavos/,
  );

  assert.match(
    model,
    /diferencia_apertura_centavos/,
  );

  assert.match(
    model,
    /retiro_cierre_centavos/,
  );

  assert.match(
    model,
    /estado = 'CERRADA'[\s\S]{0,180}ORDER BY fecha_cierre DESC/,
  );

  assert.match(
    model,
    /Number\(fondoInicial\) - fondoSugerido/,
  );

  assert.match(
    model,
    /contado - fondoSiguienteNormalizado/,
  );

  // El último cierre debe estar scoped por
  // empresa + sucursal + caja.
  assert.match(
    model,
    /empresa_id = \?[\s\S]{0,100}sucursal_id = \?[\s\S]{0,100}caja_id = \?/,
  );

  // Ruta de sugerencia.
  const routes = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'routes',
      'cajaSesionRoutes.js',
    ),
    'utf8',
  );

  assert.match(
    routes,
    /\/sugerencia-apertura/,
  );

  assert.match(
    routes,
    /\/sugerencia-apertura[\s\S]{0,180}cajas\.sesion\.operar[\s\S]{0,180}requireBranchSpecific/,
  );

  // Migración nueva.
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'scripts',
      'migration_caja_sesion_arrastre_sprint_2c1.sql',
    ),
    'utf8',
  );

  for (const column of [
    'fondo_sugerido_centavos',
    'diferencia_apertura_centavos',
    'fondo_siguiente_centavos',
    'retiro_cierre_centavos',
  ]) {
    assert.match(
      migration,
      new RegExp(column),
    );
  }

  assert.doesNotMatch(
    migration,
    /^\s*UPDATE\s+caja_sesiones/im,
    '2C.1 no debe hacer backfill',
  );

  console.log(
    'OK cajaSesionArrastre2C1: sugerencia, diferencia de apertura, fondo siguiente y retiro de cierre',
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
