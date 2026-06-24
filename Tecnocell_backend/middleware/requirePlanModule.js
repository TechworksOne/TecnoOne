const planAccess = require(
  '../services/planAccessService'
);

function requirePlanModule(moduleCode) {
  const normalizedModuleCode = String(
    moduleCode || ''
  )
    .trim()
    .toLowerCase();

  if (!normalizedModuleCode) {
    throw new Error(
      'requirePlanModule requiere un código de módulo'
    );
  }

  return async (req, res, next) => {
    try {
      if (!req.user || !req.tenant) {
        return res.status(401).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const empresaId = Number(
        req.tenant.empresa_id
      );

      if (
        !Number.isInteger(empresaId) ||
        empresaId <= 0
      ) {
        return res.status(403).json({
          success: false,
          code: 'EMPRESA_NOT_ASSIGNED',
          message:
            'Empresa no asignada al usuario'
        });
      }

      const acceso =
        await planAccess
          .obtenerAccesoModuloEmpresa(
            empresaId,
            normalizedModuleCode
          );

      req.planAccess = {
        empresa_id: empresaId,
        plan_id: acceso.plan_id,
        plan_codigo: acceso.plan_codigo,
        modulo: normalizedModuleCode,
        habilitado: acceso.habilitado,
      };

      if (acceso.habilitado) {
        return next();
      }

      return res.status(403).json({
        success: false,
        code: 'MODULE_NOT_INCLUDED',
        module: normalizedModuleCode,
        plan: acceso.plan_codigo,
        message:
          'Este módulo no está incluido en el plan contratado.'
      });
    } catch (error) {
      console.error(
        `requirePlanModule(${normalizedModuleCode}) error:`,
        error
      );

      return res.status(
        Number(error.statusCode || 500)
      ).json({
        success: false,
        code:
          error.code ||
          'MODULE_VALIDATION_ERROR',
        message:
          error.statusCode
            ? error.message
            : 'Error al validar el módulo contratado'
      });
    }
  };
}

module.exports = requirePlanModule;
