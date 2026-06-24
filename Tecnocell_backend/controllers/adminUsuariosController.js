const bcrypt = require('bcrypt');
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { imageFileFilter, getSafeImageExtension } = require('../utils/uploadSecurity');
const { validatePhone } = require('../utils/phoneValidation');
const auditoriaService = require('../services/auditoriaService');
const planAccess = require('../services/planAccessService');

const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');

function sendPlanLimitError(res, error) {
  const response =
    planAccess.planLimitErrorResponse(error);

  if (!response) {
    return false;
  }

  res.status(response.status).json(response.body);
  return true;
}


function addTenantCondition(req, conditions, params, alias = 'u') {
  if (!req.tenant?.isSuperadmin) {
    conditions.push(`${alias}.empresa_id = ?`);
    params.push(req.tenant.empresa_id);
  }
}

const USER_SELECT_WHITELIST = new Map([
  ['id', 'id'],
  ['basic', 'id, active, role, empresa_id'],
]);

function scopedUserExistsQuery(req, id, select = 'id') {
  const safeSelect = USER_SELECT_WHITELIST.get(select) || USER_SELECT_WHITELIST.get('id');
  const params = [id];
  let query = `SELECT ${safeSelect} FROM users WHERE id = ?`;

  if (!req.tenant?.isSuperadmin) {
    query += ' AND empresa_id = ?';
    params.push(req.tenant.empresa_id);
  }

  return { query, params };
}

