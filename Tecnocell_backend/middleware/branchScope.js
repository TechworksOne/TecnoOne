const db = require('../config/database');
const permisoService = require('../services/permisoService');

const CONSOLIDATED_PERMISSION = 'sucursales.contexto_consolidado';

function contextError(res, status, code, message) {
  return res.status(status).json({ success: false, code, message });
}

async function branchScope(req, res, next) {
  if (!req.user) return contextError(res, 401, 'UNAUTHORIZED', 'No autorizado');
  if (req.user.esSuperAdmin || req.user.es_super_admin) {
    return contextError(
      res,
      403,
      'SUPERADMIN_BRANCH_CONTEXT_FORBIDDEN',
      'Super Admin no utiliza contexto de sucursal operativa'
    );
  }

  const empresaId = Number(req.user.empresaId ?? req.user.empresa_id);
  const usuarioId = Number(req.user.userId ?? req.user.id);
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return contextError(res, 403, 'COMPANY_CONTEXT_REQUIRED', 'Empresa no asignada al usuario');
  }

  const rawContext = String(req.get('X-Sucursal-Id') || '').trim();
  if (!rawContext) {
    return contextError(res, 400, 'BRANCH_CONTEXT_REQUIRED', 'Seleccione una sucursal valida');
  }

  try {
    const [assigned] = await db.query(
      `SELECT s.id, s.empresa_id, s.codigo, s.nombre, s.activa,
              s.es_principal, us.es_predeterminada
       FROM usuario_sucursales us
       INNER JOIN sucursales s
         ON s.id = us.sucursal_id AND s.empresa_id = us.empresa_id
       WHERE us.usuario_id = ? AND us.empresa_id = ?
       ORDER BY us.es_predeterminada DESC, s.es_principal DESC, s.nombre, s.id`,
      [usuarioId, empresaId]
    );

    const activeAssigned = assigned.filter(item => Boolean(item.activa));
    const allowedSucursalIds = activeAssigned.map(item => Number(item.id));

    if (rawContext.toUpperCase() === 'ALL') {
      const canUseConsolidated = await permisoService.hasPermission(
        req,
        CONSOLIDATED_PERMISSION
      );
      if (!canUseConsolidated) {
        return contextError(
          res,
          403,
          'CONSOLIDATED_CONTEXT_FORBIDDEN',
          'No tiene permiso para consultar todas las sucursales'
        );
      }
      if (!allowedSucursalIds.length) {
        return contextError(
          res,
          409,
          'USER_BRANCH_REQUIRED',
          'El usuario no tiene sucursales activas asignadas'
        );
      }

      req.branchScope = {
        mode: 'consolidated',
        empresaId,
        sucursalId: null,
        allowedSucursalIds,
      };
      req.sucursal_id = null;
      req.sucursal_context = null;
      req.sucursal = null;
      return next();
    }

    const sucursalId = Number(rawContext);
    if (!Number.isInteger(sucursalId) || sucursalId <= 0) {
      return contextError(res, 400, 'BRANCH_CONTEXT_REQUIRED', 'Seleccione una sucursal valida');
    }

    const selected = assigned.find(item => Number(item.id) === sucursalId);
    if (!selected) {
      return contextError(
        res,
        403,
        'BRANCH_NOT_ASSIGNED',
        'La sucursal no pertenece a la empresa o no esta asignada al usuario'
      );
    }
    if (!Boolean(selected.activa)) {
      return contextError(res, 409, 'BRANCH_INACTIVE', 'La sucursal seleccionada esta inactiva');
    }

    req.branchScope = {
      mode: 'specific',
      empresaId,
      sucursalId,
      allowedSucursalIds,
    };

    // Alias temporales para los consumidores existentes.
    req.sucursal_id = sucursalId;
    req.sucursal_context = selected;
    req.sucursal = { ...selected, id: sucursalId };
    return next();
  } catch (error) {
    console.error('branchScope error:', error);
    return contextError(res, 500, 'BRANCH_CONTEXT_ERROR', 'Error validando la sucursal');
  }
}

branchScope.CONSOLIDATED_PERMISSION = CONSOLIDATED_PERMISSION;

module.exports = branchScope;

