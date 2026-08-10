'use strict';

const cajaSesionModel = require('../models/cajaSesionModel');
const { parsePagination } = require('../utils/pagination');

function sesionHttpError(res, status, code, message) {
  return res.status(status).json({ success: false, code, message });
}

function resolveUserId(req) {
  return Number(req.user?.id ?? req.user?.userId ?? 0) || null;
}

function sucursalIdsFromScope(branchScope) {
  if (branchScope.mode === 'specific') return [Number(branchScope.sucursalId)];
  return (branchScope.allowedSucursalIds || []).map(Number).filter(Number.isInteger);
}

/**
 * GET /api/caja-sesiones/activa
 * Devuelve sesiones ABIERTA del contexto actual (specific → una sucursal; consolidated → todas permitidas).
 * Acepta ?caja_id=N para filtrar por caja.
 */
exports.getSesionActiva = async (req, res) => {
  try {
    const { empresaId } = req.branchScope;
    const sucursalIds   = sucursalIdsFromScope(req.branchScope);
    const usuarioId     = resolveUserId(req);
    const cajaId        = req.query.caja_id ? Number(req.query.caja_id) : undefined;

    if (!usuarioId) {
      return sesionHttpError(res, 401, 'USUARIO_REQUERIDO', 'No se pudo determinar el usuario');
    }

    if (!sucursalIds.length) {
      return sesionHttpError(res, 409, 'SIN_SUCURSALES', 'No hay sucursales disponibles en el contexto');
    }

    const rows = await cajaSesionModel.listarActivas({
      empresaId,
      sucursalIds,
      usuarioId,
      cajaId,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('cajaSesion.getSesionActiva:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener la sesión activa' });
  }
};

/**
 * GET /api/caja-sesiones/resumen-activa
 * Resumen financiero en tiempo real de la sesión propia
 * dentro de una sucursal específica.
 */
exports.getResumenActiva = async (req, res) => {
  try {
    const {
      empresaId,
      sucursalId,
    } = req.branchScope;

    const usuarioId =
      resolveUserId(req);

    if (!usuarioId) {
      return sesionHttpError(
        res,
        401,
        'USUARIO_REQUERIDO',
        'No se pudo determinar el usuario'
      );
    }

    const resumen =
      await cajaSesionModel.obtenerResumenActiva({
        empresaId,
        sucursalId:
          Number(sucursalId),
        usuarioId,
      });

    return res.json({
      success: true,
      data: resumen,
    });
  } catch (error) {
    console.error(
      'cajaSesion.getResumenActiva:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error al obtener el resumen operativo de caja',
    });
  }
};

/**
 * GET /api/caja-sesiones/sugerencia-apertura?caja_id=N
 * Devuelve el fondo que quedó físicamente en la caja en su último cierre.
 * Solo funciona en una sucursal específica.
 */
exports.getSugerenciaApertura = async (req, res) => {
  try {
    const { empresaId, sucursalId } = req.branchScope;
    const cajaId = Number(req.query.caja_id);

    if (!Number.isInteger(cajaId) || cajaId <= 0) {
      return sesionHttpError(
        res,
        400,
        'CAJA_REQUERIDA',
        'El parámetro caja_id es obligatorio'
      );
    }

    const sugerencia =
      await cajaSesionModel.obtenerSugerenciaApertura({
        empresaId,
        sucursalId: Number(sucursalId),
        cajaId,
      });

    if (!sugerencia) {
      return sesionHttpError(
        res,
        404,
        'CAJA_NO_ENCONTRADA',
        'La caja no existe, no está activa o no pertenece a esta sucursal'
      );
    }

    return res.json({
      success: true,
      data: sugerencia,
    });
  } catch (error) {
    console.error(
      'cajaSesion.getSugerenciaApertura:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error al obtener la sugerencia de apertura',
    });
  }
};

/**
 * POST /api/caja-sesiones/abrir
 * Abre una sesión para la caja indicada en la sucursal activa.
 * Requiere branchScope.mode === 'specific' (garantizado por requireBranchSpecific en la ruta).
 * Body: { caja_id: number, fondo_inicial_centavos?: number }
 */
exports.abrirSesion = async (req, res) => {
  try {
    const { empresaId, sucursalId } = req.branchScope;
    const cajaId        = req.body.caja_id ? Number(req.body.caja_id) : null;
    const fondoInicial  = req.body.fondo_inicial_centavos !== undefined
      ? Number(req.body.fondo_inicial_centavos) : 0;
    const usuarioId     = resolveUserId(req);

    if (!cajaId || !Number.isInteger(cajaId) || cajaId <= 0) {
      return sesionHttpError(res, 400, 'CAJA_REQUERIDA', 'El campo caja_id es obligatorio');
    }
    if (!Number.isInteger(fondoInicial) || fondoInicial < 0) {
      return sesionHttpError(res, 400, 'FONDO_INVALIDO', 'fondo_inicial_centavos debe ser un entero no negativo');
    }
    if (!usuarioId) {
      return sesionHttpError(res, 401, 'USUARIO_REQUERIDO', 'No se pudo determinar el usuario');
    }

    const sesion = await cajaSesionModel.crear({
      empresaId, sucursalId: Number(sucursalId), cajaId, usuarioId, fondoInicial, req,
    });

    if (!sesion) {
      return sesionHttpError(res, 404, 'CAJA_NO_ENCONTRADA', 'La caja no existe, no está activa o no pertenece a esta sucursal');
    }

    return res.status(201).json({ success: true, data: sesion });
  } catch (error) {
    if (error.statusCode && error.code) {
      return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
    }
    console.error('cajaSesion.abrirSesion:', error);
    return res.status(500).json({ success: false, message: 'Error al abrir la sesión de caja' });
  }
};

