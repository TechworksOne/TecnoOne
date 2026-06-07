const bcrypt = require('bcrypt');
const db = require('../config/database');

const VALID_USER_ROLES = ['admin', 'employee', 'tecnico'];

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? null;
}

function userTenantClause(req, alias = 'u') {
  if (isSuperadminTenant(req)) {
    return { sql: '', params: [] };
  }

  const empresaId = getTenantEmpresaId(req);
  if (empresaId == null) {
    throw new Error('Empresa no asignada al usuario');
  }

  const prefix = alias ? `${alias}.` : '';
  return { sql: ` AND ${prefix}empresa_id = ?`, params: [empresaId] };
}

async function validateEmpresaExists(connectionOrDb, empresaId) {
  if (empresaId == null) {
    return false;
  }

  const [[empresa]] = await connectionOrDb.query(
    'SELECT id FROM empresas WHERE id = ? LIMIT 1',
    [empresaId]
  );

  return Boolean(empresa);
}

function normalizeEmpresaId(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }

  const empresaId = Number(value);
  return Number.isInteger(empresaId) && empresaId > 0 ? empresaId : NaN;
}

function normalizeUserRole(role) {
  const normalizedRole = role || 'employee';
  return VALID_USER_ROLES.includes(normalizedRole) ? normalizedRole : null;
}

// Obtener todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const tenant = userTenantClause(req, 'u');
    const [users] = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.empresa_id, u.created_at
       FROM users u
       WHERE 1=1${tenant.sql}`,
      tenant.params
    );
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
};

// Obtener usuario por ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = userTenantClause(req, 'u');
    const [users] = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.empresa_id, u.created_at
       FROM users u
       WHERE u.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
};

// Crear nuevo usuario
const createUser = async (req, res) => {
  try {
    const { email, password, name, role, empresa_id } = req.body;

    // Validar datos
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    // Verificar si el email ya existe
    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'El email ya esta registrado' });
    }

    const legacyRole = normalizeUserRole(role);
    let empresaId;

    if (!legacyRole) {
      return res.status(400).json({ message: 'Rol invalido' });
    }

    if (isSuperadminTenant(req)) {
      empresaId = normalizeEmpresaId(empresa_id);
      if (Number.isNaN(empresaId)) {
        return res.status(400).json({ message: 'Empresa invalida' });
      }
      if (empresaId == null && legacyRole !== 'superadmin') {
        return res.status(400).json({ message: 'Empresa requerida para este usuario' });
      }
      if (empresaId != null && !(await validateEmpresaExists(db, empresaId))) {
        return res.status(400).json({ message: 'Empresa no encontrada' });
      }
    } else {
      empresaId = getTenantEmpresaId(req);
      if (empresaId == null) {
        return res.status(403).json({ message: 'Empresa no asignada al usuario' });
      }
    }

    // Encriptar contrasena
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario
    const [result] = await db.query(
      'INSERT INTO users (email, password, name, role, empresa_id) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, name, legacyRole, empresaId]
    );

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
};

// Actualizar usuario
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, role, password, empresa_id } = req.body;

    // Verificar que el usuario existe dentro del tenant permitido
    const tenant = userTenantClause(req, null);
    const [users] = await db.query(
      `SELECT id, role, empresa_id FROM users WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const currentUser = users[0];

    // Construir query dinamico
    let query = 'UPDATE users SET ';
    const params = [];

    if (email) {
      query += 'email = ?, ';
      params.push(email);
    }
    if (name) {
      query += 'name = ?, ';
      params.push(name);
    }
    if (role) {
      const legacyRole = normalizeUserRole(role);
      if (!legacyRole) {
        return res.status(400).json({ message: 'Rol invalido' });
      }
      query += 'role = ?, ';
      params.push(legacyRole);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += 'password = ?, ';
      params.push(hashedPassword);
    }

    if (isSuperadminTenant(req) && empresa_id !== undefined) {
      const empresaId = normalizeEmpresaId(empresa_id);
      const finalRole = role || currentUser.role;
      if (Number.isNaN(empresaId)) {
        return res.status(400).json({ message: 'Empresa invalida' });
      }
      if (empresaId == null && finalRole !== 'superadmin') {
        return res.status(400).json({ message: 'Empresa requerida para este usuario' });
      }
      if (empresaId != null && !(await validateEmpresaExists(db, empresaId))) {
        return res.status(400).json({ message: 'Empresa no encontrada' });
      }
      query += 'empresa_id = ?, ';
      params.push(empresaId);
    } else if (!isSuperadminTenant(req) && empresa_id !== undefined) {
      return res.status(403).json({ message: 'No tienes permisos para cambiar empresa_id' });
    } else if (isSuperadminTenant(req) && role && role !== 'superadmin' && currentUser.empresa_id == null) {
      return res.status(400).json({ message: 'Empresa requerida para este usuario' });
    }

    if (params.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    // Remover ultima coma y espacio
    query = query.slice(0, -2);
    query += ` WHERE id = ?${tenant.sql}`;
    params.push(id, ...tenant.params);

    await db.query(query, params);

    res.json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
};

// Eliminar usuario
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = userTenantClause(req, null);

    const [result] = await db.query(
      `DELETE FROM users WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
