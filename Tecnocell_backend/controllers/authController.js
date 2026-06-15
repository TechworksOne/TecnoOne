const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Login
const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = username || email; // Aceptar username o email

    // Validar datos
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Usuario/Email y contraseña son requeridos' });
    }

    // Buscar usuario en la base de datos por username o email
    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = users[0];

    // Bloquear usuarios inactivos
    if (!user.active) {
      return res.status(401).json({ message: 'Tu cuenta está inactiva. Contacta al administrador.' });
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Obtener perfil y roles del sistema de roles nuevo
    const [[perfil]] = await db.query(
      'SELECT nombres, apellidos, telefono, dpi, direccion, foto_perfil, firma FROM user_profiles WHERE user_id = ?',
      [user.id]
    );
    const [rolesRows] = await db.query(
      `SELECT r.nombre FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [user.id]
    );
    const rolesArray = rolesRows.map(r => r.nombre);
    const empresaId = user.empresa_id ?? null;

    // Generar token JWT (incluye roles para middleware)
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        roles: rolesArray,
        empresa_id: empresaId
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Actualizar ultimo_login
    await db.query('UPDATE users SET ultimo_login = NOW() WHERE id = ?', [user.id]);

    // Enviar respuesta (sin enviar la contraseña)
    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: rolesArray,
        empresa_id: empresaId,
        perfil: perfil || null,
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Logout (opcional, principalmente para limpiar en el frontend)
const logout = (req, res) => {
  res.json({ message: 'Logout exitoso' });
};

// Verificar token
const verifyToken = (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(403).json({ message: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, message: 'Token inválido' });
  }
};

// GET /api/auth/me — devuelve el usuario autenticado con perfil y roles
const getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const [[user]] = await db.query(
      'SELECT id, username, email, name, role, empresa_id, active, ultimo_login, created_at, updated_at FROM users WHERE id = ?',
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
        role: user.role,
        empresa_id: user.empresa_id ?? null,
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
    const updateFields = [];
    const updateValues = [];

    if (nombres !== undefined) { updateFields.push('nombres = ?'); updateValues.push(nombres || null); }
    if (apellidos !== undefined) { updateFields.push('apellidos = ?'); updateValues.push(apellidos || null); }
    if (telefono !== undefined) { updateFields.push('telefono = ?'); updateValues.push(telefono || null); }
    if (direccion !== undefined) { updateFields.push('direccion = ?'); updateValues.push(direccion || null); }
    if (firma !== undefined) { updateFields.push('firma = ?'); updateValues.push(firma || null); }
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
