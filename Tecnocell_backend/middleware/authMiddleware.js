const jwt = require('jsonwebtoken');
const db = require('../config/database');

const ESTADOS_EMPRESA_PERMITIDOS = new Set(['activa', 'prueba', 'demo']);

function empresaNoDisponible(res, estado = '') {
  const estadoNormalizado = String(estado || '').toLowerCase();

  if (estadoNormalizado === 'suspendida') {
    return res.status(403).json({
      message: 'La empresa se encuentra suspendida',
    });
  }

  if (estadoNormalizado === 'cancelada') {
    return res.status(403).json({
      message: 'La empresa se encuentra cancelada',
    });
  }

  return res.status(403).json({
    message: 'La empresa no se encuentra disponible',
  });
}

function normalizarEmpresaId(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

// Verifica la firma del JWT y revalida el usuario contra MariaDB.
// Esto permite revocar acceso inmediatamente al desactivar el usuario
// o suspender/cancelar su empresa.
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(403).json({ message: 'Token no proporcionado' });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      message: 'Token inválido o expirado',
    });
  }

  try {
    const decodedUserId = Number(decoded.userId ?? decoded.id);

    if (!Number.isInteger(decodedUserId) || decodedUserId <= 0) {
      return res.status(401).json({
        message: 'Token inválido o expirado',
      });
    }

    const [rows] = await db.query(
      `SELECT
         u.id,
         u.username,
         u.email,
         u.name,
         u.role,
         u.empresa_id,
         u.active,
         u.tipo_usuario,
         u.es_super_admin,
         e.id AS empresa_existente_id,
         e.estado AS empresa_estado,
         (
           SELECT GROUP_CONCAT(
             DISTINCT r.nombre
             ORDER BY r.nombre
             SEPARATOR ','
           )
           FROM user_roles ur
           INNER JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id
         ) AS roles_csv
       FROM users u
       LEFT JOIN empresas e ON e.id = u.empresa_id
       WHERE u.id = ?
       LIMIT 1`,
      [decodedUserId]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        message: 'El usuario ya no existe',
      });
    }

    const user = rows[0];

    if (!Boolean(user.active)) {
      return res.status(403).json({
        message: 'El usuario se encuentra inactivo',
      });
    }

    const tipoUsuario = String(user.tipo_usuario || 'EMPRESA').toUpperCase();
    const esSuperAdmin = Number(user.es_super_admin) === 1;
    const empresaId = normalizarEmpresaId(user.empresa_id);

    const tokenTipoUsuario = String(
      decoded.tipoUsuario ?? decoded.tipo_usuario ?? 'EMPRESA'
    ).toUpperCase();

    const tokenEsSuperAdmin = Boolean(
      decoded.esSuperAdmin ?? decoded.es_super_admin
    );

    const tokenEmpresaId = normalizarEmpresaId(
      decoded.empresaId ?? decoded.empresa_id
    );

    const alcanceCoincide =
      tokenTipoUsuario === tipoUsuario &&
      tokenEsSuperAdmin === esSuperAdmin &&
      tokenEmpresaId === empresaId;

    if (!alcanceCoincide) {
      return res.status(403).json({
        message: 'El alcance del token ya no es válido',
      });
    }

    if (tipoUsuario === 'PLATAFORMA' || esSuperAdmin) {
      const plataformaValida =
        tipoUsuario === 'PLATAFORMA' &&
        esSuperAdmin &&
        empresaId === null;

      if (!plataformaValida) {
        return res.status(403).json({
          message: 'La cuenta de plataforma no tiene una configuración válida',
        });
      }
    } else {
      const usuarioEmpresarialValido =
        tipoUsuario === 'EMPRESA' &&
        !esSuperAdmin &&
        empresaId !== null &&
        user.empresa_existente_id !== null;

      if (!usuarioEmpresarialValido) {
        return res.status(403).json({
          message: 'El usuario no tiene una empresa válida asignada',
        });
      }

      const estadoEmpresa = String(user.empresa_estado || '').toLowerCase();

      if (!ESTADOS_EMPRESA_PERMITIDOS.has(estadoEmpresa)) {
        return empresaNoDisponible(res, estadoEmpresa);
      }
    }

    const roles = user.roles_csv
      ? String(user.roles_csv)
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean)
      : [];

    const role = esSuperAdmin ? 'superadmin' : user.role;

    req.user = {
      ...decoded,

      // Identidad y alcance autoritativos obtenidos de MariaDB.
      id: user.id,
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name,

      role,
      rol: role,
      roles,

      empresa_id: empresaId,
      empresaId,

      tipo_usuario: tipoUsuario,
      tipoUsuario,

      es_super_admin: esSuperAdmin,
      esSuperAdmin,
    };

    return next();
  } catch (error) {
    console.error('Error revalidando token contra MariaDB:', error);

    return res.status(500).json({
      message: 'Error verificando la sesión',
    });
  }
};

// Middleware para verificar roles.
const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const userRoles = Array.isArray(req.user.roles)
      ? req.user.roles
      : [];

    const hasRole = allowedRoles.some(
      (allowedRole) =>
        userRoles.includes(allowedRole) ||
        req.user.role === allowedRole
    );

    if (!hasRole) {
      return res.status(403).json({
        message: 'No tienes permisos para esta acción',
      });
    }

    return next();
  };
};

module.exports = { verifyToken, verifyRole };
