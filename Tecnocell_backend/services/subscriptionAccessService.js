const db = require('../config/database');
const planAccess = require('./planAccessService');

const ESTADOS_EMPRESA_CON_ACCESO = new Set(['activa', 'demo', 'prueba']);
const ESTADOS_SUSCRIPCION_CON_ACCESO = new Set(['prueba', 'vigente', 'gracia']);
const LEGACY_ACCESS_ENABLED = String(
  process.env.ALLOW_LEGACY_SUBSCRIPTION_ACCESS || ''
).toLowerCase() === 'true';

function toDateString(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return [
      value.getUTCFullYear(),
      String(value.getUTCMonth() + 1).padStart(2, '0'),
      String(value.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }
  return String(value).slice(0, 10);
}

function parseDate(value) {
  const text = toDateString(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

function isValidDate(value, { nullable = true } = {}) {
  if (value === null || value === undefined || value === '') return nullable;
  return parseDate(value) !== null;
}

function formatDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function todayString(now = new Date()) {
  return formatDate(new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  )));
}

function addDays(value, days) {
  const date = parseDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return formatDate(date);
}

function addMonths(value, months) {
  const date = parseDate(value);
  if (!date) return null;
  const originalDay = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Number(months), 1));
  const lastDay = new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    0
  )).getUTCDate();
  target.setUTCDate(Math.min(originalDay, lastDay));
  return formatDate(target);
}

