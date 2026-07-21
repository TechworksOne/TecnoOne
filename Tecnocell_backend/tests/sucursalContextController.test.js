const assert = require('assert');

const sucursales = [
  { id: 7, activa: 1, es_predeterminada: 1 },
  { id: 8, activa: 1, es_predeterminada: 0 },
];
require.cache[require.resolve('../services/sucursalService')] = {
  exports: { listarSucursalesActivasUsuario: async () => sucursales },
};
require.cache[require.resolve('../services/permisoService')] = {
  exports: { hasPermission: async (_req, code) => code === 'sucursales.contexto_consolidado' },
};
const branchScopeStub = () => {};
branchScopeStub.CONSOLIDATED_PERMISSION = 'sucursales.contexto_consolidado';
require.cache[require.resolve('../middleware/branchScope')] = { exports: branchScopeStub };

const controller = require('../controllers/sucursalContextController');

async function main() {
  const req = { user: { id: 5, userId: 5, empresa_id: 10, empresaId: 10 } };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await controller.listarMisSucursales(req, res);
  assert.deepStrictEqual(res.body, {
    success: true,
    data: {
      sucursales,
      canUseConsolidated: true,
      defaultSucursalId: 7,
    },
  });

  console.log('OK sucursalContextController: contrato extendido de mis-sucursales');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
