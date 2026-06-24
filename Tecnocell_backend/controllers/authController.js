const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const subscriptionAccess = require('../services/subscriptionAccessService');

// Login
const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = username || email;

    if (!identifier || !password) {
      return res.status(400).json({
        message: 'Usuario/Email y contraseña son requeridos',
      });
    }

    const [users] = await db.query(
      `SELECT
         u.*,
         e.id AS empresa_existente_id,
         e.estado AS empresa_estado
       FROM users u
       LEFT JOIN empresas e ON e.id = u.empresa_id
       WHERE u.username = ? OR u.email = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (!Boolean(user.active)) {
      return res.status(403).json({
        message: 'Tu cuenta está inactiva. Contacta al administrador.',
      });
    }

    const empresaId = user.empresa_id ?? null;
    const tipoUsuario = String(user.tipo_usuario || 'EMPRESA').toUpperCase();
    const esSuperAdmin = Number(user.es_super_admin) === 1;

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

      const acceso = await subscriptionAccess.evaluarAccesoEmpresa(empresaId);
      if (!acceso.permitido) {
        return res.status(403).json({
          code: acceso.code,
          message: subscriptionAccess.mensajeAccesoDenegado(acceso.code),
        });
      }
    }

    const [[perfil]] = await db.query(
      `SELECT
         nombres,
         apellidos,
         telefono,
         dpi,
         direccion,
         foto_perfil,
         firma
       FROM user_profiles
       WHERE user_id = ?`,
      [user.id]
    );

    const [rolesRows] = await db.query(
      `SELECT r.nombre
       FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [user.id]
    );

    const rolesArray = rolesRows.map((role) => role.nombre);
    const rol = esSuperAdmin ? 'superadmin' : user.role;

    const token = jwt.sign(
      {
        userId: user.id,
        empresaId,
        tipoUsuario,
        esSuperAdmin,
        rol,

        // Alias de compatibilidad.
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: rol,
        roles: rolesArray,
        empresa_id: empresaId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await db.query(
      'UPDATE users SET ultimo_login = NOW() WHERE id = ?',
      [user.id]
    );

    return res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: rol,
        roles: rolesArray,
        empresa_id: empresaId,
        tipo_usuario: tipoUsuario,
        es_super_admin: esSuperAdmin,
        perfil: perfil || null,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Logout (opcional, principalmente para limpiar en el frontend)
const logout = (req, res) => {
  res.json({ message: 'Logout exitoso' });
};

// Verificar token.
// La validación criptográfica y la revalidación contra MariaDB ya fueron
// realizadas por authMiddleware.verifyToken.
const verifyToken = (req, res) => {
  return res.json({
    valid: true,
    user: req.user,
  });
};

// GET /api/auth/me — devuelve el usuario autenticado con perfil y roles
const getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const [[user]] = await db.query(
      `SELECT id, username, email, name, role, empresa_id, active,
              tipo_usuario, es_super_admin, ultimo_login, created_at, updated_at
       FROM users WHERE id = ?`,
      [userId]
    );
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const [[perfil]] = await db.query(
      'SELECT nombres, apellidos, telefono, dpi, direccion, foto_perfil, firma FROM user_profiles WHERE user_id = ?',
      [userId]
    );
    const [rolesRows] = await db.query(
      'SELECT r.nombre FROM roles r INNER JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: Number(user.es_super_admin) === 1 ? 'superadmin' : user.role,
        empresa_id: user.empresa_id ?? null,
        tipo_usuario: user.tipo_usuario || 'EMPRESA',
        es_super_admin: Number(user.es_super_admin) === 1,
        active: Boolean(user.active),
        ultimo_login: user.ultimo_login,
        created_at: user.created_at,
        updated_at: user.updated_at,
        perfil: perfil || null,
        roles: rolesRows.map(r => r.nombre),
      }
    });
  } catch (error) {
    console.error('Error en getMe:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// PUT /api/auth/me/perfil — actualiza foto, teléfono, dirección del usuario activo
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { imageFileFilter, getSafeImageExtension } = require('../utils/uploadSecurity');

const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');

const uploadMe = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOADS_BASE, 'usuarios', String(req.user.id), 'perfil');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = getSafeImageExtension(file);
      cb(null, `perfil${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const updateMePerfil = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[updateMePerfil] body keys:', Object.keys(req.body));
    console.log('[updateMePerfil] firma recibida:', req.body.firma ? `[data URL, length=${req.body.firma.length}]` : req.body.firma);
    const { telefono, direccion, nombres, apellidos, firma } = req.body;

    const telefonoFueEnviado = telefono !== undefined;
    let telefonoNormalizado = null;

    if (telefonoFueEnviado) {
      if (typeof telefono !== 'string') {
        return res.status(400).json({
          message: 'El teléfono debe contener únicamente números.',
        });
      }

      telefonoNormalizado = telefono.trim();

      if (telefonoNormalizado && !/^\d{8,15}$/.test(telefonoNormalizado)) {
        return res.status(400).json({
          message: 'El teléfono debe contener entre 8 y 15 dígitos.',
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (nombres !== undefined) { updateFields.push('nombres = ?'); updateValues.push(nombres || null); }
    if (apellidos !== undefined) { updateFields.push('apellidos = ?'); updateValues.push(apellidos || null); }
    if (telefonoFueEnviado) {
      updateFields.push('telefono = ?');
      updateValues.push(telefonoNormalizado || null);
    }
    if (direccion !== undefined) { updateFields.push('direccion = ?'); updateValues.push(direccion || null); }
    const firmaFueEnviada =
      firma !== undefined &&
      firma !== null &&
      String(firma).trim() !== '';

    if (firmaFueEnviada) {
      updateFields.push('firma = ?');
      updateValues.push(String(firma).trim());
    }
    if (req.file) {
      const foto_perfil = `/uploads/usuarios/${userId}/perfil/${req.file.filename}`;
      updateFields.push('foto_perfil = ?');
      updateValues.push(foto_perfil);
    }

    if (updateFields.length > 0) {
      // Ensure row exists
      await db.query(
        'INSERT INTO user_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id',
        [userId]
      );
      await db.query(
        `UPDATE user_profiles SET ${updateFields.join(', ')} WHERE user_id = ?`,
        [...updateValues, userId]
      );
    }

    const [[perfil]] = await db.query(
      'SELECT nombres, apellidos, telefono, dpi, direccion, foto_perfil, firma FROM user_profiles WHERE user_id = ?',
      [userId]
    );
    res.json({ success: true, data: { perfil: perfil || null } });
  } catch (error) {
    console.error('Error en updateMePerfil:', error);
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
};

module.exports = {
  login,
  logout,
  verifyToken,
  getMe,
  updateMePerfil,
  uploadMe,
};
