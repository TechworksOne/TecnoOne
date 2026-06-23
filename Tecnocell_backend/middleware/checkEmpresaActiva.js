const subscriptionAccess = require('../services/subscriptionAccessService');

function empresaInactivaResponse(res, code = 'EMPRESA_SUSPENDIDA') {
  return res.status(403).json({
    success: false,
    code,
    message: subscriptionAccess.mensajeAccesoDenegado(code),
  });
}

async function checkEmpresaActiva(req, res, next) {
  try {
    if (req.tenant?.isSuperadmin === true) {
      return next();
    }

    const empresaId = req.tenant?.empresa_id;

    if (!empresaId) {
      return empresaInactivaResponse(res);
    }

    const acceso = await subscriptionAccess.evaluarAccesoEmpresa(empresaId);
    if (!acceso.permitido) {
      return empresaInactivaResponse(res, acceso.code);
    }

    req.empresa = {
      ...acceso.empresa,
      suscripcion: acceso.suscripcion,
      estado_suscripcion: acceso.estado_suscripcion,
      dias_restantes: acceso.dias_restantes,
      proxima_a_vencer: acceso.proxima_a_vencer,
    };

    return next();
  } catch (error) {
    console.error('Error en checkEmpresaActiva:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verificando estado de la empresa',
    });
  }
}

module.exports = checkEmpresaActiva;
