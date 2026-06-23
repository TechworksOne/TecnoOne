const db = require('../config/database');

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

async function obtenerPlanEmpresa(empresaId, connection = db) {
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

module.exports = {
  normalizeCode,
  normalizePlan,
  obtenerPlanPorId,
  obtenerPlanPorCodigo,
  resolverPlanCompatibilidad,
  obtenerModulosPlan,
  obtenerPlanEmpresa,
  obtenerConsumoEmpresa,
  obtenerResumenPlanEmpresa,
};
