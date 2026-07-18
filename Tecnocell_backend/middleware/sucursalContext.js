const db = require('../config/database');

function contextError(res, status, code, message) {
  return res.status(status).json({ success: false, code, message });
}

async function sucursalContext(req, res, next) {
  if (!req.user) return contextError(res, 401, 'UNAUTHORIZED', 'No autorizado');
  if (req.user.esSuperAdmin || req.user.es_super_admin) {
    return contextError(
      res,
      403,
      'SUPERADMIN_BRANCH_CONTEXT_FORBIDDEN',
      'Super Admin no utiliza contexto de sucursal operativa'
    );
  }

  const rawId = req.get('X-Sucursal-Id');
  const sucursalId = Number(rawId);
  if (!Number.isInteger(sucursalId) || sucursalId <= 0) {
    return contextError(res, 400, 'BRANCH_CONTEXT_REQUIRED', 'Seleccione una sucursal valida');
  }
  const empresaId = Number(req.user.empresaId ?? req.user.empresa_id);
  const usuarioId = Number(req.user.userId ?? req.user.id);

  try {
    const [[sucursal]] = await db.query(
      `SELECT s.id, s.empresa_id, s.codigo, s.nombre, s.activa,
              s.es_principal, us.es_predeterminada
       FROM sucursales s
       INNER JOIN usuario_sucursales us
         ON us.sucursal_id = s.id AND us.empresa_id = s.empresa_id
       WHERE s.id = ? AND s.empresa_id = ? AND us.usuario_id = ?
       LIMIT 1`,
      [sucursalId, empresaId, usuarioId]
    );
    if (!sucursal) {
      return contextError(
        res,
        403,
        'BRANCH_NOT_ASSIGNED',
        'La sucursal no pertenece a la empresa o no esta asignada al usuario'
      );
    }
    if (!Boolean(sucursal.activa)) {
      return contextError(res, 409, 'BRANCH_INACTIVE', 'La sucursal seleccionada esta inactiva');
    }
    req.sucursal_id = Number(sucursal.id);
    req.sucursal_context = sucursal;
    req.sucursal = { ...sucursal, id: Number(sucursal.id) };
    return next();
  } catch (error) {
    console.error('sucursalContext error:', error);
    return contextError(res, 500, 'BRANCH_CONTEXT_ERROR', 'Error validando la sucursal');
  }
}

module.exports = sucursalContext;
