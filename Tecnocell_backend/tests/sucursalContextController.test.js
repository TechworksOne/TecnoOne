const assert = require('assert');

const sucursales = [
  { id: 7, activa: 1, es_predeterminada: 1 },
  { id: 8, activa: 1, es_predeterminada: 0 },
];
require.cache[require.resolve('../services/sucursalService')] = {
  exports: { listarSucursalesActivasUsuario: async () => sucursales },
};
let canConsolidate = true;
require.cache[require.resolve('../services/permisoService')] = {
  exports: { hasPermission: async (req, code) => {
    assert.strictEqual(req.tenant.empresa_id, 20);
    return canConsolidate && code === 'sucursales.contexto_consolidado';
  } },
};
const branchScopeStub = () => {};
branchScopeStub.CONSOLIDATED_PERMISSION = 'sucursales.contexto_consolidado';
require.cache[require.resolve('../middleware/branchScope')] = { exports: branchScopeStub };

const controller = require('../controllers/sucursalContextController');

async function main() {
  const req = { tenant: { empresa_id: 20 }, user: { id: 28, userId: 28, empresa_id: 20, empresaId: 20 } };
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

  canConsolidate = false;
  await controller.listarMisSucursales(
    { tenant: { empresa_id: 20 }, user: { id: 29, userId: 29, empresa_id: 20, empresaId: 20 } },
    res
  );
  assert.strictEqual(res.body.data.canUseConsolidated, false);

  console.log('OK sucursalContextController: contrato extendido de mis-sucursales');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
