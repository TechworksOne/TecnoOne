const db = require('../config/database');
const { sanitize } = require('./auditoriaService');

function stringify(value) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(sanitize(value));
}

async function registrar({
  req,
  accion,
  entidad,
  entidadId = null,
  datosAnteriores = null,
  datosNuevos = null,
}) {
  try {
    const superAdminId = req?.superAdmin?.id;
    if (!superAdminId) return false;

    await db.query(
      `INSERT INTO auditoria_super_admin (
        super_admin_id, accion, entidad, entidad_id,
        datos_anteriores, datos_nuevos, ip, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        superAdminId,
        String(accion).slice(0, 80),
        String(entidad).slice(0, 80),
        entidadId == null ? null : String(entidadId).slice(0, 100),
        stringify(datosAnteriores),
        stringify(datosNuevos),
        req?.ip ? String(req.ip).slice(0, 64) : null,
        req?.get?.('user-agent') ? String(req.get('user-agent')).slice(0, 500) : null,
      ]
    );
    return true;
  } catch (error) {
    console.error('[SuperAdminAudit] No se pudo registrar la acción:', error.message);
    return false;
  }
}

module.exports = { registrar };
