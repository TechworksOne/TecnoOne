const assert = require('assert');
const fs = require('fs');
const path = require('path');

const db = {
  query: async () => {
    throw new Error('DB mock no configurado');
  },
};

require.cache[require.resolve('../config/database')] = {
  exports: db,
};

const planAccess = require('../services/planAccessService');
const requirePlanModule = require('../middleware/requirePlanModule');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function runMiddleware(middleware, req) {
  const res = response();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  return { res, nextCalled };
}

function mockUserLimitDb({ maxUsuarios, activeRows }) {
  db.query = async (sql, params = []) => {
    if (sql.includes('FROM suscripciones')) {
      return [[{
        suscripcion_id: 1,
        empresa_id: params[0] || 10,
        plan_id: 2,
        plan_codigo: maxUsuarios === null ? 'legacy_full' : 'pos',
        plan_nombre: maxUsuarios === null ? 'Legacy Full' : 'POS',
        max_usuarios: maxUsuarios,
      }]];
    }

    if (sql.includes('FROM users')) {
      assert(sql.includes("COALESCE(tipo_usuario, 'EMPRESA') = 'EMPRESA'"));
      assert(sql.includes('COALESCE(es_super_admin, 0) = 0'));
      assert(sql.includes('active = 1'));

      if (sql.includes('id <> ?')) {
        return [activeRows.filter(row => row.id !== params[1])];
      }

      return [activeRows];
    }

    return [[]];
  };
}

async function testModuleMiddleware() {
  const original = planAccess.obtenerAccesoModuloEmpresa;

  try {
    planAccess.obtenerAccesoModuloEmpresa =
      async (_empresaId, modulo) => ({
        empresa_id: 10,
        plan_id: 1,
        plan_codigo: 'pos',
        modulo_codigo: modulo,
        habilitado: ['ventas', 'productos', 'inventario'].includes(modulo),
      });

    const allowed = await runMiddleware(
      requirePlanModule('ventas'),
      {
        user: { id: 1 },
        tenant: { empresa_id: 10 },
      }
    );

    assert.strictEqual(allowed.nextCalled, true);
    assert.strictEqual(allowed.res.statusCode, 200);

    const denied = await runMiddleware(
      requirePlanModule('reparaciones'),
      {
        user: { id: 1 },
        tenant: { empresa_id: 10 },
      }
    );

    assert.strictEqual(denied.nextCalled, false);
    assert.strictEqual(denied.res.statusCode, 403);
    assert.strictEqual(denied.res.body.code, 'MODULE_NOT_INCLUDED');
    assert.strictEqual(denied.res.body.module, 'reparaciones');
  } finally {
    planAccess.obtenerAccesoModuloEmpresa = original;
  }
}

async function testUserLimits() {
  mockUserLimitDb({
    maxUsuarios: 2,
    activeRows: [{ id: 1 }],
  });
  const secondUser = await planAccess.validarLimiteUsuarios(10, db);
  assert.strictEqual(secondUser.permitido, true);
  assert.strictEqual(secondUser.projected, 2);

  mockUserLimitDb({
    maxUsuarios: 2,
    activeRows: [{ id: 1 }, { id: 2 }],
  });
  await assert.rejects(
    () => planAccess.validarLimiteUsuarios(10, db),
    error =>
      error.code === 'PLAN_LIMIT_EXCEEDED' &&
      error.statusCode === 409 &&
      error.used === 2 &&
      error.limit === 2
  );

  mockUserLimitDb({
    maxUsuarios: 2,
    activeRows: [{ id: 1 }],
  });
  const inactiveDoesNotCount = await planAccess.validarLimiteUsuarios(10, db);
  assert.strictEqual(inactiveDoesNotCount.projected, 2);

  mockUserLimitDb({
    maxUsuarios: 2,
    activeRows: [{ id: 1 }],
  });
  const globalDoesNotCount = await planAccess.validarLimiteUsuarios(10, db);
  assert.strictEqual(globalDoesNotCount.projected, 2);

  mockUserLimitDb({
    maxUsuarios: null,
    activeRows: [{ id: 1 }, { id: 2 }, { id: 3 }],
  });
  const unlimited = await planAccess.validarLimiteUsuarios(10, db);
  assert.strictEqual(unlimited.permitido, true);
  assert.strictEqual(unlimited.ilimitado, true);
  assert.strictEqual(unlimited.limit, null);

  mockUserLimitDb({
    maxUsuarios: 2,
    activeRows: [{ id: 1 }, { id: 2 }],
  });
  const editAtLimit = await planAccess.validarLimiteUsuarios(10, db, {
    incremento: 0,
    excludeUserId: 2,
  });
  assert.strictEqual(editAtLimit.permitido, true);

  mockUserLimitDb({
    maxUsuarios: 2,
    activeRows: [{ id: 1 }],
  });
  const reactivateWithCapacity = await planAccess.validarLimiteUsuarios(10, db);
  assert.strictEqual(reactivateWithCapacity.projected, 2);

  mockUserLimitDb({
    maxUsuarios: 2,
    activeRows: [{ id: 1 }, { id: 2 }],
  });
  await assert.rejects(
    () => planAccess.validarLimiteUsuarios(10, db),
    error => error.code === 'PLAN_LIMIT_EXCEEDED'
  );

  mockUserLimitDb({
    maxUsuarios: 2,
    activeRows: [{ id: 1 }, { id: 2 }],
  });
  const deactivate = await planAccess.validarLimiteUsuarios(10, db, {
    incremento: 0,
  });
  assert.strictEqual(deactivate.permitido, true);
}

