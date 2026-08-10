const sucursalService = require('../services/sucursalService');
const auditoriaService = require('../services/auditoriaService');

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
    await auditoriaService.registrar({
      req, empresaId: empresaId(req), scope: 'company', accion: 'SUCURSAL_CREADA',
      entidad: 'SUCURSAL', entidadId: data.id, descripcion: `Sucursal ${data.nombre} creada`,
      datosNuevos: data, metadata: { sucursal_afectada_id: Number(data.id) },
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('crearSucursal error:', error);
    return errorResponse(res, error);
  }
};

exports.editar = async (req, res) => {
  try {
    const anteriores = await sucursalService.listarSucursales(empresaId(req));
    const anterior = anteriores.find(item => Number(item.id) === Number(sucursalId(req))) || null;
    const data = await sucursalService.editarSucursal(
      empresaId(req),
      sucursalId(req),
      req.body
    );
    await auditoriaService.registrar({
      req, empresaId: empresaId(req), scope: 'company', accion: 'SUCURSAL_EDITADA',
      entidad: 'SUCURSAL', entidadId: data.id, descripcion: `Sucursal ${data.id} editada`,
      datosAnteriores: anterior, datosNuevos: data, metadata: { sucursal_afectada_id: Number(data.id) },
    });
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
    await auditoriaService.registrar({
      req, empresaId: empresaId(req), scope: 'company', accion: 'SUCURSAL_ESTADO_CAMBIADO',
      entidad: 'SUCURSAL', entidadId: sucursalId(req), descripcion: `Estado de sucursal ${sucursalId(req)} actualizado`,
      datosNuevos: { activa: Boolean(req.body.activa) }, metadata: { sucursal_afectada_id: Number(sucursalId(req)) },
    });
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
    const before = await sucursalService.listarSucursalesUsuario(empresaId(req), usuarioId(req));
    const data = await sucursalService.actualizarSucursalesUsuario(
      empresaId(req),
      usuarioId(req),
      req.body
    );
    const beforeIds = before.map(item => Number(item.id));
    const afterIds = (data.sucursales || data).map(item => Number(item.id));
    const asignadas = afterIds.filter(id => !beforeIds.includes(id));
    const retiradas = beforeIds.filter(id => !afterIds.includes(id));
    const defaultAnterior = before.find(item => item.es_predeterminada)?.id || null;
    const defaultNuevo = (data.sucursales || data).find(item => item.es_predeterminada)?.id || null;
    const eventos = [
      asignadas.length && ['USUARIO_SUCURSAL_ASIGNADA', { sucursal_ids: asignadas }],
      retiradas.length && ['USUARIO_SUCURSAL_RETIRADA', { sucursal_ids: retiradas }],
      Number(defaultAnterior) !== Number(defaultNuevo) && ['USUARIO_SUCURSAL_DEFAULT_CAMBIADA', { anterior: defaultAnterior, nueva: defaultNuevo }],
    ].filter(Boolean);
    for (const [accion, cambio] of eventos) {
      await auditoriaService.registrar({
        req, empresaId: empresaId(req), scope: 'company', accion, entidad: 'USUARIO', entidadId: usuarioId(req),
        descripcion: `Asignación de sucursales del usuario ${usuarioId(req)} actualizada`,
        datosAnteriores: { sucursal_ids: beforeIds, predeterminada_id: defaultAnterior },
        datosNuevos: { sucursal_ids: afterIds, predeterminada_id: defaultNuevo }, metadata: cambio,
      });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error('actualizarSucursalesUsuario error:', error);
    return errorResponse(res, error);
  }
};
