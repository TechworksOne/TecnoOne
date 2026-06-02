const bcrypt = require('bcrypt');
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');

// ── Multer: temp storage para fotos de perfil ──────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempPath = path.join(UPLOADS_BASE, 'usuarios', 'temp');
    fs.mkdirSync(tempPath, { recursive: true });
    cb(null, tempPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `perfil_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.upload = upload;

// ── Helper: mover foto de temp a ubicación final ───────────────────────────
function moverFoto(tempFilePath, userId) {
  const destDir = path.join(UPLOADS_BASE, 'usuarios', String(userId), 'perfil');
  fs.mkdirSync(destDir, { recursive: true });
  const ext = path.extname(tempFilePath);
  const destFile = path.join(destDir, `perfil${ext}`);
  // Eliminar foto previa si existe
  try {
    const prevFiles = fs.readdirSync(destDir);
    prevFiles.forEach(f => fs.unlinkSync(path.join(destDir, f)));
  } catch (_) {}
  fs.renameSync(tempFilePath, destFile);
  return `/uploads/usuarios/${userId}/perfil/perfil${ext}`;
}

// ── GET /api/admin/usuarios ────────────────────────────────────────────────
exports.getUsuarios = async (req, res) => {
  try {
    const { buscar, rol, estado } = req.query;

    let where = '';
    const params = [];

    const conditions = [];
    if (buscar) {
      conditions.push(`(u.username LIKE ? OR u.email LIKE ? OR p.nombres LIKE ? OR p.apellidos LIKE ? OR p.telefono LIKE ?)`);
      const like = `%${buscar}%`;
      params.push(like, like, like, like, like);
    }
    if (estado !== undefined && estado !== '') {
      conditions.push(`u.active = ?`);
      params.push(estado === '1' || estado === 'true' ? 1 : 0);
    }
    if (conditions.length) where = 'WHERE ' + conditions.join(' AND ');

    const [rows] = await db.query(
      `SELECT
         u.id, u.username, u.email, u.active, u.ultimo_login, u.created_at,
         p.nombres, p.apellidos, p.telefono, p.dpi, p.direccion, p.foto_perfil,
         GROUP_CONCAT(r.nombre ORDER BY r.nombre SEPARATOR ',') AS roles
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      params
    );

    let result = rows.map(u => ({
      ...u,
      roles: u.roles ? u.roles.split(',') : [],
      active: Boolean(u.active),
    }));

    // Filtrar por rol en JS (GROUP_CONCAT dificulta el WHERE)
    if (rol) {
      result = result.filter(u => u.roles.includes(rol.toUpperCase()));
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('getUsuarios error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/admin/usuarios/:id ───────────────────────────────────────────
exports.getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const [[user]] = await db.query(
      `SELECT
         u.id, u.username, u.email, u.active, u.ultimo_login, u.created_at,
         p.nombres, p.apellidos, p.telefono, p.dpi, p.direccion, p.foto_perfil,
         GROUP_CONCAT(r.nombre ORDER BY r.nombre SEPARATOR ',') AS roles
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = ?
       GROUP BY u.id`,
      [id]
    );
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    res.json({
      success: true,
      data: { ...user, roles: user.roles ? user.roles.split(',') : [], active: Boolean(user.active) },
    });
  } catch (error) {
    console.error('getUsuarioById error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/admin/usuarios ──────────────────────────────────────────────
exports.createUsuario = async (req, res) => {
  let tempFilePath = null;
  try {
    const { username, email, password, nombres, apellidos, telefono, dpi, direccion, roles } = req.body;

    if (!password) return res.status(400).json({ success: false, message: 'La contraseña es requerida' });
    if (!nombres) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    if (!username && !email) return res.status(400).json({ success: false, message: 'Se requiere usuario o email' });

    const rolesArray = Array.isArray(roles)
      ? roles
      : typeof roles === 'string'
      ? roles.split(',').map(r => r.trim()).filter(Boolean)
      : [];

    if (!rolesArray.length) return res.status(400).json({ success: false, message: 'Se requiere al menos un rol' });

    // Verificar unicidad
    if (username) {
      const [[ex]] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
      if (ex) return res.status(400).json({ success: false, message: 'El nombre de usuario ya está en uso' });
    }
    if (email) {
      const [[ex]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (ex) return res.status(400).json({ success: false, message: 'El email ya está registrado' });
    }

    if (req.file) tempFilePath = req.file.path;

    const hashedPassword = await bcrypt.hash(password, 10);
    const legacyRole = rolesArray.includes('ADMINISTRADOR') ? 'admin' : 'employee';

    const [result] = await db.query(
      `INSERT INTO users (username, email, password, name, telefono, role, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [username || null, email || null, hashedPassword, nombres + (apellidos ? ' ' + apellidos : ''), telefono || null, legacyRole]
    );
    const userId = result.insertId;

    // Mover foto si hay
    let fotoPerfil = null;
    if (tempFilePath) {
      fotoPerfil = moverFoto(tempFilePath, userId);
      tempFilePath = null;
    }

    // Insertar perfil
    await db.query(
      `INSERT INTO user_profiles (user_id, nombres, apellidos, telefono, dpi, direccion, foto_perfil)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, nombres, apellidos || null, telefono || null, dpi || null, direccion || null, fotoPerfil]
    );

    // Insertar roles
    if (rolesArray.length) {
      const [roleRows] = await db.query(`SELECT id, nombre FROM roles WHERE nombre IN (${rolesArray.map(() => '?').join(',')})`, rolesArray);
      for (const r of roleRows) {
        await db.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, r.id]);
      }
    }

    res.status(201).json({ success: true, message: 'Usuario creado exitosamente', data: { id: userId } });
  } catch (error) {
    if (tempFilePath) try { fs.unlinkSync(tempFilePath); } catch (_) {}
    console.error('createUsuario error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PUT /api/admin/usuarios/:id ───────────────────────────────────────────
exports.updateUsuario = async (req, res) => {
  let tempFilePath = null;
  try {
    const { id } = req.params;
    const { username, email, nombres, apellidos, telefono, dpi, direccion, roles, active } = req.body;

    const [[existing]] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    if (req.file) tempFilePath = req.file.path;

    // Unicidad
    if (username) {
      const [[ex]] = await db.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
      if (ex) return res.status(400).json({ success: false, message: 'El nombre de usuario ya está en uso' });
    }
    if (email) {
      const [[ex]] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (ex) return res.status(400).json({ success: false, message: 'El email ya está registrado' });
    }

    const rolesArray = Array.isArray(roles)
      ? roles
      : typeof roles === 'string'
      ? roles.split(',').map(r => r.trim()).filter(Boolean)
      : [];

    // Update users table
    const userFields = [];
    const userParams = [];
    if (username !== undefined) { userFields.push('username = ?'); userParams.push(username || null); }
    if (email !== undefined) { userFields.push('email = ?'); userParams.push(email || null); }
    if (nombres !== undefined) {
      userFields.push('name = ?');
      userParams.push(nombres + (apellidos ? ' ' + apellidos : ''));
    }
    if (telefono !== undefined) { userFields.push('telefono = ?'); userParams.push(telefono || null); }
    if (active !== undefined) { userFields.push('active = ?'); userParams.push(active === true || active === 'true' || active === 1 ? 1 : 0); }

    if (rolesArray.length) {
      const legacyRole = rolesArray.includes('ADMINISTRADOR') ? 'admin' : 'employee';
      userFields.push('role = ?');
      userParams.push(legacyRole);
    }

    if (userFields.length) {
      await db.query(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, [...userParams, id]);
    }

    // Mover foto
    let fotoPerfil = undefined;
    if (tempFilePath) {
      fotoPerfil = moverFoto(tempFilePath, id);
      tempFilePath = null;
    }

    // Upsert user_profiles
    const profileFields = [];
    const profileParams = [];
    if (nombres !== undefined) { profileFields.push('nombres = ?'); profileParams.push(nombres); }
    if (apellidos !== undefined) { profileFields.push('apellidos = ?'); profileParams.push(apellidos || null); }
    if (telefono !== undefined) { profileFields.push('telefono = ?'); profileParams.push(telefono || null); }
    if (dpi !== undefined) { profileFields.push('dpi = ?'); profileParams.push(dpi || null); }
    if (direccion !== undefined) { profileFields.push('direccion = ?'); profileParams.push(direccion || null); }
    if (fotoPerfil !== undefined) { profileFields.push('foto_perfil = ?'); profileParams.push(fotoPerfil); }

    if (profileFields.length) {
      await db.query(
        `INSERT INTO user_profiles (user_id, nombres) VALUES (?, ?) ON DUPLICATE KEY UPDATE ${profileFields.join(', ')}`,
        [id, nombres || 'Usuario', ...profileParams]
      );
    }

    // Update roles
    if (rolesArray.length) {
      await db.query('DELETE FROM user_roles WHERE user_id = ?', [id]);
      const [roleRows] = await db.query(`SELECT id, nombre FROM roles WHERE nombre IN (${rolesArray.map(() => '?').join(',')})`, rolesArray);
      for (const r of roleRows) {
        await db.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, r.id]);
      }
    }

    res.json({ success: true, message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    if (tempFilePath) try { fs.unlinkSync(tempFilePath); } catch (_) {}
    console.error('updateUsuario error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/admin/usuarios/:id/estado ─────────────────────────────────
exports.toggleEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const [[user]] = await db.query('SELECT id, active, role FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // Verificar: no desactivar al único admin activo
    if (user.active && user.role === 'admin') {
      const [[adminCount]] = await db.query(
        'SELECT COUNT(*) as cnt FROM users WHERE role = ? AND active = 1 AND id != ?',
        ['admin', id]
      );
      if (adminCount.cnt === 0) {
        return res.status(400).json({ success: false, message: 'No se puede desactivar al único administrador activo' });
      }
    }

    // No permitir que el usuario se desactive a sí mismo si es el único admin
    if (req.user && req.user.id === Number(id) && user.role === 'admin') {
      const [[adminCount]] = await db.query(
        'SELECT COUNT(*) as cnt FROM users WHERE role = ? AND active = 1 AND id != ?',
        ['admin', id]
      );
      if (adminCount.cnt === 0) {
        return res.status(400).json({ success: false, message: 'No puedes desactivarte a ti mismo si eres el único administrador' });
      }
    }

    const newActive = user.active ? 0 : 1;
    await db.query('UPDATE users SET active = ? WHERE id = ?', [newActive, id]);
    res.json({ success: true, message: newActive ? 'Usuario activado' : 'Usuario desactivado', data: { active: Boolean(newActive) } });
  } catch (error) {
    console.error('toggleEstado error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/admin/usuarios/:id/password ────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (error) {
    console.error('changePassword error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/admin/roles ──────────────────────────────────────────────────
exports.getRoles = async (req, res) => {
  try {
    const [roles] = await db.query(
      `SELECT r.*, COUNT(ur.user_id) as total_usuarios
       FROM roles r
       LEFT JOIN user_roles ur ON ur.role_id = r.id
       GROUP BY r.id
       ORDER BY r.nombre`
    );
    res.json({ success: true, data: roles.map(r => ({ ...r, activo: Boolean(r.activo) })) });
  } catch (error) {
    console.error('getRoles error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/admin/roles ─────────────────────────────────────────────────
exports.createRol = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ success: false, message: 'El nombre del rol es requerido' });

    const [[ex]] = await db.query('SELECT id FROM roles WHERE nombre = ?', [nombre.toUpperCase()]);
    if (ex) return res.status(400).json({ success: false, message: 'Ya existe un rol con ese nombre' });

    const [result] = await db.query(
      'INSERT INTO roles (nombre, descripcion) VALUES (?, ?)',
      [nombre.toUpperCase(), descripcion || null]
    );
    res.status(201).json({ success: true, message: 'Rol creado', data: { id: result.insertId } });
  } catch (error) {
    console.error('createRol error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PUT /api/admin/roles/:id ──────────────────────────────────────────────
exports.updateRol = async (req, res) => {
  try {
    const { id } = req.params;
    const { descripcion, activo } = req.body;

    const [[existing]] = await db.query('SELECT id FROM roles WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Rol no encontrado' });

    const fields = [];
    const params = [];
    if (descripcion !== undefined) { fields.push('descripcion = ?'); params.push(descripcion); }
    if (activo !== undefined) { fields.push('activo = ?'); params.push(activo ? 1 : 0); }

    if (fields.length) {
      await db.query(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    }
    res.json({ success: true, message: 'Rol actualizado' });
  } catch (error) {
    console.error('updateRol error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
