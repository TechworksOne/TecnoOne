const sucursalService = require('../services/sucursalService');

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
    const data = await sucursalService.listarSucursalesActivasUsuario(
      empresaId,
      usuarioId
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error('listarMisSucursales error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'BRANCH_CONTEXT_ERROR',
      message: error.statusCode ? error.message : 'Error cargando sucursales asignadas',
    });
  }
};
