const sucursalService = require('../services/sucursalService');
const permisoService = require('../services/permisoService');
const branchScope = require('../middleware/branchScope');

exports.listarMisSucursales = async (req, res) => {
  try {
    if (req.user?.esSuperAdmin || req.user?.es_super_admin) {
      return res.status(403).json({
        success: false,
        code: 'SUPERADMIN_BRANCH_CONTEXT_FORBIDDEN',
        message: 'Super Admin no utiliza contexto de sucursal operativa',
      });
    }
    const empresaId = req.user?.empresaId ?? req.user?.empresa_id;
    const usuarioId = req.user?.userId ?? req.user?.id;
    const sucursales = await sucursalService.listarSucursalesActivasUsuario(
      empresaId,
      usuarioId
    );
    const canUseConsolidated = await permisoService.hasPermission(
      req,
      branchScope.CONSOLIDATED_PERMISSION
    );
    const defaultSucursal = sucursales.find(item => Boolean(item.es_predeterminada))
      || sucursales[0];
    return res.json({
      success: true,
      data: {
        sucursales,
        canUseConsolidated,
        defaultSucursalId: defaultSucursal ? Number(defaultSucursal.id) : null,
      },
    });
  } catch (error) {
    console.error('listarMisSucursales error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'BRANCH_CONTEXT_ERROR',
      message: error.statusCode ? error.message : 'Error cargando sucursales asignadas',
    });
  }
};
