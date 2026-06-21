const db = require('../config/database');

async function verifySuperAdmin(req, res, next) {
  try {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const [[user]] = await db.query(
      `SELECT id, username, email, name, role, empresa_id, active,
              tipo_usuario, es_super_admin
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    const authorized =
      user &&
      Boolean(user.active) &&
      user.tipo_usuario === 'PLATAFORMA' &&
      Number(user.es_super_admin) === 1 &&
      user.empresa_id === null;

    if (!authorized) {
      return res.status(403).json({ message: 'Acceso exclusivo para SUPER_ADMIN' });
    }

    req.superAdmin = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
    };
    return next();
  } catch (error) {
    console.error('verifySuperAdmin error:', error);
    return res.status(500).json({ message: 'Error al validar acceso de plataforma' });
  }
}

module.exports = { verifySuperAdmin };