// ── Multer: temp storage para fotos de perfil ──────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempPath = path.join(UPLOADS_BASE, 'usuarios', 'temp');
    fs.mkdirSync(tempPath, { recursive: true });
    cb(null, tempPath);
  },
  filename: (req, file, cb) => {
    const ext = getSafeImageExtension(file);
    cb(null, `perfil_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
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
    addTenantCondition(req, conditions, params);
    if (conditions.length) where = 'WHERE ' + conditions.join(' AND ');

    const [rows] = await db.query(
      `SELECT
         u.id, u.username, u.email, u.empresa_id, u.active, u.ultimo_login, u.created_at,
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
    const conditions = ['u.id = ?'];
    const params = [id];
    addTenantCondition(req, conditions, params);

    const [[user]] = await db.query(
      `SELECT
         u.id, u.username, u.email, u.empresa_id, u.active, u.ultimo_login, u.created_at,
         p.nombres, p.apellidos, p.telefono, p.dpi, p.direccion, p.foto_perfil,
         GROUP_CONCAT(r.nombre ORDER BY r.nombre SEPARATOR ',') AS roles
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.id`,
      params
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
  let movedPhotoDiskPath = null;
  let connection = null;

  try {
    const {
      username,
      email,
      password,
      nombres,
      apellidos,
      telefono,
      dpi,
      direccion,
      roles,
      empresa_id
    } = req.body;

    if (req.file) {
      tempFilePath = req.file.path;
    }

    const cleanupTempFile = () => {
      if (!tempFilePath) {
        return;
      }

      try {
        fs.unlinkSync(tempFilePath);
      } catch (_) {}

      tempFilePath = null;
    };

    const telefonoValidado =
      validatePhone(telefono);

    if (!telefonoValidado.ok) {
      cleanupTempFile();

      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const telefonoNormalizado =
      telefonoValidado.value;

    if (!password) {
      cleanupTempFile();

      return res.status(400).json({
        success: false,
        message: 'La contraseña es requerida'
      });
    }

    if (!nombres) {
      cleanupTempFile();

      return res.status(400).json({
        success: false,
        message: 'El nombre es requerido'
      });
    }

    if (!username && !email) {
      cleanupTempFile();

      return res.status(400).json({
        success: false,
        message: 'Se requiere usuario o email'
      });
    }

    const rolesArray = Array.isArray(roles)
      ? roles
      : typeof roles === 'string'
        ? roles
            .split(',')
            .map(role => role.trim())
            .filter(Boolean)
        : [];

    if (!rolesArray.length) {
      cleanupTempFile();

      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos un rol'
      });
    }

    const empresaId = req.tenant?.isSuperadmin
      ? Number(empresa_id)
      : Number(req.tenant?.empresa_id);

    if (
      !Number.isInteger(empresaId) ||
      empresaId <= 0
    ) {
      cleanupTempFile();

      return res.status(400).json({
        success: false,
        message: 'Empresa no válida'
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    connection = await db.getConnection();
    await connection.beginTransaction();

    if (username) {
      const [[duplicateUsername]] =
        await connection.query(
          `SELECT id
           FROM users
           WHERE username = ?
           LIMIT 1`,
          [username]
        );

      if (duplicateUsername) {
        await connection.rollback();
        cleanupTempFile();

        return res.status(400).json({
          success: false,
          message:
            'El nombre de usuario ya está en uso'
        });
      }
    }

    if (email) {
      const [[duplicateEmail]] =
        await connection.query(
          `SELECT id
           FROM users
           WHERE email = ?
           LIMIT 1`,
          [email]
        );

      if (duplicateEmail) {
        await connection.rollback();
        cleanupTempFile();

        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado'
        });
      }
    }

    await planAccess.validarLimiteUsuarios(
      empresaId,
      connection
    );

    const legacyRole = rolesArray.includes(
      'ADMINISTRADOR'
    )
      ? 'admin'
      : 'employee';

    const [result] = await connection.query(
      `INSERT INTO users (
         username,
         email,
         password,
         name,
         telefono,
         role,
         tipo_usuario,
         es_super_admin,
         empresa_id,
         active
       )
       VALUES (
         ?, ?, ?, ?, ?, ?,
         'EMPRESA', 0, ?, 1
       )`,
      [
        username || null,
        email || null,
        hashedPassword,
        nombres + (
          apellidos
            ? ` ${apellidos}`
            : ''
        ),
        telefonoNormalizado || null,
        legacyRole,
        empresaId
      ]
    );

    const userId = result.insertId;
    let fotoPerfil = null;

    if (tempFilePath) {
      fotoPerfil = moverFoto(
        tempFilePath,
        userId
      );

      tempFilePath = null;

      movedPhotoDiskPath = path.join(
        __dirname,
        '..',
        fotoPerfil.replace(/^\/+/, '')
      );
    }

    await connection.query(
      `INSERT INTO user_profiles (
         user_id,
         nombres,
         apellidos,
         telefono,
         dpi,
         direccion,
         foto_perfil
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        nombres,
        apellidos || null,
        telefonoNormalizado || null,
        dpi || null,
        direccion || null,
        fotoPerfil
      ]
    );

    const placeholders = rolesArray
      .map(() => '?')
      .join(',');

    const [roleRows] =
      await connection.query(
        `SELECT id, nombre
         FROM roles
         WHERE nombre IN (${placeholders})`,
        rolesArray
      );

    for (const roleRow of roleRows) {
      await connection.query(
        `INSERT IGNORE INTO user_roles (
           user_id,
           role_id
         )
         VALUES (?, ?)`,
        [userId, roleRow.id]
      );
    }

    await connection.commit();

    movedPhotoDiskPath = null;

    try {
      await auditoriaService.registrar({
        req,
        empresaId,
        accion: 'CREAR',
        entidad: 'USUARIO',
        entidadId: userId,
        descripcion:
          `Usuario ${
            username ||
            email ||
            userId
          } creado`,
        datosNuevos: {
          username,
          email,
          nombres,
          apellidos,
          telefono:
            telefonoNormalizado,
          dpi,
          direccion,
          roles: rolesArray
        },
      });
    } catch (auditError) {
      console.error(
        'Auditoría createUsuario error:',
        auditError
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        id: userId
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (_) {}
    }

    if (movedPhotoDiskPath) {
      try {
        fs.unlinkSync(movedPhotoDiskPath);
      } catch (_) {}
    }

    if (sendPlanLimitError(res, error)) {
      return;
    }

    console.error(
      'createUsuario error:',
      error
    );

    return res.status(
      Number(error.statusCode || 500)
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : 'Error al crear el usuario'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ── PUT /api/admin/usuarios/:id ───────────────────────────────────────────
exports.updateUsuario = async (req, res) => {
  let tempFilePath = null;
  let connection = null;
  let committed = false;

  try {
    const { id } = req.params;

    const {
      username,
      email,
      nombres,
      apellidos,
      telefono,
      dpi,
      direccion,
      roles,
      active
    } = req.body;

    if (req.file) {
      tempFilePath = req.file.path;
    }

    const telefonoValidado =
      validatePhone(telefono);

    if (!telefonoValidado.ok) {
      if (tempFilePath) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (_) {}

        tempFilePath = null;
      }

      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const telefonoNormalizado =
      telefonoValidado.value;

    const rolesArray = Array.isArray(roles)
      ? roles
      : typeof roles === 'string'
        ? roles
            .split(',')
            .map(role => role.trim())
            .filter(Boolean)
        : [];

    connection = await db.getConnection();
    await connection.beginTransaction();

    const existingScope =
      scopedUserExistsQuery(
        req,
        id,
        'basic'
      );

    let [[existing]] =
      await connection.query(
        existingScope.query,
        existingScope.params
      );

    if (!existing) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (username) {
      const [[duplicateUsername]] =
        await connection.query(
          `SELECT id
           FROM users
           WHERE username = ?
             AND id != ?
           LIMIT 1`,
          [username, id]
        );

      if (duplicateUsername) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            'El nombre de usuario ya está en uso'
        });
      }
    }

    if (email) {
      const [[duplicateEmail]] =
        await connection.query(
          `SELECT id
           FROM users
           WHERE email = ?
             AND id != ?
           LIMIT 1`,
          [email, id]
        );

      if (duplicateEmail) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado'
        });
      }
    }

    const requestedActive =
      active === undefined
        ? null
        : (
            active === true ||
            active === 'true' ||
            active === 1 ||
            active === '1'
              ? 1
              : 0
          );

    const activatingUser =
      requestedActive === 1 &&
      !Boolean(existing.active) &&
      existing.empresa_id !== null;

    if (activatingUser) {
      await planAccess.obtenerPlanEmpresaBloqueado(
        existing.empresa_id,
        connection
      );
    }

    const [[lockedExisting]] =
      await connection.query(
        `${existingScope.query} FOR UPDATE`,
        existingScope.params
      );

    if (!lockedExisting) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (
      requestedActive === 1 &&
      !Boolean(lockedExisting.active) &&
      lockedExisting.empresa_id !== null
    ) {
      await planAccess.validarLimiteUsuarios(
        lockedExisting.empresa_id,
        connection
      );
    }

    existing = lockedExisting;

    const userFields = [];
    const userParams = [];

    if (username !== undefined) {
      userFields.push('username = ?');
      userParams.push(username || null);
    }

    if (email !== undefined) {
      userFields.push('email = ?');
      userParams.push(email || null);
    }

    if (nombres !== undefined) {
      userFields.push('name = ?');

      userParams.push(
        nombres + (
          apellidos
            ? ` ${apellidos}`
            : ''
        )
      );
    }

    if (telefono !== undefined) {
      userFields.push('telefono = ?');
      userParams.push(telefonoNormalizado);
    }

    if (requestedActive !== null) {
      userFields.push('active = ?');
      userParams.push(requestedActive);
    }

    if (rolesArray.length) {
      const legacyRole =
        rolesArray.includes('ADMINISTRADOR')
          ? 'admin'
          : 'employee';

      userFields.push('role = ?');
      userParams.push(legacyRole);
    }

    if (userFields.length) {
      await connection.query(
        `UPDATE users
         SET ${userFields.join(', ')}
         WHERE id = ?`,
        [...userParams, id]
      );
    }

    const profileFields = [];
    const profileParams = [];

    if (nombres !== undefined) {
      profileFields.push('nombres = ?');
      profileParams.push(nombres);
    }

    if (apellidos !== undefined) {
      profileFields.push('apellidos = ?');
      profileParams.push(apellidos || null);
    }

    if (telefono !== undefined) {
      profileFields.push('telefono = ?');
      profileParams.push(telefonoNormalizado);
    }

    if (dpi !== undefined) {
      profileFields.push('dpi = ?');
      profileParams.push(dpi || null);
    }

    if (direccion !== undefined) {
      profileFields.push('direccion = ?');
      profileParams.push(direccion || null);
    }

    if (profileFields.length) {
      await connection.query(
        `INSERT INTO user_profiles (
           user_id,
           nombres
         )
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE
           ${profileFields.join(', ')}`,
        [
          id,
          nombres || 'Usuario',
          ...profileParams
        ]
      );
    }

    if (rolesArray.length) {
      await connection.query(
        `DELETE FROM user_roles
         WHERE user_id = ?`,
        [id]
      );

      const placeholders =
        rolesArray
          .map(() => '?')
          .join(',');

      const [roleRows] =
        await connection.query(
          `SELECT id, nombre
           FROM roles
           WHERE nombre IN (${placeholders})`,
          rolesArray
        );

      for (const roleRow of roleRows) {
        await connection.query(
          `INSERT IGNORE INTO user_roles (
             user_id,
             role_id
           )
           VALUES (?, ?)`,
          [id, roleRow.id]
        );
      }
    }

    await connection.commit();
    committed = true;

    let photoWarning = null;

    if (tempFilePath) {
      try {
        const fotoPerfil = moverFoto(
          tempFilePath,
          id
        );

        tempFilePath = null;

        await db.query(
          `INSERT INTO user_profiles (
             user_id,
             nombres,
             foto_perfil
           )
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             foto_perfil = VALUES(foto_perfil)`,
          [
            id,
            nombres || 'Usuario',
            fotoPerfil
          ]
        );
      } catch (photoError) {
        if (tempFilePath) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (_) {}

          tempFilePath = null;
        }

        photoWarning =
          'El usuario fue actualizado, pero no se pudo guardar la fotografía';

        console.error(
          'Foto updateUsuario error:',
          photoError
        );
      }
    }

    try {
      await auditoriaService.registrar({
        req,
        empresaId: existing.empresa_id,
        accion: 'EDITAR',
        entidad: 'USUARIO',
        entidadId: id,
        descripcion:
          `Usuario ${username || id} actualizado`,
        datosNuevos: req.body,
      });

      if (rolesArray.length) {
        await auditoriaService.registrar({
          req,
          empresaId: existing.empresa_id,
          accion: 'CAMBIAR_ROLES',
          entidad: 'USUARIO',
          entidadId: id,
          descripcion:
            `Roles del usuario ${
              username || id
            } actualizados`,
          datosNuevos: {
            roles: rolesArray
          },
        });
      }
    } catch (auditError) {
      console.error(
        'Auditoría updateUsuario error:',
        auditError
      );
    }

    return res.json({
      success: true,
      message:
        'Usuario actualizado exitosamente',
      warning: photoWarning
    });
  } catch (error) {
    if (connection && !committed) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (_) {}
    }

    if (sendPlanLimitError(res, error)) {
      return;
    }

    console.error(
      'updateUsuario error:',
      error
    );

    return res.status(
      Number(error.statusCode || 500)
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : 'Error al actualizar el usuario'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.toggleEstado = async (req, res) => {
  let connection = null;
  let committed = false;

  try {
    const targetId = Number(req.params.id);
    const currentUserId = Number(req.user?.id);

    if (
      !Number.isInteger(targetId) ||
      targetId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no válido'
      });
    }

    if (currentUserId === targetId) {
      return res.status(400).json({
        success: false,
        message:
          'No puedes cambiar el estado de tu propia cuenta'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const params = [targetId];

    let query = `
      SELECT
        u.id,
        u.active,
        u.role,
        u.empresa_id,
        EXISTS (
          SELECT 1
          FROM user_roles ur
          INNER JOIN roles r
            ON r.id = ur.role_id
          WHERE ur.user_id = u.id
            AND UPPER(r.nombre) =
              'ADMINISTRADOR'
        ) AS has_admin_role
      FROM users u
      WHERE u.id = ?
    `;

    if (!req.tenant?.isSuperadmin) {
      query += ' AND u.empresa_id = ?';
      params.push(req.tenant.empresa_id);
    }

    const [[preliminaryUser]] =
      await connection.query(
        query,
        params
      );

    if (!preliminaryUser) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const intendedNewActive =
      preliminaryUser.active
        ? 0
        : 1;

    if (
      intendedNewActive === 1 &&
      preliminaryUser.empresa_id !== null
    ) {
      await planAccess.obtenerPlanEmpresaBloqueado(
        preliminaryUser.empresa_id,
        connection
      );
    }

    const [[user]] =
      await connection.query(
        `${query} FOR UPDATE`,
        params
      );

    if (!user) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (
      Boolean(user.active) !==
      Boolean(preliminaryUser.active)
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        code: 'USER_STATE_CHANGED',
        message:
          'El estado del usuario cambió durante la operación. Actualice la lista e inténtelo nuevamente.'
      });
    }

    const newActive =
      intendedNewActive;

    if (
      newActive === 1 &&
      user.empresa_id !== null
    ) {
      await planAccess.validarLimiteUsuarios(
        user.empresa_id,
        connection
      );
    }

    const isAdmin =
      user.role === 'admin' ||
      Boolean(user.has_admin_role);

    if (user.active && isAdmin) {
      const adminParams = [targetId];

      let adminQuery = `
        SELECT
          COUNT(DISTINCT u.id) AS cnt
        FROM users u
        LEFT JOIN user_roles ur
          ON ur.user_id = u.id
        LEFT JOIN roles r
          ON r.id = ur.role_id
        WHERE u.active = 1
          AND u.id != ?
          AND (
            u.role = 'admin'
            OR UPPER(r.nombre) =
              'ADMINISTRADOR'
          )
      `;

      if (user.empresa_id === null) {
        adminQuery +=
          ' AND u.empresa_id IS NULL';
      } else {
        adminQuery +=
          ' AND u.empresa_id = ?';

        adminParams.push(
          user.empresa_id
        );
      }

      const [[adminCount]] =
        await connection.query(
          adminQuery,
          adminParams
        );

      if (Number(adminCount.cnt) === 0) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            'No se puede desactivar al único administrador activo de la empresa'
        });
      }
    }

    const updateParams = [
      newActive,
      targetId
    ];

    let updateQuery =
      'UPDATE users SET active = ? WHERE id = ?';

    if (!req.tenant?.isSuperadmin) {
      updateQuery +=
        ' AND empresa_id = ?';

      updateParams.push(
        req.tenant.empresa_id
      );
    }

    await connection.query(
      updateQuery,
      updateParams
    );

    await connection.commit();
    committed = true;

    try {
      await auditoriaService.registrar({
        req,
        empresaId: user.empresa_id,
        accion:
          newActive
            ? 'ACTIVAR'
            : 'DESACTIVAR',
        entidad: 'USUARIO',
        entidadId: targetId,
        descripcion:
          `Usuario ${targetId} ${
            newActive
              ? 'activado'
              : 'desactivado'
          }`,
        datosAnteriores: {
          active: Boolean(user.active)
        },
        datosNuevos: {
          active: Boolean(newActive)
        },
      });
    } catch (auditError) {
      console.error(
        'Auditoría toggleEstado error:',
        auditError
      );
    }

    return res.json({
      success: true,
      message:
        newActive
          ? 'Usuario activado'
          : 'Usuario desactivado',
      data: {
        active: Boolean(newActive)
      }
    });
  } catch (error) {
    if (connection && !committed) {
      try {
        await connection.rollback();
      } catch (_) {}
    }

    if (sendPlanLimitError(res, error)) {
      return;
    }

    console.error(
      'toggleEstado error:',
      error
    );

    return res.status(
      Number(error.statusCode || 500)
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : 'Error al cambiar el estado del usuario'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = Number(id);
    const currentUserId = Number(req.user?.id);

    if (currentUserId === targetId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta'
      });
    }

    const params = [targetId];
    let query = `
      SELECT
        u.id,
        u.active,
        u.role,
        u.empresa_id,
        EXISTS (
          SELECT 1
          FROM user_roles ur
          INNER JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = u.id
            AND UPPER(r.nombre) = 'ADMINISTRADOR'
        ) AS has_admin_role
      FROM users u
      WHERE u.id = ?
    `;

    if (!req.tenant?.isSuperadmin) {
      query += ' AND u.empresa_id = ?';
      params.push(req.tenant.empresa_id);
    }

    const [[user]] = await db.query(query, params);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const isAdmin =
      user.role === 'admin' ||
      Boolean(user.has_admin_role);

    if (user.active && isAdmin) {
      const adminParams = [targetId];
      let adminQuery = `
        SELECT COUNT(DISTINCT u.id) AS cnt
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.active = 1
          AND u.id != ?
          AND (
            u.role = 'admin'
            OR UPPER(r.nombre) = 'ADMINISTRADOR'
          )
      `;

      if (user.empresa_id === null) {
        adminQuery += ' AND u.empresa_id IS NULL';
      } else {
        adminQuery += ' AND u.empresa_id = ?';
        adminParams.push(user.empresa_id);
      }

      const [[adminCount]] = await db.query(adminQuery, adminParams);

      if (Number(adminCount.cnt) === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar al único administrador activo de la empresa'
        });
      }
    }

    const deleteParams = [targetId];
    let deleteQuery = 'DELETE FROM users WHERE id = ?';

    if (!req.tenant?.isSuperadmin) {
      deleteQuery += ' AND empresa_id = ?';
      deleteParams.push(req.tenant.empresa_id);
    }

    const [result] = await db.query(deleteQuery, deleteParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const userUploadDir = path.join(
      UPLOADS_BASE,
      'usuarios',
      String(targetId)
    );

    try {
      fs.rmSync(userUploadDir, {
        recursive: true,
        force: true
      });
    } catch (_) {}

    await auditoriaService.registrar({
      req,
      empresaId: user.empresa_id,
      accion: 'ELIMINAR',
      entidad: 'USUARIO',
      entidadId: targetId,
      descripcion: `Usuario ${targetId} eliminado`,
      datosAnteriores: user,
    });
    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('deleteUsuario error:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        success: false,
        message: 'Este usuario tiene registros relacionados y no puede eliminarse'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
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
    const userScope = scopedUserExistsQuery(req, id);
    const [[user]] = await db.query(userScope.query, userScope.params);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

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
