const permisoService = require('../services/permisoService');

function requirePermission(code) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.tenant) {
        return res.status(401).json({ message: 'No autorizado' });
      }
      const permissions = await permisoService.getEffectivePermissions(req);
      req.user.permissions = permissions;
      if (permissions.includes('*') || permissions.includes(code)) return next();
      return res.status(403).json({
        message: 'No tienes permisos para esta acción',
        permission: code,
      });
    } catch (error) {
      console.error(`requirePermission(${code}) error:`, error);
      return res.status(500).json({ message: 'Error al validar permisos' });
    }
  };
}

module.exports = requirePermission;
