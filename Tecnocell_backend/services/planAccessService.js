const db = require('../config/database');


function toPlanDateString(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (value instanceof Date) {
    return [
      value.getUTCFullYear(),
      String(
        value.getUTCMonth() + 1
      ).padStart(2, '0'),
      String(
        value.getUTCDate()
      ).padStart(2, '0'),
    ].join('-');
  }

  return String(value).slice(0, 10);
}

function planTodayString(now = new Date()) {
  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, '0'),
    String(
      now.getDate()
    ).padStart(2, '0'),
  ].join('-');
}

function serializePlanSnapshot(value) {
  return value == null
    ? null
    : JSON.stringify(value);
}

function normalizeCode(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePlan(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion,
    precio_mensual: Number(row.precio_mensual || 0),
    precio_anual:
      row.precio_anual === null || row.precio_anual === undefined
        ? null
        : Number(row.precio_anual),
    moneda: row.moneda,
    max_usuarios:
      row.max_usuarios === null || row.max_usuarios === undefined
        ? null
        : Number(row.max_usuarios),
    max_sucursales:
      row.max_sucursales === null || row.max_sucursales === undefined
        ? null
        : Number(row.max_sucursales),
    activo: Boolean(Number(row.activo)),
    es_publico: Boolean(Number(row.es_publico)),
    asignable: Boolean(Number(row.asignable)),
    orden: Number(row.orden || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function obtenerPlanPorId(planId, connection = db) {
  const [rows] = await connection.query(
    `SELECT *
     FROM planes
     WHERE id = ?
     LIMIT 1`,
    [planId]
  );

  return normalizePlan(rows[0]);
}

async function obtenerPlanPorCodigo(codigo, connection = db) {
  const normalized = normalizeCode(codigo);
  if (!normalized) return null;

  const [rows] = await connection.query(
    `SELECT *
     FROM planes
     WHERE codigo = ?
     LIMIT 1`,
    [normalized]
  );

  return normalizePlan(rows[0]);
}

async function resolverPlanCompatibilidad(planTextual, connection = db) {
  const raw = normalizeCode(planTextual);

  let codigo;
  if (!raw || raw === 'pro') {
    codigo = 'legacy_full';
  } else if (raw === 'demo') {
    codigo = 'legacy_demo';
  } else {
    codigo = raw;
  }

  let plan = await obtenerPlanPorCodigo(codigo, connection);

  if (!plan && codigo !== 'legacy_full') {
    plan = await obtenerPlanPorCodigo('legacy_full', connection);
  }

  if (!plan) {
    const error = new Error('No existe un plan de compatibilidad disponible');
    error.code = 'PLAN_CATALOG_MISSING';
    throw error;
  }

  return plan;
}

async function obtenerModulosPlan(planId, connection = db) {
  const [rows] = await connection.query(
    `SELECT
       m.id,
       m.codigo,
       m.nombre,
       m.grupo,
       m.descripcion,
       m.activo,
       m.siempre_habilitado,
       pm.habilitado
     FROM plan_modulos pm
     INNER JOIN modulos m
       ON m.id = pm.modulo_id
     WHERE pm.plan_id = ?
       AND pm.habilitado = 1
       AND m.activo = 1
     ORDER BY m.grupo, m.nombre, m.id`,
    [planId]
  );

  return rows.map(row => ({
    id: Number(row.id),
    codigo: row.codigo,
    nombre: row.nombre,
    grupo: row.grupo,
    descripcion: row.descripcion,
    activo: Boolean(Number(row.activo)),
    siempre_habilitado: Boolean(Number(row.siempre_habilitado)),
    habilitado: Boolean(Number(row.habilitado)),
  }));
}


async function aplicarCambioPlanProgramadoTransaccional(
  connection,
  empresaId,
  {
    hoy = planTodayString(),
  } = {}
) {
  const normalizedEmpresaId =
    Number(empresaId);

  if (
    !Number.isInteger(
      normalizedEmpresaId
    ) ||
    normalizedEmpresaId <= 0
  ) {
    const error =
      new Error('Empresa no válida');

    error.code =
      'INVALID_EMPRESA_ID';

    error.statusCode = 400;

    throw error;
  }

  const [rows] =
    await connection.query(
      `SELECT
         s.*,
         e.estado AS empresa_estado,
         e.plan AS empresa_plan
       FROM suscripciones s
       INNER JOIN empresas e
         ON e.id = s.empresa_id
       WHERE s.empresa_id = ?
       LIMIT 1
       FOR UPDATE`,
      [normalizedEmpresaId]
    );

  const suscripcion = rows[0];

  if (!suscripcion) {
    return {
      aplicado: false,
      code:
        'SUBSCRIPTION_NOT_FOUND',
    };
  }

  const fechaEfectiva =
    toPlanDateString(
      suscripcion
        .cambio_plan_efectivo_en
    );

  if (
    !suscripcion.plan_programado_id ||
    !fechaEfectiva
  ) {
    return {
      aplicado: false,
      code:
        'NO_SCHEDULED_PLAN_CHANGE',
    };
  }

  if (fechaEfectiva > hoy) {
    return {
      aplicado: false,
      code:
        'PLAN_CHANGE_NOT_DUE',
      fecha_efectiva:
        fechaEfectiva,
    };
  }

  const planProgramado =
    await obtenerPlanPorId(
      suscripcion.plan_programado_id,
      connection
    );

  if (!planProgramado) {
    return {
      aplicado: false,
      bloqueado: true,
      code:
        'SCHEDULED_PLAN_NOT_FOUND',
    };
  }

  if (!planProgramado.activo) {
    return {
      aplicado: false,
      bloqueado: true,
      code:
        'SCHEDULED_PLAN_INACTIVE',
      plan:
        planProgramado,
    };
  }

  if (!planProgramado.asignable) {
    return {
      aplicado: false,
      bloqueado: true,
      code:
        'SCHEDULED_PLAN_NOT_ASSIGNABLE',
      plan:
        planProgramado,
    };
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

  const used =
    activeUsers.length;

  if (
    planProgramado.max_usuarios !==
      null &&
    used >
      planProgramado.max_usuarios
  ) {
    return {
      aplicado: false,
      bloqueado: true,
      code:
        'PLAN_LIMIT_CONFLICT',
      resource:
        'usuarios',
      used,
      limit:
        planProgramado.max_usuarios,
      plan:
        planProgramado,
      fecha_efectiva:
        fechaEfectiva,
    };
  }

  const previous = {
    id:
      Number(suscripcion.id),
    empresa_id:
      Number(suscripcion.empresa_id),
    plan:
      suscripcion.plan,
    plan_id:
      Number(suscripcion.plan_id),
    plan_programado_id:
      Number(
        suscripcion.plan_programado_id
      ),
    cambio_plan_efectivo_en:
      fechaEfectiva,
    tipo:
      suscripcion.tipo,
    estado:
      suscripcion.estado,
    fecha_inicio:
      toPlanDateString(
        suscripcion.fecha_inicio
      ),
    fecha_vencimiento:
      toPlanDateString(
        suscripcion.fecha_vencimiento
      ),
    dias_gracia:
      Number(
        suscripcion.dias_gracia || 0
      ),
  };

  const next = {
    ...previous,
    plan:
      planProgramado.codigo,
    plan_id:
      planProgramado.id,
    plan_programado_id:
      null,
    cambio_plan_efectivo_en:
      null,
  };

  await connection.query(
    `UPDATE suscripciones
     SET plan = ?,
         plan_id = ?,
         plan_programado_id = NULL,
         cambio_plan_efectivo_en = NULL
     WHERE id = ?`,
    [
      planProgramado.codigo,
      planProgramado.id,
      suscripcion.id,
    ]
  );

  await connection.query(
    `UPDATE empresas
     SET plan = ?
     WHERE id = ?`,
    [
      planProgramado.codigo,
      normalizedEmpresaId,
    ]
  );

  await connection.query(
    `INSERT INTO historial_suscripciones (
       suscripcion_id,
       empresa_id,
       tipo_evento,
       estado_empresa_anterior,
       estado_empresa_nuevo,
       estado_suscripcion_anterior,
       estado_suscripcion_nuevo,
       fecha_inicio_anterior,
       fecha_inicio_nueva,
       fecha_vencimiento_anterior,
       fecha_vencimiento_nueva,
       dias_gracia_anterior,
       dias_gracia_nuevo,
       meses_renovados,
       motivo,
       super_admin_id,
       origen,
       datos_anteriores,
       datos_nuevos
     ) VALUES (
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?
     )`,
    [
      suscripcion.id,
      normalizedEmpresaId,
      'APLICACION_CAMBIO_PLAN_PROGRAMADO',
      suscripcion.empresa_estado,
      suscripcion.empresa_estado,
      suscripcion.estado,
      suscripcion.estado,
      previous.fecha_inicio,
      next.fecha_inicio,
      previous.fecha_vencimiento,
      next.fecha_vencimiento,
      previous.dias_gracia,
      next.dias_gracia,
      null,
      'Aplicación automática del cambio de plan programado',
      null,
      'automatico',
      serializePlanSnapshot(previous),
      serializePlanSnapshot(next),
    ]
  );

  return {
    aplicado: true,
    code:
      'SCHEDULED_PLAN_CHANGE_APPLIED',
    empresa_id:
      normalizedEmpresaId,
    suscripcion_id:
      Number(suscripcion.id),
    plan_anterior_id:
      Number(suscripcion.plan_id),
    plan_nuevo:
      planProgramado,
    fecha_efectiva:
      fechaEfectiva,
    consumo: {
      usuarios_activos:
        used,
      usuarios_limite:
        planProgramado.max_usuarios,
    },
  };
}

async function aplicarCambioPlanProgramadoVencido(
  empresaId,
  {
    hoy = planTodayString(),
  } = {}
) {
  const connection =
    await db.getConnection();

  try {
    await connection.beginTransaction();

    const result =
      await aplicarCambioPlanProgramadoTransaccional(
        connection,
        empresaId,
        { hoy }
      );

    await connection.commit();

    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}

    throw error;
  } finally {
    connection.release();
  }
}

async function obtenerPlanEmpresa(empresaId, connection = db) {
  if (connection === db) {
    await aplicarCambioPlanProgramadoVencido(
      empresaId
    );
  }

  const [rows] = await connection.query(
    `SELECT
       s.id AS suscripcion_id,
       s.empresa_id,
       s.plan AS plan_textual,
       s.plan_id,
       s.plan_programado_id,
       s.cambio_plan_efectivo_en,

       p.id AS p_id,
       p.codigo AS p_codigo,
       p.nombre AS p_nombre,
       p.descripcion AS p_descripcion,
       p.precio_mensual AS p_precio_mensual,
       p.precio_anual AS p_precio_anual,
       p.moneda AS p_moneda,
       p.max_usuarios AS p_max_usuarios,
       p.max_sucursales AS p_max_sucursales,
       p.activo AS p_activo,
       p.es_publico AS p_es_publico,
       p.asignable AS p_asignable,
       p.orden AS p_orden,
       p.created_at AS p_created_at,
       p.updated_at AS p_updated_at,

       pp.id AS pp_id,
       pp.codigo AS pp_codigo,
       pp.nombre AS pp_nombre
     FROM suscripciones s
     INNER JOIN planes p
       ON p.id = s.plan_id
     LEFT JOIN planes pp
       ON pp.id = s.plan_programado_id
     WHERE s.empresa_id = ?
     LIMIT 1`,
    [empresaId]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    suscripcion_id: Number(row.suscripcion_id),
    empresa_id: Number(row.empresa_id),
    plan_textual: row.plan_textual,
    plan: normalizePlan({
      id: row.p_id,
      codigo: row.p_codigo,
      nombre: row.p_nombre,
      descripcion: row.p_descripcion,
      precio_mensual: row.p_precio_mensual,
      precio_anual: row.p_precio_anual,
      moneda: row.p_moneda,
      max_usuarios: row.p_max_usuarios,
      max_sucursales: row.p_max_sucursales,
      activo: row.p_activo,
      es_publico: row.p_es_publico,
      asignable: row.p_asignable,
      orden: row.p_orden,
      created_at: row.p_created_at,
      updated_at: row.p_updated_at,
    }),
    plan_programado: row.pp_id
      ? {
          id: Number(row.pp_id),
          codigo: row.pp_codigo,
          nombre: row.pp_nombre,
          cambio_efectivo_en: row.cambio_plan_efectivo_en,
        }
      : null,
  };
}

async function obtenerConsumoEmpresa(empresaId, connection = db) {
  const [[users]] = await connection.query(
    `SELECT
       COUNT(*) AS usuarios_totales,
       SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS usuarios_activos,
       SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) AS usuarios_inactivos
     FROM users
     WHERE empresa_id = ?
       AND COALESCE(tipo_usuario, 'EMPRESA') = 'EMPRESA'
       AND COALESCE(es_super_admin, 0) = 0`,
    [empresaId]
  );

  return {
    usuarios_totales: Number(users.usuarios_totales || 0),
    usuarios_activos: Number(users.usuarios_activos || 0),
    usuarios_inactivos: Number(users.usuarios_inactivos || 0),
  };
}

async function obtenerResumenPlanEmpresa(empresaId, connection = db) {
  const planEmpresa = await obtenerPlanEmpresa(empresaId, connection);
  if (!planEmpresa) return null;

  const [modulos, consumo] = await Promise.all([
    obtenerModulosPlan(planEmpresa.plan.id, connection),
    obtenerConsumoEmpresa(empresaId, connection),
  ]);

  const limite = planEmpresa.plan.max_usuarios;
  const usados = consumo.usuarios_activos;

  return {
    ...planEmpresa,
    modulos,
    modulos_habilitados: modulos.map(modulo => modulo.codigo),
    consumo: {
      ...consumo,
      usuarios_limite: limite,
      usuarios_disponibles:
        limite === null ? null : Math.max(0, limite - usados),
      porcentaje_usuarios:
        limite === null || limite === 0
          ? null
          : Math.round((usados / limite) * 100),
      sucursales_usadas: null,
      sucursales_limite: planEmpresa.plan.max_sucursales,
    },
  };
}



async function obtenerAccesoModuloEmpresa(
  empresaId,
  codigoModulo,
  connection = db
) {
  const normalizedEmpresaId = Number(empresaId);
  const normalizedModuleCode =
    normalizeCode(codigoModulo);

  if (
    !Number.isInteger(normalizedEmpresaId) ||
    normalizedEmpresaId <= 0
  ) {
    const error = new Error('Empresa no válida');
    error.code = 'INVALID_EMPRESA_ID';
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedModuleCode) {
    const error = new Error(
      'Código de módulo no válido'
    );
    error.code = 'INVALID_MODULE_CODE';
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await connection.query(
    `SELECT
       s.id AS suscripcion_id,
       s.empresa_id,
       p.id AS plan_id,
       p.codigo AS plan_codigo,
       p.nombre AS plan_nombre,
       m.id AS modulo_id,
       m.codigo AS modulo_codigo,
       m.nombre AS modulo_nombre,
       CASE
         WHEN m.siempre_habilitado = 1
           THEN 1
         WHEN COALESCE(pm.habilitado, 0) = 1
           THEN 1
         ELSE 0
       END AS habilitado
     FROM suscripciones s
     INNER JOIN planes p
       ON p.id = s.plan_id
      AND p.activo = 1
     INNER JOIN modulos m
       ON m.codigo = ?
      AND m.activo = 1
     LEFT JOIN plan_modulos pm
       ON pm.plan_id = p.id
      AND pm.modulo_id = m.id
     WHERE s.empresa_id = ?
     ORDER BY s.id DESC
     LIMIT 1`,
    [
      normalizedModuleCode,
      normalizedEmpresaId
    ]
  );

  if (!rows.length) {
    return {
      empresa_id: normalizedEmpresaId,
      suscripcion_id: null,
      plan_id: null,
      plan_codigo: null,
      plan_nombre: null,
      modulo_id: null,
      modulo_codigo: normalizedModuleCode,
      modulo_nombre: null,
      habilitado: false,
    };
  }

  const row = rows[0];

  return {
    empresa_id: Number(row.empresa_id),
    suscripcion_id: Number(
      row.suscripcion_id
    ),
    plan_id: Number(row.plan_id),
    plan_codigo: row.plan_codigo,
    plan_nombre: row.plan_nombre,
    modulo_id: Number(row.modulo_id),
    modulo_codigo: row.modulo_codigo,
    modulo_nombre: row.modulo_nombre,
    habilitado: Boolean(row.habilitado),
  };
}

async function tieneModuloEmpresa(
  empresaId,
  codigoModulo,
  connection = db
) {
  const acceso =
    await obtenerAccesoModuloEmpresa(
      empresaId,
      codigoModulo,
      connection
    );

  return acceso.habilitado;
}

function createPlanLimitError({
  resource = 'usuarios',
  used,
  limit,
  planCode,
}) {
  const error = new Error(
    resource === 'usuarios'
      ? 'La empresa alcanzó el límite de usuarios activos permitido por su plan.'
      : `El plan alcanzó el límite de ${resource} activos.`
  );

  error.code = 'PLAN_LIMIT_EXCEEDED';
  error.statusCode = 409;
  error.resource = resource;
  error.used = Number(used || 0);
  error.limit = Number(limit || 0);
  error.planCode = planCode || null;

  return error;
}

async function obtenerPlanEmpresaBloqueado(
  empresaId,
  connection = db
) {
  const normalizedEmpresaId = Number(empresaId);

  if (
    !Number.isInteger(normalizedEmpresaId) ||
    normalizedEmpresaId <= 0
  ) {
    const error = new Error('Empresa no válida');
    error.code = 'INVALID_EMPRESA_ID';
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await connection.query(
    `SELECT
       s.id AS suscripcion_id,
       s.empresa_id,
       s.plan_id,
       p.codigo AS plan_codigo,
       p.nombre AS plan_nombre,
       p.max_usuarios
     FROM suscripciones s
     INNER JOIN planes p
       ON p.id = s.plan_id
     WHERE s.empresa_id = ?
     LIMIT 1
     FOR UPDATE`,
    [normalizedEmpresaId]
  );

  if (!rows.length) {
    const error = new Error(
      'La empresa no tiene un plan configurado.'
    );
    error.code = 'EMPRESA_PLAN_NOT_FOUND';
    error.statusCode = 409;
    throw error;
  }

  const row = rows[0];

  return {
    suscripcion_id: Number(row.suscripcion_id),
    empresa_id: Number(row.empresa_id),
    plan_id: Number(row.plan_id),
    plan_codigo: row.plan_codigo,
    plan_nombre: row.plan_nombre,
    max_usuarios:
      row.max_usuarios === null ||
      row.max_usuarios === undefined
        ? null
        : Number(row.max_usuarios),
  };
}

async function contarUsuariosActivos(
  empresaId,
  connection = db,
  { excludeUserId = null } = {}
) {
  const params = [empresaId];

  let excludeSql = '';

  if (
    excludeUserId !== null &&
    excludeUserId !== undefined
  ) {
    excludeSql = ' AND id <> ?';
    params.push(excludeUserId);
  }

  const [rows] = await connection.query(
    `SELECT id
     FROM users
     WHERE empresa_id = ?
       AND active = 1
       AND COALESCE(tipo_usuario, 'EMPRESA') = 'EMPRESA'
       AND COALESCE(es_super_admin, 0) = 0
       ${excludeSql}
     FOR UPDATE`,
    params
  );

  return rows.length;
}

async function validarLimiteUsuarios(
  empresaId,
  connection = db,
  {
    incremento = 1,
    excludeUserId = null,
  } = {}
) {
  const normalizedIncrement = Number(incremento);

  if (
    !Number.isInteger(normalizedIncrement) ||
    normalizedIncrement < 0
  ) {
    const error = new Error(
      'El incremento de usuarios no es válido.'
    );
    error.code = 'INVALID_USER_INCREMENT';
    error.statusCode = 400;
    throw error;
  }

  const plan = await obtenerPlanEmpresaBloqueado(
    empresaId,
    connection
  );

  const used = await contarUsuariosActivos(
    empresaId,
    connection,
    { excludeUserId }
  );

  if (plan.max_usuarios === null) {
    return {
      permitido: true,
      ilimitado: true,
      used,
      limit: null,
      available: null,
      plan,
    };
  }

  const projected = used + normalizedIncrement;

  if (projected > plan.max_usuarios) {
    throw createPlanLimitError({
      used,
      limit: plan.max_usuarios,
      planCode: plan.plan_codigo,
    });
  }

  return {
    permitido: true,
    ilimitado: false,
    used,
    limit: plan.max_usuarios,
    available: Math.max(
      0,
      plan.max_usuarios - projected
    ),
    projected,
    plan,
  };
}

function planLimitErrorResponse(error) {
  if (!error || error.code !== 'PLAN_LIMIT_EXCEEDED') {
    return null;
  }

  return {
    status: Number(error.statusCode || 409),
    body: {
      success: false,
      code: error.code,
      resource: error.resource || 'usuarios',
      used: Number(error.used || 0),
      limit: Number(error.limit || 0),
      plan: error.planCode || null,
      message: error.message,
    },
  };
}

module.exports = {
  aplicarCambioPlanProgramadoTransaccional,
  aplicarCambioPlanProgramadoVencido,
  normalizeCode,
  normalizePlan,
  obtenerPlanPorId,
  obtenerPlanPorCodigo,
  resolverPlanCompatibilidad,
  obtenerModulosPlan,
  obtenerPlanEmpresa,
  obtenerConsumoEmpresa,
  obtenerResumenPlanEmpresa,
  obtenerAccesoModuloEmpresa,
  tieneModuloEmpresa,
  createPlanLimitError,
  obtenerPlanEmpresaBloqueado,
  contarUsuariosActivos,
  validarLimiteUsuarios,
  planLimitErrorResponse,
};
