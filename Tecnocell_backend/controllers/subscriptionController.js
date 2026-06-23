const db = require('../config/database');
const subscriptionAccess = require('../services/subscriptionAccessService');
const superAdminAudit = require('../services/superAdminAuditService');

const TIPOS = new Set(['prueba', 'comercial']);
const MESES_PERMITIDOS = new Set([1, 3, 6, 12]);

function text(value, max = 255) {
  if (value === undefined || value === null) return null;
  const clean = String(value).trim();
  return clean ? clean.slice(0, max) : null;
}

function serialize(value) {
  return value == null ? null : JSON.stringify(value);
}

function decorate(suscripcion, empresa = null) {
  const estado = subscriptionAccess.calcularEstadoSuscripcion(suscripcion);
  const diasRestantes = subscriptionAccess.calcularDiasRestantes(suscripcion);
  return {
    ...suscripcion,
    fecha_inicio: subscriptionAccess.toDateString(suscripcion.fecha_inicio),
    fecha_vencimiento: subscriptionAccess.toDateString(suscripcion.fecha_vencimiento),
    fecha_fin_gracia: subscriptionAccess.toDateString(suscripcion.fecha_fin_gracia),
    dias_gracia: Number(suscripcion.dias_gracia || 0),
    duracion_meses: suscripcion.duracion_meses == null ? null : Number(suscripcion.duracion_meses),
    proxima_a_vencer_dias: Number(suscripcion.proxima_a_vencer_dias ?? 7),
    estado,
    dias_restantes: diasRestantes,
    proxima_a_vencer:
      diasRestantes !== null &&
      diasRestantes >= 0 &&
      diasRestantes <= Number(suscripcion.proxima_a_vencer_dias ?? 7),
    estado_empresa: empresa?.estado,
  };
}

