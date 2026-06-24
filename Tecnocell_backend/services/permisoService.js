const db = require('../config/database');

function isSuperadmin(req) {
  return false;
}

async function getEffectivePermissions(req, connection = db) {
  if (isSuperadmin(req)) return ['*'];

  const empresaId = req?.tenant?.empresa_id ?? req?.user?.empresa_id;
  const userId = req?.user?.id ?? req?.user?.userId;
  if (!empresaId || !userId) return [];

  const [rows] = await connection.query(
    `SELECT DISTINCT p.codigo
     FROM user_roles ur
     INNER JOIN rol_permisos rp
       ON rp.rol_id = ur.role_id
      AND rp.empresa_id = ?
     INNER JOIN permisos p ON p.id = rp.permiso_id
     WHERE ur.user_id = ?`,
    [empresaId, userId]
  );
  return rows.map(row => row.codigo);
}

async function hasPermission(req, code, connection = db) {
  if (isSuperadmin(req)) return true;
  const permissions = await getEffectivePermissions(req, connection);
  return permissions.includes(code);
}

module.exports = { getEffectivePermissions, hasPermission, isSuperadmin };
