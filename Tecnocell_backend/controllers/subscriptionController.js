const db = require('../config/database');
const subscriptionAccess = require('../services/subscriptionAccessService');
const superAdminAudit = require('../services/superAdminAuditService');
const planAccess = require('../services/planAccessService');
const lifecycle = require('../services/subscriptionLifecycleService');

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


function positiveId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function planChangeError(
  message,
  {
    status = 400,
    code = null,
    resource = null,
    used = null,
    limit = null,
  } = {}
) {
  const error = new Error(message);

  error.status = status;
  error.code = code;
  error.resource = resource;
  error.used = used;
  error.limit = limit;

  return error;
}

async function cambiarPlanInmediatoTransaccional(
  connection,
  {
    empresaId,
    planId,
    motivo = null,
    superAdminId = null,
  }
) {
  const normalizedEmpresaId =
    positiveId(empresaId);

  const normalizedPlanId =
    positiveId(planId);

  if (!normalizedEmpresaId) {
    throw planChangeError(
      'Empresa no válida',
      {
        status: 400,
        code: 'INVALID_EMPRESA_ID',
      }
    );
  }

  if (!normalizedPlanId) {
    throw planChangeError(
      'Plan no válido',
      {
        status: 400,
        code: 'INVALID_PLAN_ID',
      }
    );
  }

  const {
    empresa,
    suscripcion,
  } = await getLocked(
    connection,
    normalizedEmpresaId
  );

  if (!empresa || !suscripcion) {
    throw planChangeError(
      'Empresa o suscripción no encontrada',
      {
        status: 404,
        code: 'SUBSCRIPTION_NOT_FOUND',
      }
    );
  }

  const plan =
    await planAccess.obtenerPlanPorId(
      normalizedPlanId,
      connection
    );

  if (!plan) {
    throw planChangeError(
      'Plan no encontrado',
      {
        status: 404,
        code: 'PLAN_NOT_FOUND',
      }
    );
  }

  if (!plan.activo) {
    throw planChangeError(
      'El plan está inactivo',
      {
        status: 409,
        code: 'PLAN_INACTIVE',
      }
    );
  }

  if (!plan.asignable) {
    throw planChangeError(
      'El plan no está habilitado para asignación',
      {
        status: 409,
        code: 'PLAN_NOT_ASSIGNABLE',
      }
    );
  }

  const [activeUsers] =
    await connection.query(
      `SELECT id
       FROM users
       WHERE empresa_id = ?
         AND active = 1
         AND COALESCE(
           tipo_usuario,
           'EMPRESA'
         ) = 'EMPRESA'
         AND COALESCE(
           es_super_admin,
           0
         ) = 0
       FOR UPDATE`,
      [normalizedEmpresaId]
    );

  const used = activeUsers.length;

  if (
    plan.max_usuarios !== null &&
    used > plan.max_usuarios
  ) {
    throw planChangeError(
      'La empresa excede el límite de usuarios activos del plan seleccionado.',
      {
        status: 409,
        code: 'PLAN_LIMIT_CONFLICT',
        resource: 'usuarios',
        used,
        limit: plan.max_usuarios,
      }
    );
  }

  const previous = decorate(
    suscripcion,
    empresa
  );

  const next = {
    ...previous,
    plan: plan.codigo,
    plan_id: plan.id,
    plan_programado_id: null,
    cambio_plan_efectivo_en: null,
  };

  await connection.query(
    `UPDATE suscripciones
     SET plan = ?,
         plan_id = ?,
         plan_programado_id = NULL,
         cambio_plan_efectivo_en = NULL
     WHERE id = ?`,
    [
      plan.codigo,
      plan.id,
      suscripcion.id,
    ]
  );

  await connection.query(
    `UPDATE empresas
     SET plan = ?
     WHERE id = ?`,
    [
      plan.codigo,
      empresa.id,
    ]
  );

  await insertHistory(
    connection,
    {
      suscripcion,
      empresaId: empresa.id,
      tipoEvento:
        'CAMBIO_PLAN_INMEDIATO',
      previous,
      next,
      previousEmpresa:
        empresa.estado,
      nextEmpresa:
        empresa.estado,
      motivo,
      superAdminId,
    }
  );

  const modulos =
    await planAccess.obtenerModulosPlan(
      plan.id,
      connection
    );

  return {
    empresa,
    suscripcion,
    previous,
    next,
    plan,
    modulos,
    consumo: {
      usuarios_activos: used,
      usuarios_limite:
        plan.max_usuarios,
      usuarios_disponibles:
        plan.max_usuarios === null
          ? null
          : Math.max(
              0,
              plan.max_usuarios - used
            ),
    },
  };
}