/**
 * POST /api/caja-sesiones/:id/cerrar
 * Cierra la sesión indicada. Valida que pertenezca a la sucursal activa.
 * Requiere branchScope.mode === 'specific'.
 * Body: { efectivo_contado_centavos: number, notas_cierre?: string }
 */
exports.cerrarSesion = async (req, res) => {
  try {
    const { empresaId, sucursalId } = req.branchScope;
    const sesionId        = Number(req.params.id);
    const efectivoContado = req.body.efectivo_contado_centavos !== undefined
      ? Number(req.body.efectivo_contado_centavos) : null;
    const notas           = req.body.notas_cierre ?? null;
    const tieneFondoSiguiente =
      req.body.fondo_siguiente_centavos !== undefined;

    const fondoSiguiente =
      tieneFondoSiguiente
        ? Number(req.body.fondo_siguiente_centavos)
        : null;

    const cerradoPor      = resolveUserId(req);

    if (!cerradoPor) {
      return sesionHttpError(res, 401, 'USUARIO_REQUERIDO', 'No se pudo determinar el usuario');
    }

    if (!Number.isInteger(sesionId) || sesionId <= 0) {
      return sesionHttpError(res, 400, 'SESION_ID_INVALIDO', 'ID de sesión inválido');
    }
    if (efectivoContado === null || !Number.isInteger(efectivoContado) || efectivoContado < 0) {
      return sesionHttpError(res, 400, 'CONTEO_INVALIDO', 'efectivo_contado_centavos debe ser un entero no negativo');
    }

    if (!tieneFondoSiguiente) {
      return sesionHttpError(
        res,
        400,
        'FONDO_SIGUIENTE_REQUERIDO',
        'Debes indicar cuánto efectivo quedará en caja para el próximo turno'
      );
    }

    if (!Number.isInteger(fondoSiguiente) || fondoSiguiente < 0) {
      return sesionHttpError(
        res,
        400,
        'FONDO_SIGUIENTE_INVALIDO',
        'fondo_siguiente_centavos debe ser un entero no negativo'
      );
    }

    if (fondoSiguiente > efectivoContado) {
      return sesionHttpError(
        res,
        400,
        'FONDO_SIGUIENTE_SUPERA_CONTADO',
        'El fondo para el siguiente turno no puede superar el efectivo contado'
      );
    }

    const result = await cajaSesionModel.cerrar({
      sesionId,
      empresaId,
      sucursalId: Number(sucursalId),
      usuarioId: cerradoPor,
      efectivoContado,
      fondoSiguiente,
      cerradoPor,
      notas,
      req,
    });

    if (!result) {
      return sesionHttpError(res, 404, 'SESION_NO_ENCONTRADA', 'Sesión no encontrada, ya cerrada, no pertenece a esta sucursal o no fue abierta por este usuario');
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.statusCode && error.code) {
      return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
    }
    console.error('cajaSesion.cerrarSesion:', error);
    return res.status(500).json({ success: false, message: 'Error al cerrar la sesión de caja' });
  }
};

/**
 * GET /api/caja-sesiones/:id/detalle
 * Devuelve el detalle cronológico de movimientos de efectivo
 * pertenecientes a una sesión autorizada.
 */
exports.getDetalle = async (req, res) => {
  try {
    const { empresaId } =
      req.branchScope;

    const sucursalIds =
      sucursalIdsFromScope(
        req.branchScope
      );

    const sesionId =
      Number(req.params.id);

    if (
      !Number.isInteger(sesionId) ||
      sesionId <= 0
    ) {
      return sesionHttpError(
        res,
        400,
        'SESION_ID_INVALIDO',
        'ID de sesión inválido'
      );
    }

    if (!sucursalIds.length) {
      return sesionHttpError(
        res,
        409,
        'SIN_SUCURSALES',
        'No hay sucursales disponibles en el contexto'
      );
    }

    const detalle =
      await cajaSesionModel.obtenerDetalle({
        empresaId,
        sucursalIds,
        sesionId,
      });

    if (!detalle) {
      return sesionHttpError(
        res,
        404,
        'SESION_NO_ENCONTRADA',
        'La sesión no existe o no pertenece al contexto autorizado'
      );
    }

    return res.json({
      success: true,
      data: detalle,
    });
  } catch (error) {
    console.error(
      'cajaSesion.getDetalle:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error al obtener el detalle de la sesión de caja',
    });
  }
};

/**
 * GET /api/caja-sesiones/historial
 * Historial paginado de sesiones. Soporta modo specific y consolidated.
 * Query: ?caja_id=N &page=1 &limit=20
 */
exports.getHistorial = async (req, res) => {
  try {
    const { empresaId } = req.branchScope;
    const sucursalIds   = sucursalIdsFromScope(req.branchScope);
    const cajaId        = req.query.caja_id ? Number(req.query.caja_id) : undefined;
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

    if (!sucursalIds.length) {
      return sesionHttpError(res, 409, 'SIN_SUCURSALES', 'No hay sucursales disponibles en el contexto');
    }

    const rows = await cajaSesionModel.listar({ empresaId, sucursalIds, cajaId, limit, offset });
    return res.json({ success: true, data: rows, pagination: { page, limit } });
  } catch (error) {
    console.error('cajaSesion.getHistorial:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener el historial de sesiones' });
  }
};
