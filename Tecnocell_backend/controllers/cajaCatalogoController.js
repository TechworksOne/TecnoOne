const Caja = require('../models/cajaModel');

const clean = value => value == null ? '' : String(value).trim();
const isSuperAdmin = req => Boolean(req.user?.esSuperAdmin || req.user?.es_super_admin);

function scope(req, { bodySucursal = false } = {}) {
  if (isSuperAdmin(req)) {
    return {
      empresaId: Number(req.params.empresaId || req.params.id),
      sucursalId: Number(bodySucursal ? req.body?.sucursal_id : (req.query?.sucursal_id || req.body?.sucursal_id)) || null,
    };
  }
  return {
    empresaId: Number(req.branchScope?.empresaId),
    sucursalId: req.branchScope?.sucursalId == null
      ? null
      : Number(req.branchScope.sucursalId),
    allowedSucursalIds: req.branchScope?.allowedSucursalIds || [],
    mode: req.branchScope?.mode,
  };
}

function payload(req) {
  return {
    nombre: clean(req.body?.nombre),
    codigo: clean(req.body?.codigo).toUpperCase(),
    descripcion: clean(req.body?.descripcion) || null,
  };
}

function fail(res, status, code, message) {
  return res.status(status).json({ success: false, code, message });
}

function handle(error, res) {
  if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'DUPLICATE_CASH_REGISTER_CODE', 'Ya existe una caja con ese codigo en la sucursal');
  console.error('catalogo cajas error:', error);
  return fail(res, 500, 'CASH_REGISTER_ERROR', 'Error administrando cajas');
}

function requireSpecific(selected, res) {
  if (selected.mode === 'consolidated') {
    fail(
      res,
      409,
      'BRANCH_SPECIFIC_REQUIRED',
      'Seleccione una sucursal especifica para realizar esta operacion'
    );
    return false;
  }
  return true;
}

exports.listar = async (req, res) => {
  try {
    const selected = scope(req);
    if (!selected.empresaId) return fail(res, 400, 'COMPANY_REQUIRED', 'Empresa invalida');
    return res.json({ success: true, data: await Caja.listar(selected) });
  } catch (error) { return handle(error, res); }
};

exports.crear = async (req, res) => {
  try {
    const selected = scope(req, { bodySucursal: true });
    const data = payload(req);
    if (!isSuperAdmin(req) && !requireSpecific(selected, res)) return;
    if (!selected.empresaId || !selected.sucursalId) return fail(res, 400, 'BRANCH_REQUIRED', 'Sucursal requerida');
    if (!data.nombre || !data.codigo) return fail(res, 400, 'INVALID_CASH_REGISTER', 'Nombre y codigo son obligatorios');
    if (!await Caja.sucursalPertenece(selected.empresaId, selected.sucursalId)) {
      return fail(res, 403, 'BRANCH_COMPANY_MISMATCH', 'La sucursal no pertenece a la empresa');
    }
    return res.status(201).json({ success: true, data: await Caja.crear({ ...selected, ...data }) });
  } catch (error) { return handle(error, res); }
};

exports.editar = async (req, res) => {
  try {
    const selected = scope(req);
    const data = payload(req);
    if (!isSuperAdmin(req) && !requireSpecific(selected, res)) return;
    if (!data.nombre || !data.codigo) return fail(res, 400, 'INVALID_CASH_REGISTER', 'Nombre y codigo son obligatorios');
    const result = await Caja.editar({ id: Number(req.params.cajaId), ...selected, ...data });
    if (!result) return fail(res, 404, 'CASH_REGISTER_NOT_FOUND', 'Caja no encontrada en el contexto permitido');
    return res.json({ success: true, data: result });
  } catch (error) { return handle(error, res); }
};

exports.cambiarEstado = async (req, res) => {
  try {
    if (typeof req.body?.activa !== 'boolean') return fail(res, 400, 'INVALID_STATE', 'activa debe ser booleano');
    const selected = scope(req);
    if (!isSuperAdmin(req) && !requireSpecific(selected, res)) return;
    const result = await Caja.cambiarEstado({ id: Number(req.params.cajaId), activa: req.body.activa, ...selected });
    if (!result) return fail(res, 404, 'CASH_REGISTER_NOT_FOUND', 'Caja no encontrada en el contexto permitido');
    return res.json({ success: true, data: result });
  } catch (error) { return handle(error, res); }
};

exports.eliminar = async (req, res) => {
  try {
    const selected = scope(req);
    if (!isSuperAdmin(req) && !requireSpecific(selected, res)) return;
    const removed = await Caja.eliminar({ id: Number(req.params.cajaId), ...selected });
    if (!removed) return fail(res, 404, 'CASH_REGISTER_NOT_FOUND', 'Caja no encontrada en el contexto permitido');
    return res.json({ success: true, message: 'Caja eliminada' });
  } catch (error) { return handle(error, res); }
};