async function testPlanSwitchModules() {
  const original = planAccess.obtenerAccesoModuloEmpresa;

  try {
    let enabled = new Set(['ventas', 'productos', 'inventario']);
    planAccess.obtenerAccesoModuloEmpresa = async (_empresaId, modulo) => ({
      empresa_id: 10,
      plan_id: 1,
      plan_codigo: enabled.has('reparaciones') ? 'taller' : 'pos',
      modulo_codigo: modulo,
      habilitado: enabled.has(modulo),
    });

    for (const modulo of ['ventas', 'productos', 'inventario']) {
      const result = await runMiddleware(requirePlanModule(modulo), {
        user: { id: 1 },
        tenant: { empresa_id: 10 },
      });
      assert.strictEqual(result.nextCalled, true, `POS permite ${modulo}`);
    }

    for (const modulo of ['reparaciones', 'taller_operativo']) {
      const result = await runMiddleware(requirePlanModule(modulo), {
        user: { id: 1 },
        tenant: { empresa_id: 10 },
      });
      assert.strictEqual(result.res.statusCode, 403, `POS bloquea ${modulo}`);
    }

    enabled = new Set(['ventas', 'productos', 'inventario']);
    let result = await runMiddleware(requirePlanModule('reparaciones'), {
      user: { id: 1 },
      tenant: { empresa_id: 10 },
    });
    assert.strictEqual(result.res.statusCode, 403);

    enabled = new Set(['ventas', 'productos', 'inventario', 'reparaciones', 'taller_operativo']);
    result = await runMiddleware(requirePlanModule('reparaciones'), {
      user: { id: 1 },
      tenant: { empresa_id: 10 },
    });
    assert.strictEqual(result.nextCalled, true);
  } finally {
    planAccess.obtenerAccesoModuloEmpresa = original;
  }
}

function readRepoFile(relativePath) {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', relativePath),
    'utf8'
  );
}

function assertRouteModule(source, route, moduleCode) {
  const line = source
    .split(/\r?\n/)
    .find(current => current.includes(route));

  assert(line, `No se encontro ruta ${route}`);
  assert(line.includes(`requirePlanModule('${moduleCode}')`), `${route} requiere ${moduleCode}`);

  const moduleIndex = line.indexOf(`requirePlanModule('${moduleCode}')`);
  const permissionIndex = line.indexOf('requirePermission(');
  assert(moduleIndex >= 0 && permissionIndex > moduleIndex, `${route} valida modulo antes del permiso`);

  if (line.includes('uploadImagenesProducto')) {
    assert(moduleIndex < line.indexOf('uploadImagenesProducto'), `${route} valida modulo antes de Multer`);
  }
}

function testProductRoutes() {
  const source = readRepoFile('Tecnocell_backend/routes/productRoutes.js');
  assert(source.includes("const requirePlanModule = require('../middleware/requirePlanModule');"));

  assertRouteModule(source, "router.get('/search'", 'productos');
  assertRouteModule(source, "router.get('/alerts/critical-stock'", 'inventario');
  assertRouteModule(source, "router.get('/',", 'productos');
  assertRouteModule(source, "router.get('/:id',", 'productos');
  assertRouteModule(source, "router.get('/:id/kardex'", 'inventario');
  assertRouteModule(source, "router.post('/'", 'productos');
  assertRouteModule(source, "router.put('/:id'", 'productos');
  assertRouteModule(source, "router.patch('/:id/stock'", 'inventario');
  assertRouteModule(source, "router.delete('/:id'", 'productos');

  const controller = readRepoFile('Tecnocell_backend/controllers/productController.js');
  assert(!controller.includes('planAccessService'));
  assert(!controller.includes('assertProductModuleIncluded'));
  assert(!controller.includes('withProductPlanAccess'));
  assert(!controller.includes('Object.keys(exports)'));
}

function testPagoTarjetaRoute() {
  const source = readRepoFile('src/routes.tsx');
  const line = source
    .split(/\r?\n/)
    .find(current => current.includes('"/pago-tarjeta"'));

  assert(line, 'Existe ruta /pago-tarjeta');
  assert(line.includes("PPM('ventas.crear', 'ventas'"), '/pago-tarjeta requiere ventas.crear y modulo ventas');
}

async function main() {
  await testModuleMiddleware();
  await testUserLimits();
  await testPlanSwitchModules();
  testProductRoutes();
  testPagoTarjetaRoute();
  console.log('OK planEnforcement: modulos, limites y rutas criticas validados');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