exports.cambiarPlanInmediatoTransaccional =
  cambiarPlanInmediatoTransaccional;

exports.getSuscripcion = async (req, res) => {
  try {
    const contexto = await subscriptionAccess.evaluarAccesoEmpresa(req.params.id);
    if (!contexto.empresa) {
      return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
    }
    if (!contexto.suscripcion) {
      return res.status(404).json({ success: false, message: 'Suscripción no encontrada' });
    }
    const resumen =
        await planAccess.obtenerResumenPlanEmpresa(
          req.params.id
        );

      const data = decorate(
        contexto.suscripcion,
        contexto.empresa
      );

      return res.json({
        success: true,
        data: {
          ...data,
          plan_id:
            resumen?.plan?.id ??
            data.plan_id ??
            null,
          plan_detalle:
            resumen?.plan ?? null,
          plan_programado:
            resumen?.plan_programado ??
            null,
          modulos_habilitados:
            resumen?.modulos_habilitados ??
            [],
          consumo:
            resumen?.consumo ?? null,
        },
      });
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

    let planCatalogo = null;
    if (plan !== undefined) {
      planCatalogo = await planAccess.obtenerPlanPorCodigo(plan, connection);
      if (!planCatalogo || !planCatalogo.activo || !planCatalogo.asignable) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          code: 'PLAN_NOT_ASSIGNABLE',
          message: 'El plan no existe o no está disponible para asignación',
        });
      }
    }

    const previous = decorate(suscripcion, empresa);
    const next = {
      ...previous,
      tipo: tipo ?? previous.tipo,
      plan: planCatalogo?.codigo ?? previous.plan,
      plan_id: planCatalogo?.id ?? previous.plan_id,
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
       SET plan = ?, plan_id = ?, tipo = ?, estado = ?, fecha_inicio = ?,
           fecha_vencimiento = ?, dias_gracia = ?, fecha_fin_gracia = ?
       WHERE id = ?`,
      [
        next.plan,
        next.plan_id,
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



async function programarCambioPlanTransaccional(
  connection,
  {
    empresaId,
    planId,
    fechaEfectiva = null,
    motivo = null,
    superAdminId = null,
  }
) {
  const normalizedEmpresaId =
    positiveId(empresaId);

  const normalizedPlanId =
    positiveId(planId);

  if (!normalizedEmpresaId) {
    throw planChangeError(
      'Empresa no válida',
      {
        status: 400,
        code: 'INVALID_EMPRESA_ID',
      }
    );
  }

  if (!normalizedPlanId) {
    throw planChangeError(
      'Plan no válido',
      {
        status: 400,
        code: 'INVALID_PLAN_ID',
      }
    );
  }

  const {
    empresa,
    suscripcion,
  } = await getLocked(
    connection,
    normalizedEmpresaId
  );

  if (!empresa || !suscripcion) {
    throw planChangeError(
      'Empresa o suscripción no encontrada',
      {
        status: 404,
        code: 'SUBSCRIPTION_NOT_FOUND',
      }
    );
  }

  const plan =
    await planAccess.obtenerPlanPorId(
      normalizedPlanId,
      connection
    );

  if (!plan) {
    throw planChangeError(
      'Plan no encontrado',
      {
        status: 404,
        code: 'PLAN_NOT_FOUND',
      }
    );
  }

  if (
    Number(suscripcion.plan_id) ===
    Number(plan.id)
  ) {
    throw planChangeError(
      'El plan seleccionado ya es el plan activo',
      {
        status: 409,
        code: 'PLAN_ALREADY_ACTIVE',
      }
    );
  }

  if (!plan.activo) {
    throw planChangeError(
      'El plan está inactivo',
      {
        status: 409,
        code: 'PLAN_INACTIVE',
      }
    );
  }

  if (!plan.asignable) {
    throw planChangeError(
      'El plan no está habilitado para asignación',
      {
        status: 409,
        code: 'PLAN_NOT_ASSIGNABLE',
      }
    );
  }

  const effectiveDate =
    fechaEfectiva ||
    subscriptionAccess.toDateString(
      suscripcion.fecha_vencimiento
    );

  if (!effectiveDate) {
    throw planChangeError(
      'Debe indicar la fecha efectiva del cambio',
      {
        status: 400,
        code: 'PLAN_EFFECTIVE_DATE_REQUIRED',
      }
    );
  }

  if (
    !subscriptionAccess.isValidDate(
      effectiveDate,
      {
        nullable: false,
      }
    )
  ) {
    throw planChangeError(
      'La fecha efectiva no es válida',
      {
        status: 400,
        code: 'INVALID_EFFECTIVE_DATE',
      }
    );
  }

  const today =
    subscriptionAccess.todayString();

  if (effectiveDate <= today) {
    throw planChangeError(
      'La fecha efectiva debe ser posterior a hoy',
      {
        status: 400,
        code: 'INVALID_EFFECTIVE_DATE',
      }
    );
  }

  const [activeUsers] =
    await connection.query(
      `SELECT id
       FROM users
       WHERE empresa_id = ?
         AND active = 1
         AND COALESCE(
           tipo_usuario,
           'EMPRESA'
         ) = 'EMPRESA'
         AND COALESCE(
           es_super_admin,
           0
         ) = 0
       FOR UPDATE`,
      [normalizedEmpresaId]
    );

  const used = activeUsers.length;

  if (
    plan.max_usuarios !== null &&
    used > plan.max_usuarios
  ) {
    throw planChangeError(
      'La empresa excede el límite de usuarios activos del plan seleccionado.',
      {
        status: 409,
        code: 'PLAN_LIMIT_CONFLICT',
        resource: 'usuarios',
        used,
        limit: plan.max_usuarios,
      }
    );
  }

  const previous = decorate(
    suscripcion,
    empresa
  );

  const next = {
    ...previous,
    plan_programado_id:
      plan.id,
    cambio_plan_efectivo_en:
      effectiveDate,
    plan_programado:
      plan,
  };

  await connection.query(
    `UPDATE suscripciones
     SET plan_programado_id = ?,
         cambio_plan_efectivo_en = ?
     WHERE id = ?`,
    [
      plan.id,
      effectiveDate,
      suscripcion.id,
    ]
  );

  await insertHistory(
    connection,
    {
      suscripcion,
      empresaId:
        empresa.id,
      tipoEvento:
        'PROGRAMACION_CAMBIO_PLAN',
      previous,
      next,
      previousEmpresa:
        empresa.estado,
      nextEmpresa:
        empresa.estado,
      motivo,
      superAdminId,
    }
  );

  return {
    empresa,
    suscripcion,
    previous,
    next,
    planProgramado:
      plan,
    fechaEfectiva:
      effectiveDate,
    consumo: {
      usuarios_activos:
        used,
      usuarios_limite:
        plan.max_usuarios,
      usuarios_disponibles:
        plan.max_usuarios === null
          ? null
          : Math.max(
              0,
              plan.max_usuarios - used
            ),
    },
  };
}

async function cancelarCambioPlanProgramadoTransaccional(
  connection,
  {
    empresaId,
    motivo = null,
    superAdminId = null,
  }
) {
  const normalizedEmpresaId =
    positiveId(empresaId);

  if (!normalizedEmpresaId) {
    throw planChangeError(
      'Empresa no válida',
      {
        status: 400,
        code: 'INVALID_EMPRESA_ID',
      }
    );
  }

  const {
    empresa,
    suscripcion,
  } = await getLocked(
    connection,
    normalizedEmpresaId
  );

  if (!empresa || !suscripcion) {
    throw planChangeError(
      'Empresa o suscripción no encontrada',
      {
        status: 404,
        code: 'SUBSCRIPTION_NOT_FOUND',
      }
    );
  }

  if (!suscripcion.plan_programado_id) {
    throw planChangeError(
      'La suscripción no tiene un cambio de plan programado',
      {
        status: 409,
        code: 'NO_SCHEDULED_PLAN_CHANGE',
      }
    );
  }

  const planProgramado =
    await planAccess.obtenerPlanPorId(
      suscripcion.plan_programado_id,
      connection
    );

  const previous = decorate(
    suscripcion,
    empresa
  );

  const next = {
    ...previous,
    plan_programado_id:
      null,
    cambio_plan_efectivo_en:
      null,
    plan_programado:
      null,
  };

  await connection.query(
    `UPDATE suscripciones
     SET plan_programado_id = NULL,
         cambio_plan_efectivo_en = NULL
     WHERE id = ?`,
    [suscripcion.id]
  );

  await insertHistory(
    connection,
    {
      suscripcion,
      empresaId:
        empresa.id,
      tipoEvento:
        'CANCELACION_CAMBIO_PLAN',
      previous,
      next,
      previousEmpresa:
        empresa.estado,
      nextEmpresa:
        empresa.estado,
      motivo,
      superAdminId,
    }
  );

  return {
    empresa,
    suscripcion,
    previous,
    next,
    planProgramadoCancelado:
      planProgramado,
  };
}

exports.programarCambioPlanTransaccional =
  programarCambioPlanTransaccional;

exports.cancelarCambioPlanProgramadoTransaccional =
  cancelarCambioPlanProgramadoTransaccional;

exports.cambiarPlanInmediato = async (
  req,
  res
) => {
  let connection;

  try {
    const planId =
      positiveId(req.body?.plan_id);

    const motivo = text(
      req.body?.motivo,
      500
    );

    if (!planId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PLAN_ID',
        message:
          'plan_id debe ser un identificador válido',
      });
    }

    connection =
      await db.getConnection();

    await connection.beginTransaction();

    const result =
      await cambiarPlanInmediatoTransaccional(
        connection,
        {
          empresaId: req.params.id,
          planId,
          motivo,
          superAdminId:
            req.superAdmin.id,
        }
      );

    await connection.commit();

    await superAdminAudit.registrar({
      req,
      accion:
        'CAMBIO_PLAN_INMEDIATO',
      entidad: 'SUSCRIPCION',
      entidadId:
        result.suscripcion.id,
      datosAnteriores:
        result.previous,
      datosNuevos:
        result.next,
    });

    return res.json({
      success: true,
      data: {
        ...decorate(
          result.next,
          result.empresa
        ),
        plan_detalle:
          result.plan,
        modulos_habilitados:
          result.modulos.map(
            modulo => modulo.codigo
          ),
        consumo:
          result.consumo,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error(
      'cambiarPlanInmediato error:',
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      code:
        error.code ||
        'PLAN_CHANGE_ERROR',
      message:
        error.status
          ? error.message
          : 'Error al cambiar el plan',
      resource:
        error.resource ||
        undefined,
      used:
        error.used ??
        undefined,
      limit:
        error.limit ??
        undefined,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};


exports.programarCambioPlan = async (
  req,
  res
) => {
  let connection;

  try {
    const planId =
      positiveId(req.body?.plan_id);

    const fechaEfectiva = text(
      req.body?.fecha_efectiva ??
      req.body?.cambio_plan_efectivo_en,
      10
    );

    const motivo = text(
      req.body?.motivo,
      500
    );

    if (!planId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PLAN_ID',
        message:
          'plan_id debe ser un identificador válido',
      });
    }

    connection =
      await db.getConnection();

    await connection.beginTransaction();

    const result =
      await programarCambioPlanTransaccional(
        connection,
        {
          empresaId:
            req.params.id,
          planId,
          fechaEfectiva,
          motivo,
          superAdminId:
            req.superAdmin.id,
        }
      );

    await connection.commit();

    await superAdminAudit.registrar({
      req,
      accion:
        'PROGRAMAR_CAMBIO_PLAN',
      entidad:
        'SUSCRIPCION',
      entidadId:
        result.suscripcion.id,
      datosAnteriores:
        result.previous,
      datosNuevos:
        result.next,
    });

    return res.json({
      success: true,
      data: {
        ...decorate(
          result.next,
          result.empresa
        ),
        plan_programado:
          result.planProgramado,
        cambio_plan_efectivo_en:
          result.fechaEfectiva,
        consumo:
          result.consumo,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error(
      'programarCambioPlan error:',
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      code:
        error.code ||
        'SCHEDULE_PLAN_CHANGE_ERROR',
      message:
        error.status
          ? error.message
          : 'Error al programar el cambio de plan',
      resource:
        error.resource ||
        undefined,
      used:
        error.used ??
        undefined,
      limit:
        error.limit ??
        undefined,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.cancelarCambioPlanProgramado = async (
  req,
  res
) => {
  let connection;

  try {
    const motivo = text(
      req.body?.motivo,
      500
    );

    connection =
      await db.getConnection();

    await connection.beginTransaction();

    const result =
      await cancelarCambioPlanProgramadoTransaccional(
        connection,
        {
          empresaId:
            req.params.id,
          motivo,
          superAdminId:
            req.superAdmin.id,
        }
      );

    await connection.commit();

    await superAdminAudit.registrar({
      req,
      accion:
        'CANCELAR_CAMBIO_PLAN',
      entidad:
        'SUSCRIPCION',
      entidadId:
        result.suscripcion.id,
      datosAnteriores:
        result.previous,
      datosNuevos:
        result.next,
    });

    return res.json({
      success: true,
      data: {
        ...decorate(
          result.next,
          result.empresa
        ),
        plan_programado:
          null,
        cambio_plan_efectivo_en:
          null,
        plan_programado_cancelado:
          result.planProgramadoCancelado,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    console.error(
      'cancelarCambioPlanProgramado error:',
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      code:
        error.code ||
        'CANCEL_PLAN_CHANGE_ERROR',
      message:
        error.status
          ? error.message
          : 'Error al cancelar el cambio de plan',
    });
  } finally {
    if (connection) {
      connection.release();
    }
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

  // El snapshot debe reflejar el estado empresarial final.
  next.estado_empresa = nuevoEstadoEmpresa;

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

exports.renovarSuscripcionTransaccional = lifecycle.renovarSuscripcionTransaccional;

exports.renovarSuscripcion = async (req, res) => {
  let connection;
  try {
    const meses = Number(req.body?.meses);
    const diasGracia = req.body?.dias_gracia === undefined
      ? 0
      : Number(req.body.dias_gracia);
    const motivo = text(req.body?.motivo, 500);
    const planId = req.body?.plan_id === undefined ? null : Number(req.body.plan_id);

    if (!MESES_PERMITIDOS.has(meses)) {
      return res.status(400).json({ success: false, message: 'meses debe ser 1, 3, 6 o 12' });
    }
    if (!Number.isInteger(diasGracia) || diasGracia < 0) {
      return res.status(400).json({ success: false, message: 'dias_gracia debe ser un entero mayor o igual a cero' });
    }
    if (planId !== null && (!Number.isInteger(planId) || planId <= 0)) {
      return res.status(400).json({ success: false, message: 'plan_id no es válido' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const result = await lifecycle.renovarSuscripcionTransaccional(connection, {
      empresaId: req.params.id,
      meses,
      diasGracia,
      motivo,
      planId,
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

async function ejecutarTransicion(req, res, accion, auditAction) {
  try {
    const result = await accion(req.params.id, {
      motivo: text(req.body?.motivo, 500),
      superAdminId: req.superAdmin.id,
    });
    await superAdminAudit.registrar({
      req,
      accion: auditAction,
      entidad: 'SUSCRIPCION',
      entidadId: req.params.id,
      datosAnteriores: result.anterior,
      datosNuevos: result.nuevo,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error(`${auditAction} error:`, error);
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'LIFECYCLE_ERROR',
      message: error.status ? error.message : 'Error al cambiar el ciclo de vida de la suscripción',
    });
  }
}

exports.suspenderEmpresa = (req, res) => ejecutarTransicion(
  req, res, lifecycle.suspenderEmpresaConSuscripcion, 'SUSPENDER_EMPRESA'
);

exports.cancelarEmpresa = (req, res) => ejecutarTransicion(
  req, res, lifecycle.cancelarEmpresaConSuscripcion, 'CANCELAR_EMPRESA'
);

exports.reactivarEmpresa = (req, res) => ejecutarTransicion(
  req, res, lifecycle.reactivarEmpresaConSuscripcion, 'REACTIVAR_EMPRESA'
);

exports.procesarPendientes = async (req, res) => {
  try {
    const result = await lifecycle.procesarPendientes();
    await superAdminAudit.registrar({
      req,
      accion: 'PROCESAR_SUSCRIPCIONES_PENDIENTES',
      entidad: 'SUSCRIPCION',
      entidadId: null,
      datosAnteriores: null,
      datosNuevos: result.resumen,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('procesarPendientes error:', error);
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'PROCESS_PENDING_ERROR',
      message: error.status ? error.message : 'Error al procesar suscripciones pendientes',
    });
  }
};