async function insertHistory(connection, {
  suscripcion,
  empresaId,
  tipoEvento,
  previous,
  next,
  previousEmpresa,
  nextEmpresa,
  meses = null,
  motivo = null,
  superAdminId = null,
  origen = 'super_admin',
}) {
  await connection.query(
    `INSERT INTO historial_suscripciones (
       suscripcion_id, empresa_id, tipo_evento,
       estado_empresa_anterior, estado_empresa_nuevo,
       estado_suscripcion_anterior, estado_suscripcion_nuevo,
       fecha_inicio_anterior, fecha_inicio_nueva,
       fecha_vencimiento_anterior, fecha_vencimiento_nueva,
       dias_gracia_anterior, dias_gracia_nuevo,
       meses_renovados, motivo, super_admin_id, origen,
       datos_anteriores, datos_nuevos
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      suscripcion.id,
      empresaId,
      tipoEvento,
      previousEmpresa,
      nextEmpresa,
      previous?.estado || null,
      next?.estado || null,
      previous?.fecha_inicio || null,
      next?.fecha_inicio || null,
      previous?.fecha_vencimiento || null,
      next?.fecha_vencimiento || null,
      previous?.dias_gracia ?? null,
      next?.dias_gracia ?? null,
      meses,
      motivo,
      superAdminId,
      origen,
      serialize(previous),
      serialize(next),
    ]
  );
}

async function getLocked(connection, empresaId) {
  const [[empresa]] = await connection.query(
    'SELECT id, estado, plan, fecha_inicio, fecha_vencimiento FROM empresas WHERE id = ? FOR UPDATE',
    [empresaId]
  );
  if (!empresa) return { empresa: null, suscripcion: null };
  const [[suscripcion]] = await connection.query(
    'SELECT * FROM suscripciones WHERE empresa_id = ? FOR UPDATE',
    [empresaId]
  );
  return { empresa, suscripcion: suscripcion || null };
}

exports.getSuscripcion = async (req, res) => {
  try {
    const contexto = await subscriptionAccess.evaluarAccesoEmpresa(req.params.id);
    if (!contexto.empresa) {
      return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
    }
    if (!contexto.suscripcion) {
      return res.status(404).json({ success: false, message: 'Suscripción no encontrada' });
    }
    return res.json({ success: true, data: decorate(contexto.suscripcion, contexto.empresa) });
  } catch (error) {
    console.error('getSuscripcion error:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener la suscripción' });
  }
};

exports.getHistorial = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const [rows] = await db.query(
      `SELECT h.*, u.username AS super_admin_username
       FROM historial_suscripciones h
       LEFT JOIN users u ON u.id = h.super_admin_id
       WHERE h.empresa_id = ?
       ORDER BY h.created_at DESC, h.id DESC
       LIMIT ?`,
      [req.params.id, limit]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getHistorialSuscripcion error:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener el historial' });
  }
};

exports.updateSuscripcion = async (req, res) => {
  let connection;
  try {
    const tipo = req.body?.tipo === undefined ? undefined : text(req.body.tipo, 20)?.toLowerCase();
    const plan = req.body?.plan === undefined ? undefined : text(req.body.plan, 50);
    const fechaInicio = req.body?.fecha_inicio === undefined
      ? undefined
      : text(req.body.fecha_inicio, 10);
    const fechaVencimiento = req.body?.fecha_vencimiento === undefined
      ? undefined
      : text(req.body.fecha_vencimiento, 10);
    const diasGracia = req.body?.dias_gracia === undefined
      ? undefined
      : Number(req.body.dias_gracia);
    const motivo = text(req.body?.motivo, 500);

    if (tipo !== undefined && !TIPOS.has(tipo)) {
      return res.status(400).json({ success: false, message: 'Tipo de suscripción no válido' });
    }
    if (fechaInicio !== undefined && !subscriptionAccess.isValidDate(fechaInicio, { nullable: false })) {
      return res.status(400).json({ success: false, message: 'fecha_inicio no es una fecha válida' });
    }
    if (fechaVencimiento !== undefined && !subscriptionAccess.isValidDate(fechaVencimiento)) {
      return res.status(400).json({ success: false, message: 'fecha_vencimiento no es una fecha válida' });
    }
    if (diasGracia !== undefined && (!Number.isInteger(diasGracia) || diasGracia < 0)) {
      return res.status(400).json({ success: false, message: 'dias_gracia debe ser un entero mayor o igual a cero' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const { empresa, suscripcion } = await getLocked(connection, req.params.id);
    if (!empresa || !suscripcion) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Empresa o suscripción no encontrada' });
    }

    const previous = decorate(suscripcion, empresa);
    const next = {
      ...previous,
      tipo: tipo ?? previous.tipo,
      plan: plan ?? previous.plan,
      fecha_inicio: fechaInicio ?? previous.fecha_inicio,
      fecha_vencimiento: fechaVencimiento === undefined ? previous.fecha_vencimiento : fechaVencimiento,
      dias_gracia: diasGracia ?? previous.dias_gracia,
    };
    if (
      next.fecha_vencimiento &&
      subscriptionAccess.diffDays(next.fecha_inicio, next.fecha_vencimiento) < 0
    ) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'fecha_inicio no puede ser posterior a fecha_vencimiento' });
    }
    next.fecha_fin_gracia = subscriptionAccess.calcularFechaFinGracia(
      next.fecha_vencimiento,
      next.dias_gracia
    );
    next.estado = subscriptionAccess.calcularEstadoSuscripcion(next);

    await connection.query(
      `UPDATE suscripciones
       SET plan = ?, tipo = ?, estado = ?, fecha_inicio = ?,
           fecha_vencimiento = ?, dias_gracia = ?, fecha_fin_gracia = ?
       WHERE id = ?`,
      [
        next.plan,
        next.tipo,
        next.estado,
        next.fecha_inicio,
        next.fecha_vencimiento,
        next.dias_gracia,
        next.fecha_fin_gracia,
        suscripcion.id,
      ]
    );
    await connection.query(
      `UPDATE empresas
       SET plan = ?, fecha_inicio = ?, fecha_vencimiento = ?
       WHERE id = ?`,
      [next.plan, next.fecha_inicio, next.fecha_vencimiento, empresa.id]
    );
    await insertHistory(connection, {
      suscripcion,
      empresaId: empresa.id,
      tipoEvento: 'ACTUALIZACION',
      previous,
      next,
      previousEmpresa: empresa.estado,
      nextEmpresa: empresa.estado,
      motivo,
      superAdminId: req.superAdmin.id,
    });
    await connection.commit();

    await superAdminAudit.registrar({
      req,
      accion: 'ACTUALIZAR_SUSCRIPCION',
      entidad: 'SUSCRIPCION',
      entidadId: suscripcion.id,
      datosAnteriores: previous,
      datosNuevos: next,
    });
    return res.json({ success: true, data: decorate(next, empresa) });
  } catch (error) {
    if (connection) try { await connection.rollback(); } catch (_) {}
    console.error('updateSuscripcion error:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar la suscripción' });
  } finally {
    if (connection) connection.release();
  }
};

async function renovarSuscripcionTransaccional(connection, {
  empresaId,
  meses,
  diasGracia,
  motivo,
  plan,
  superAdminId,
  hoy = subscriptionAccess.todayString(),
}) {
  const locked = await getLocked(connection, empresaId);
  const { empresa, suscripcion } = locked;
  if (!empresa || !suscripcion) {
    const error = new Error('Empresa o suscripción no encontrada');
    error.status = 404;
    throw error;
  }

  const previous = decorate(suscripcion, empresa);
  const estadoAnterior = subscriptionAccess.calcularEstadoSuscripcion(previous, hoy);
  const vencimientoActual = previous.fecha_vencimiento;
  const puedeExtender =
    vencimientoActual &&
    ['vigente', 'prueba'].includes(estadoAnterior) &&
    subscriptionAccess.diffDays(hoy, vencimientoActual) >= 0;
  const base = puedeExtender ? vencimientoActual : hoy;
  const nuevoVencimiento = subscriptionAccess.addMonths(base, meses);
  const nuevaFechaInicio = previous.fecha_inicio || hoy;
  const next = {
    ...previous,
    plan: plan || previous.plan,
    tipo: 'comercial',
    estado: 'vigente',
    fecha_inicio: nuevaFechaInicio,
    fecha_vencimiento: nuevoVencimiento,
    dias_gracia: diasGracia,
    fecha_fin_gracia: subscriptionAccess.calcularFechaFinGracia(nuevoVencimiento, diasGracia),
    duracion_meses: meses,
  };

  let nuevoEstadoEmpresa = empresa.estado;
  if (
    String(empresa.estado).toLowerCase() === 'suspendida' &&
    estadoAnterior === 'vencida'
  ) {
    nuevoEstadoEmpresa = 'activa';
  }

  await connection.query(
    `UPDATE suscripciones
     SET plan = ?, tipo = 'comercial', estado = 'vigente',
         fecha_inicio = ?, fecha_vencimiento = ?, dias_gracia = ?,
         fecha_fin_gracia = ?, duracion_meses = ?
     WHERE id = ?`,
    [
      next.plan,
      next.fecha_inicio,
      next.fecha_vencimiento,
      next.dias_gracia,
      next.fecha_fin_gracia,
      meses,
      suscripcion.id,
    ]
  );
  await connection.query(
    `UPDATE empresas
     SET estado = ?, plan = ?, fecha_inicio = ?, fecha_vencimiento = ?
     WHERE id = ?`,
    [
      nuevoEstadoEmpresa,
      next.plan,
      next.fecha_inicio,
      next.fecha_vencimiento,
      empresa.id,
    ]
  );
  await insertHistory(connection, {
    suscripcion,
    empresaId: empresa.id,
    tipoEvento: 'RENOVACION',
    previous,
    next,
    previousEmpresa: empresa.estado,
    nextEmpresa: nuevoEstadoEmpresa,
    meses,
    motivo,
    superAdminId,
  });

  return {
    empresa,
    suscripcion,
    previous,
    next,
    estado_empresa: nuevoEstadoEmpresa,
    requiere_reactivacion_explicita:
      String(empresa.estado).toLowerCase() === 'cancelada',
  };
}

exports.renovarSuscripcionTransaccional = renovarSuscripcionTransaccional;

exports.renovarSuscripcion = async (req, res) => {
  let connection;
  try {
    const meses = Number(req.body?.meses);
    const diasGracia = req.body?.dias_gracia === undefined
      ? 0
      : Number(req.body.dias_gracia);
    const motivo = text(req.body?.motivo, 500);
    const plan = text(req.body?.plan, 50);

    if (!MESES_PERMITIDOS.has(meses)) {
      return res.status(400).json({ success: false, message: 'meses debe ser 1, 3, 6 o 12' });
    }
    if (!Number.isInteger(diasGracia) || diasGracia < 0) {
      return res.status(400).json({ success: false, message: 'dias_gracia debe ser un entero mayor o igual a cero' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const result = await renovarSuscripcionTransaccional(connection, {
      empresaId: req.params.id,
      meses,
      diasGracia,
      motivo,
      plan,
      superAdminId: req.superAdmin.id,
    });
    await connection.commit();

    await superAdminAudit.registrar({
      req,
      accion: 'RENOVAR_SUSCRIPCION',
      entidad: 'SUSCRIPCION',
      entidadId: result.suscripcion.id,
      datosAnteriores: result.previous,
      datosNuevos: result.next,
    });
    return res.json({
      success: true,
      data: {
        ...decorate(result.next, { estado: result.estado_empresa }),
        requiere_reactivacion_explicita: result.requiere_reactivacion_explicita,
      },
    });
  } catch (error) {
    if (connection) try { await connection.rollback(); } catch (_) {}
    console.error('renovarSuscripcion error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error al renovar la suscripción',
    });
  } finally {
    if (connection) connection.release();
  }
};