function diffDays(from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function calcularFechaFinGracia(fechaVencimiento, diasGracia = 0) {
  if (!fechaVencimiento) return null;
  return addDays(fechaVencimiento, Math.max(0, Number(diasGracia) || 0));
}

function calcularEstadoSuscripcion(suscripcion, hoy = todayString()) {
  const tipo = String(suscripcion?.tipo || 'comercial').toLowerCase();
  const estadoBase = tipo === 'prueba' ? 'prueba' : 'vigente';
  const vencimiento = toDateString(suscripcion?.fecha_vencimiento);
  if (!vencimiento) return estadoBase;

  if (diffDays(hoy, vencimiento) >= 0) return estadoBase;

  const finGracia = toDateString(suscripcion?.fecha_fin_gracia)
    || calcularFechaFinGracia(vencimiento, suscripcion?.dias_gracia);
  if (finGracia && diffDays(hoy, finGracia) >= 0) return 'gracia';
  return 'vencida';
}

function calcularDiasRestantes(suscripcion, hoy = todayString()) {
  const vencimiento = toDateString(suscripcion?.fecha_vencimiento);
  return vencimiento ? diffDays(hoy, vencimiento) : null;
}

function evaluarAcceso({ empresa, suscripcion }, hoy = todayString()) {
  if (!empresa) {
    return { permitido: false, code: 'EMPRESA_INEXISTENTE', estado_suscripcion: null };
  }

  const estadoEmpresa = String(empresa.estado || '').toLowerCase();
  if (!ESTADOS_EMPRESA_CON_ACCESO.has(estadoEmpresa)) {
    return {
      permitido: false,
      code: estadoEmpresa === 'cancelada' ? 'EMPRESA_CANCELADA' : 'EMPRESA_SUSPENDIDA',
      estado_suscripcion: suscripcion ? calcularEstadoSuscripcion(suscripcion, hoy) : null,
    };
  }

  if (!suscripcion) {
    return {
      permitido: LEGACY_ACCESS_ENABLED,
      code: LEGACY_ACCESS_ENABLED
        ? 'SUSCRIPCION_LEGACY_EXPLICITA'
        : 'SUSCRIPCION_REQUERIDA',
      estado_suscripcion: null,
      compatibilidad_legacy: LEGACY_ACCESS_ENABLED,
    };
  }

  const estadoSuscripcion = calcularEstadoSuscripcion(suscripcion, hoy);
  return {
    permitido: ESTADOS_SUSCRIPCION_CON_ACCESO.has(estadoSuscripcion),
    code: estadoSuscripcion === 'vencida' ? 'SUSCRIPCION_VENCIDA' : 'ACCESO_PERMITIDO',
    estado_suscripcion: estadoSuscripcion,
    dias_restantes: calcularDiasRestantes(suscripcion, hoy),
    proxima_a_vencer:
      calcularDiasRestantes(suscripcion, hoy) !== null &&
      calcularDiasRestantes(suscripcion, hoy) >= 0 &&
      calcularDiasRestantes(suscripcion, hoy) <= Number(suscripcion.proxima_a_vencer_dias ?? 7),
  };
}

async function obtenerContextoEmpresa(empresaId, connection = db) {
  const [rows] = await connection.query(
    `SELECT
       e.id AS empresa_id,
       e.nombre AS empresa_nombre,
       e.slug AS empresa_slug,
       e.estado AS empresa_estado,
       e.plan AS empresa_plan,
       e.fecha_inicio AS empresa_fecha_inicio,
       e.fecha_vencimiento AS empresa_fecha_vencimiento,
       s.id AS suscripcion_id,
       s.plan AS suscripcion_plan,
       s.tipo AS suscripcion_tipo,
       s.estado AS suscripcion_estado,
       s.fecha_inicio AS suscripcion_fecha_inicio,
       s.fecha_vencimiento AS suscripcion_fecha_vencimiento,
       s.dias_gracia,
       s.fecha_fin_gracia,
       s.duracion_meses,
       s.proxima_a_vencer_dias
     FROM empresas e
     LEFT JOIN suscripciones s ON s.empresa_id = e.id
     WHERE e.id = ?
     LIMIT 1`,
    [empresaId]
  );
  if (!rows.length) return { empresa: null, suscripcion: null };
  const row = rows[0];
  return {
    empresa: {
      id: row.empresa_id,
      nombre: row.empresa_nombre,
      slug: row.empresa_slug,
      estado: row.empresa_estado,
      plan: row.empresa_plan,
      fecha_inicio: toDateString(row.empresa_fecha_inicio),
      fecha_vencimiento: toDateString(row.empresa_fecha_vencimiento),
    },
    suscripcion: row.suscripcion_id ? {
      id: row.suscripcion_id,
      empresa_id: row.empresa_id,
      plan: row.suscripcion_plan,
      tipo: row.suscripcion_tipo,
      estado: row.suscripcion_estado,
      fecha_inicio: toDateString(row.suscripcion_fecha_inicio),
      fecha_vencimiento: toDateString(row.suscripcion_fecha_vencimiento),
      dias_gracia: Number(row.dias_gracia || 0),
      fecha_fin_gracia: toDateString(row.fecha_fin_gracia),
      duracion_meses: row.duracion_meses == null ? null : Number(row.duracion_meses),
      proxima_a_vencer_dias: Number(row.proxima_a_vencer_dias ?? 7),
    } : null,
  };
}

async function sincronizarEstadoDerivado(contexto, connection = db, hoy = todayString()) {
  if (!contexto?.suscripcion) return contexto;
  const estado = calcularEstadoSuscripcion(contexto.suscripcion, hoy);
  // El acceso es deliberadamente de solo lectura. La persistencia y su
  // historial pertenecen al procesador explícito de pendientes.
  contexto.suscripcion.estado = estado;
  return contexto;
}

async function evaluarAccesoEmpresa(empresaId, {
  connection = db,
  hoy = todayString(),
  sincronizar = true,
  aplicarCambioProgramado = true,
} = {}) {
  if (aplicarCambioProgramado) {
    if (connection === db) {
      await planAccess
        .aplicarCambioPlanProgramadoVencido(
          empresaId,
          { hoy }
        );
    } else {
      await planAccess
        .aplicarCambioPlanProgramadoTransaccional(
          connection,
          empresaId,
          { hoy }
        );
    }
  }

  const contexto = await obtenerContextoEmpresa(empresaId, connection);
  if (sincronizar) await sincronizarEstadoDerivado(contexto, connection, hoy);
  const acceso = evaluarAcceso(contexto, hoy);
  if (acceso.code === 'SUSCRIPCION_LEGACY_EXPLICITA') {
    console.warn(JSON.stringify({
      event: 'LEGACY_SUBSCRIPTION_ACCESS',
      empresa_id: Number(empresaId),
      at: new Date().toISOString(),
    }));
  }
  return { ...contexto, ...acceso };
}

function mensajeAccesoDenegado(code) {
  const messages = {
    EMPRESA_CANCELADA: 'La empresa se encuentra cancelada',
    EMPRESA_SUSPENDIDA: 'La empresa se encuentra suspendida',
    SUSCRIPCION_VENCIDA: 'La suscripción de la empresa se encuentra vencida',
    SUSCRIPCION_REQUERIDA: 'La empresa no tiene una suscripción configurada',
    EMPRESA_INEXISTENTE: 'La empresa no se encuentra disponible',
  };
  return messages[code] || 'La empresa no se encuentra disponible';
}

module.exports = {
  addDays,
  addMonths,
  calcularDiasRestantes,
  calcularEstadoSuscripcion,
  calcularFechaFinGracia,
  diffDays,
  evaluarAcceso,
  evaluarAccesoEmpresa,
  isValidDate,
  mensajeAccesoDenegado,
  obtenerContextoEmpresa,
  sincronizarEstadoDerivado,
  todayString,
  toDateString,
};
