const db = require('../config/database');

const REDACTADO = '[REDACTADO]';
const TRUNCADO = '[TRUNCADO]';

const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;
const MAX_JSON_LENGTH = 50000;

const SENSITIVE_KEY =
  /(password|contrasen|contraseñ|token|cookie|authorization|autorizacion|pin|patron|pattern|acceso.?valor|clave|secret|firma|signature|base64|imagen|image|foto|photo|comprobante)/i;

const BASE64_VALUE =
  /^(data:[^;]+;base64,|[A-Za-z0-9+/]{300,}={0,2}$)/;

function sanitize(value, seen = new WeakSet(), depth = 0) {
  if (value === null || value === undefined) return value;

  if (Buffer.isBuffer(value)) return REDACTADO;

  if (typeof value === 'string') {
    const text = value.trim();

    if (BASE64_VALUE.test(text)) return REDACTADO;
    if (value.length > 2000) return TRUNCADO;

    return value;
  }

  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return TRUNCADO;
  if (seen.has(value)) return TRUNCADO;

  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map(item => sanitize(item, seen, depth + 1));

    if (value.length > MAX_ARRAY_ITEMS) {
      result.push(
        `${TRUNCADO}: ${value.length - MAX_ARRAY_ITEMS} elementos omitidos`
      );
    }

    return result;
  }

  const entries = Object.entries(value);
  const result = {};

  for (const [key, item] of entries.slice(0, MAX_OBJECT_KEYS)) {
    result[key] = SENSITIVE_KEY.test(key)
      ? REDACTADO
      : sanitize(item, seen, depth + 1);
  }

  if (entries.length > MAX_OBJECT_KEYS) {
    result._truncado =
      `${entries.length - MAX_OBJECT_KEYS} campos omitidos`;
  }

  return result;
}

function stringifySanitized(value) {
  const serialized = JSON.stringify(sanitize(value));

  if (serialized.length <= MAX_JSON_LENGTH) {
    return serialized;
  }

  return JSON.stringify({
    _truncado: true,
    mensaje: 'El contenido excedía el límite permitido para auditoría',
  });
}

function getUsuarioNombre(req) {
  return String(
    req?.user?.name ||
    req?.user?.nombre ||
    req?.user?.username ||
    req?.user?.email ||
    'Sistema'
  ).slice(0, 255);
}

function getRequestPath(req) {
  if (req?.baseUrl && req?.path) {
    return `${req.baseUrl}${req.path}`.slice(0, 500);
  }

  if (req?.originalUrl) {
    return String(req.originalUrl).split('?')[0].slice(0, 500);
  }

  return null;
}

async function registrar({
  req,
  empresaId,
  accion,
  entidad,
  entidadId = null,
  descripcion,
  datosAnteriores = null,
  datosNuevos = null,
}) {
  try {
    const tenantEmpresaId = req?.tenant?.empresa_id;

    if (
      tenantEmpresaId === null ||
      tenantEmpresaId === undefined ||
      tenantEmpresaId === ''
    ) {
      console.warn(
        '[Auditoria] Registro omitido: empresa_id del tenant no disponible'
      );
      return false;
    }

    if (
      empresaId !== null &&
      empresaId !== undefined &&
      empresaId !== '' &&
      String(empresaId) !== String(tenantEmpresaId)
    ) {
      console.warn(
        '[Auditoria] Registro omitido: empresa_id no coincide con el tenant'
      );
      return false;
    }

    if (!accion || !entidad || !descripcion) {
      console.warn(
        '[Auditoria] Registro omitido: faltan datos obligatorios'
      );
      return false;
    }

    await db.query(
      `INSERT INTO auditoria_logs (
        empresa_id,
        usuario_id,
        usuario_nombre,
        accion,
        entidad,
        entidad_id,
        descripcion,
        datos_anteriores,
        datos_nuevos,
        metodo_http,
        ruta,
        ip,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantEmpresaId,
        req?.user?.id ?? req?.user?.userId ?? null,
        getUsuarioNombre(req),
        String(accion).slice(0, 80),
        String(entidad).slice(0, 80),
        entidadId === null || entidadId === undefined
          ? null
          : String(entidadId).slice(0, 100),
        String(descripcion).slice(0, 500),
        datosAnteriores == null
          ? null
          : stringifySanitized(datosAnteriores),
        datosNuevos == null
          ? null
          : stringifySanitized(datosNuevos),
        req?.method ? String(req.method).slice(0, 10) : null,
        getRequestPath(req),
        req?.ip ? String(req.ip).slice(0, 64) : null,
        req?.get?.('user-agent')
          ? String(req.get('user-agent')).slice(0, 500)
          : null,
      ]
    );

    return true;
  } catch (error) {
    console.error(
      '[Auditoria] No se pudo registrar la acción:',
      error.message
    );
    return false;
  }
}

module.exports = {
  registrar,
  sanitize,
  REDACTADO,
  TRUNCADO,
};
