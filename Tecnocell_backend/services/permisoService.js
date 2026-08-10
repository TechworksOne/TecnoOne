const db = require('../config/database');

async function getEffectivePermissions(req, connection = db) {
  const empresaId = req?.tenant?.empresa_id;
  const userId = req?.user?.id ?? req?.user?.userId;
  if (!empresaId || !userId) return [];

  const [rows] = await connection.query(
    `SELECT DISTINCT p.codigo
     FROM user_roles ur
     INNER JOIN users u
       ON u.id = ur.user_id
      AND u.empresa_id = ?
      AND u.active = 1
      AND u.tipo_usuario = 'EMPRESA'
      AND COALESCE(u.es_super_admin, 0) = 0
     INNER JOIN roles r
       ON r.id = ur.role_id
      AND r.empresa_id = u.empresa_id
      AND r.activo = 1
     INNER JOIN rol_permisos rp
       ON rp.rol_id = r.id
      AND rp.empresa_id = r.empresa_id
     INNER JOIN permisos p ON p.id = rp.permiso_id
     WHERE ur.user_id = ?`,
    [empresaId, userId]
  );
  return rows.map(row => row.codigo);
}

async function hasPermission(req, code, connection = db) {
  const permissions = await getEffectivePermissions(req, connection);
  return permissions.includes(code);
}

module.exports = { getEffectivePermissions, hasPermission };
