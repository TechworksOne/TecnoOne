const sucursalService = require('../services/sucursalService');

function empresaId(req) {
  return req.params.empresaId || req.tenant?.empresa_id || req.params.id;
}

function sucursalId(req) {
  return req.params.sucursalId || req.params.idSucursal;
}

function usuarioId(req) {
  return req.params.userId || req.params.id;
}

function errorResponse(res, error) {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      code: 'BRANCH_CODE_CONFLICT',
      message: 'Ya existe una sucursal con ese codigo',
    });
  }
  return res.status(error.statusCode || 500).json({
    success: false,
    code: error.code || 'SUCURSAL_ERROR',
    resource: error.resource,
    used: error.used,
    limit: error.limit,
    plan: error.plan,
    message: error.statusCode ? error.message : 'Error administrando sucursales',
  });
}

exports.listar = async (req, res) => {
  try {
    const data = await sucursalService.listarSucursales(empresaId(req));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('listarSucursales error:', error);
    return errorResponse(res, error);
  }
};

exports.crear = async (req, res) => {
  try {
    const data = await sucursalService.crearSucursal(empresaId(req), req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('crearSucursal error:', error);
    return errorResponse(res, error);
  }
};

exports.editar = async (req, res) => {
  try {
    const data = await sucursalService.editarSucursal(
      empresaId(req),
      sucursalId(req),
      req.body
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error('editarSucursal error:', error);
    return errorResponse(res, error);
  }
};

exports.cambiarEstado = async (req, res) => {
  try {
    if (typeof req.body?.activa !== 'boolean') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_BRANCH_STATE',
        message: 'activa debe ser booleano',
      });
    }
    const data = await sucursalService.cambiarEstadoSucursal(
      empresaId(req),
      sucursalId(req),
      req.body.activa
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error('cambiarEstadoSucursal error:', error);
    return errorResponse(res, error);
  }
};

exports.listarUsuario = async (req, res) => {
  try {
    const data = await sucursalService.listarSucursalesUsuario(
      empresaId(req),
      usuarioId(req)
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error('listarSucursalesUsuario error:', error);
    return errorResponse(res, error);
  }
};

exports.actualizarUsuario = async (req, res) => {
  try {
    const data = await sucursalService.actualizarSucursalesUsuario(
      empresaId(req),
      usuarioId(req),
      req.body
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error('actualizarSucursalesUsuario error:', error);
    return errorResponse(res, error);
  }
};
