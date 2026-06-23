const bcrypt = require('bcrypt');
const db = require('../config/database');
const { parsePagination } = require('../utils/pagination');
const { validatePhone } = require('../utils/phoneValidation');
const superAdminAudit = require('../services/superAdminAuditService');
const subscriptionAccess = require('../services/subscriptionAccessService');

const ESTADOS_EMPRESA = new Set(['demo', 'prueba', 'activa', 'suspendida', 'cancelada']);
const ORDER_FIELDS = {
  nombre: 'e.nombre',
  estado: 'e.estado',
  created_at: 'e.created_at',
  usuarios: 'total_usuarios',
};

const SUPER_ADMIN_SUMMARY_SQL = `
  SELECT
    COUNT(*) AS empresas_totales,
    SUM(
      LOWER(COALESCE(estado, '')) = 'activa'
      AND LOWER(COALESCE(plan, '')) <> 'demo'
    ) AS empresas_activas,
    SUM(
      LOWER(COALESCE(plan, '')) = 'demo'
      AND LOWER(COALESCE(estado, '')) IN ('activa', 'demo')
    ) AS empresas_demo,
    SUM(
      LOWER(COALESCE(estado, '')) = 'suspendida'
    ) AS empresas_suspendidas,
    SUM(
      LOWER(COALESCE(estado, '')) = 'cancelada'
    ) AS empresas_canceladas
  FROM empresas
`;

const SUPER_ADMIN_USERS_SUMMARY_SQL = `
  SELECT COUNT(*) AS usuarios_totales
  FROM users
  WHERE COALESCE(tipo_usuario, 'EMPRESA') = 'EMPRESA'
    AND COALESCE(es_super_admin, 0) = 0
`;

function text(value, max = 255) {
  if (value === undefined || value === null) return null;
  const clean = String(value).trim();
  return clean ? clean.slice(0, max) : null;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function validDate(value) {
  return subscriptionAccess.isValidDate(value);
}

function empresaSelect() {
  return `
    SELECT e.id, e.nombre, e.nombre_comercial, e.razon_social, e.nit,
           e.slug, e.estado, e.plan, e.fecha_inicio, e.fecha_vencimiento,
           e.telefono, COALESCE(NULLIF(e.correo, ''), e.email) AS email,
           e.direccion, e.logo_url, e.color_principal, e.moneda_codigo,
           e.moneda_simbolo, e.zona_horaria, e.created_at, e.updated_at,
           s.id AS suscripcion_id, s.tipo AS tipo_suscripcion,
           CASE
             WHEN s.id IS NULL THEN NULL
             WHEN s.fecha_vencimiento IS NULL THEN
               CASE WHEN s.tipo = 'prueba' THEN 'prueba' ELSE 'vigente' END
             WHEN CURDATE() <= s.fecha_vencimiento THEN
               CASE WHEN s.tipo = 'prueba' THEN 'prueba' ELSE 'vigente' END
             WHEN CURDATE() <= COALESCE(s.fecha_fin_gracia, s.fecha_vencimiento)
               THEN 'gracia'
             ELSE 'vencida'
           END AS estado_suscripcion,
           s.plan AS suscripcion_plan,
           s.fecha_inicio AS suscripcion_fecha_inicio,
           s.fecha_vencimiento AS suscripcion_fecha_vencimiento,
           s.dias_gracia, s.fecha_fin_gracia, s.duracion_meses,
           s.proxima_a_vencer_dias,
           CASE
             WHEN s.fecha_vencimiento IS NULL THEN NULL
             ELSE DATEDIFF(s.fecha_vencimiento, CURDATE())
           END AS dias_restantes,
           CASE
             WHEN s.fecha_vencimiento IS NOT NULL
              AND DATEDIFF(s.fecha_vencimiento, CURDATE()) BETWEEN 0 AND s.proxima_a_vencer_dias
             THEN 1 ELSE 0
           END AS proxima_a_vencer,
           COUNT(DISTINCT u.id) AS total_usuarios
    FROM empresas e
    LEFT JOIN suscripciones s ON s.empresa_id = e.id
    LEFT JOIN users u
      ON u.empresa_id = e.id
     AND COALESCE(u.tipo_usuario, 'EMPRESA') = 'EMPRESA'
  `;
}

exports.getMe = async (req, res) => {
  const [[summary]] = await db.query(SUPER_ADMIN_SUMMARY_SQL);
  const [[users]] = await db.query(SUPER_ADMIN_USERS_SUMMARY_SQL);

  res.json({
    success: true,
    data: {
      ...req.superAdmin,
      tipo_usuario: 'PLATAFORMA',
      es_super_admin: true,
      resumen: {
        empresas_totales: Number(summary.empresas_totales || 0),
        empresas_activas: Number(summary.empresas_activas || 0),
        empresas_demo: Number(summary.empresas_demo || 0),
        empresas_suspendidas: Number(summary.empresas_suspendidas || 0),
        empresas_canceladas: Number(summary.empresas_canceladas || 0),
        usuarios_totales: Number(users.usuarios_totales || 0),
      },
    },
  });
};

exports.SUPER_ADMIN_SUMMARY_SQL = SUPER_ADMIN_SUMMARY_SQL;
exports.SUPER_ADMIN_USERS_SUMMARY_SQL = SUPER_ADMIN_USERS_SUMMARY_SQL;

exports.getEmpresas = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const conditions = [];
    const params = [];
    const search = text(req.query.search, 150);
    const estado = text(req.query.estado, 30)?.toLowerCase();

    if (search) {
      const term = `%${search}%`;
      conditions.push('(e.nombre LIKE ? OR e.nombre_comercial LIKE ? OR e.nit LIKE ?)');
      params.push(term, term, term);
    }
    if (estado) {
      if (!ESTADOS_EMPRESA.has(estado)) {
        return res.status(400).json({ success: false, message: 'Estado no válido' });
      }
      conditions.push('LOWER(e.estado) = ?');
      params.push(estado);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderField = ORDER_FIELDS[req.query.order_by] || ORDER_FIELDS.created_at;
    const direction = String(req.query.order_dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const [[count]] = await db.query(
      `SELECT COUNT(*) AS total FROM empresas e ${where}`,
      params
    );
    const [rows] = await db.query(
      `${empresaSelect()}
       ${where}
       GROUP BY e.id
       ORDER BY ${orderField} ${direction}, e.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(count.total),
        totalPages: Math.ceil(Number(count.total) / limit),
      },
    });
  } catch (error) {
    console.error('getEmpresas superadmin error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener empresas' });
  }
};

exports.getEmpresaById = async (req, res) => {
  try {
    const [[empresa]] = await db.query(
      `${empresaSelect()}
       WHERE e.id = ?
       GROUP BY e.id
       LIMIT 1`,
      [req.params.id]
    );
    if (!empresa) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });

    const [[administrador]] = await db.query(
      `SELECT u.id, u.username, u.email, u.name, u.active, u.created_at
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE u.empresa_id = ?
         AND UPPER(r.nombre) = 'ADMINISTRADOR'
         AND COALESCE(u.tipo_usuario, 'EMPRESA') = 'EMPRESA'
       ORDER BY u.created_at ASC
       LIMIT 1`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...empresa, administrador_principal: administrador || null } });
  } catch (error) {
    console.error('getEmpresaById superadmin error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener la empresa' });
  }
};

const createEmpresaLegacy = async (req, res) => {
  try {
    const nombre = text(req.body?.nombre, 150);
    const slug = slugify(req.body?.slug || nombre);
    const estado = text(req.body?.estado, 30)?.toLowerCase() || 'demo';
    const plan = text(req.body?.plan, 50) || 'demo';
    if (!nombre || !slug) {
      return res.status(400).json({ success: false, message: 'Nombre y slug son requeridos' });
    }
    if (!ESTADOS_EMPRESA.has(estado)) {
      return res.status(400).json({ success: false, message: 'Estado no válido' });
    }
    if (!validDate(req.body?.fecha_vencimiento)) {
      return res.status(400).json({ success: false, message: 'fecha_vencimiento debe usar formato YYYY-MM-DD' });
    }
    const phone = validatePhone(req.body?.telefono, { label: 'El teléfono de la empresa' });
    if (!phone.ok) return res.status(400).json({ success: false, message: phone.message });

    const [[duplicate]] = await db.query(
      'SELECT id FROM empresas WHERE slug = ? OR (? IS NOT NULL AND nit = ?) LIMIT 1',
      [slug, text(req.body?.nit, 30), text(req.body?.nit, 30)]
    );
    if (duplicate) return res.status(409).json({ success: false, message: 'Ya existe una empresa con ese slug o NIT' });

    const [result] = await db.query(
      `INSERT INTO empresas (
        nombre, nombre_comercial, razon_social, nit, slug, estado, plan,
        fecha_inicio, fecha_vencimiento, telefono, email, correo, direccion,
        color_primario, color_principal, moneda_codigo, moneda_simbolo, zona_horaria
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        text(req.body?.nombre_comercial, 150),
        text(req.body?.razon_social, 180),
        text(req.body?.nit, 30),
        slug,
        estado,
        plan,
        text(req.body?.fecha_vencimiento, 10),
        phone.value,
        text(req.body?.email, 150),
        text(req.body?.email, 150),
        text(req.body?.direccion, 255),
        text(req.body?.color_principal, 20) || '#2563eb',
        text(req.body?.color_principal, 20) || '#2563eb',
        text(req.body?.moneda_codigo, 10) || 'GTQ',
        text(req.body?.moneda_simbolo, 10) || 'Q',
        text(req.body?.zona_horaria, 80) || 'America/Guatemala',
      ]
    );
    await superAdminAudit.registrar({
      req,
      accion: 'CREAR_EMPRESA',
      entidad: 'EMPRESA',
      entidadId: result.insertId,
      datosNuevos: req.body,
    });
    res.status(201).json({ success: true, data: { id: result.insertId, slug, estado } });
  } catch (error) {
    console.error('createEmpresa superadmin error:', error);
    res.status(500).json({ success: false, message: 'Error al crear la empresa' });
  }
};

exports.updateEmpresa = async (req, res) => {
  try {
    const [[previous]] = await db.query('SELECT * FROM empresas WHERE id = ? LIMIT 1', [req.params.id]);
    if (!previous) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
    if (req.body?.nombre !== undefined && !text(req.body.nombre, 150)) {
      return res.status(400).json({ success: false, message: 'El nombre no puede quedar vacío' });
    }
    if (!validDate(req.body?.fecha_vencimiento)) {
      return res.status(400).json({ success: false, message: 'fecha_vencimiento debe usar formato YYYY-MM-DD' });
    }
    const phone = req.body?.telefono === undefined
      ? null
      : validatePhone(req.body.telefono, { label: 'El teléfono de la empresa' });
    if (phone && !phone.ok) {
      return res.status(400).json({ success: false, message: phone.message });
    }

    const allowed = {
      nombre: text(req.body?.nombre, 150),
      nombre_comercial: text(req.body?.nombre_comercial, 150),
      razon_social: text(req.body?.razon_social, 180),
      nit: text(req.body?.nit, 30),
      plan: text(req.body?.plan, 50),
      fecha_vencimiento: text(req.body?.fecha_vencimiento, 10),
      telefono: req.body?.telefono === undefined ? undefined : phone.value,
      email: text(req.body?.email, 150),
      correo: text(req.body?.email, 150),
      direccion: text(req.body?.direccion, 255),
      color_primario: text(req.body?.color_principal, 20),
      color_principal: text(req.body?.color_principal, 20),
      moneda_codigo: text(req.body?.moneda_codigo, 10),
      moneda_simbolo: text(req.body?.moneda_simbolo, 10),
      zona_horaria: text(req.body?.zona_horaria, 80),
    };
    const fields = [];
    const params = [];
    for (const [field, value] of Object.entries(allowed)) {
      if (req.body?.[field] !== undefined ||
          (field === 'correo' && req.body?.email !== undefined) ||
          (['color_primario', 'color_principal'].includes(field) && req.body?.color_principal !== undefined)) {
        fields.push(`${field} = ?`);
        params.push(value);
      }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No se enviaron campos válidos' });

    await db.query(`UPDATE empresas SET ${fields.join(', ')} WHERE id = ?`, [...params, req.params.id]);
    const [[updated]] = await db.query('SELECT * FROM empresas WHERE id = ?', [req.params.id]);
    await superAdminAudit.registrar({
      req,
      accion: 'EDITAR_EMPRESA',
      entidad: 'EMPRESA',
      entidadId: req.params.id,
      datosAnteriores: previous,
      datosNuevos: updated,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('updateEmpresa superadmin error:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar la empresa' });
  }
};

exports.updateEmpresaEstado = async (req, res) => {
  try {
    const estado = text(req.body?.estado, 30)?.toLowerCase();
    if (!estado || !ESTADOS_EMPRESA.has(estado)) {
      return res.status(400).json({ success: false, message: 'Estado no válido' });
    }
    const [[previous]] = await db.query('SELECT id, estado FROM empresas WHERE id = ?', [req.params.id]);
    if (!previous) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });

    await db.query('UPDATE empresas SET estado = ? WHERE id = ?', [estado, req.params.id]);
    await superAdminAudit.registrar({
      req,
      accion: 'CAMBIAR_ESTADO_EMPRESA',
      entidad: 'EMPRESA',
      entidadId: req.params.id,
      datosAnteriores: { estado: previous.estado },
      datosNuevos: { estado },
    });
    res.json({ success: true, data: { id: Number(req.params.id), estado } });
  } catch (error) {
    console.error('updateEmpresaEstado error:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar el estado' });
  }
};

exports.createEmpresaAdministrador = async (req, res) => {
  let connection;
  try {
    const username = text(req.body?.username, 50);
    const email = text(req.body?.email, 100);
    const password = String(req.body?.password || '');
    const nombres = text(req.body?.nombres, 100);
    const apellidos = text(req.body?.apellidos, 100);
    if (!username || !email || !nombres || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Usuario, correo, nombre y contraseña de al menos 8 caracteres son requeridos',
      });
    }
    const phone = validatePhone(req.body?.telefono, { label: 'El teléfono del administrador' });
    if (!phone.ok) {
      return res.status(400).json({ success: false, message: phone.message });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [[empresa]] = await connection.query(
      'SELECT id, nombre, estado FROM empresas WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!empresa) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
    }
    if (String(empresa.estado).toLowerCase() === 'cancelada') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'No se puede agregar un administrador a una empresa cancelada' });
    }

    const [[duplicate]] = await connection.query(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );
    if (duplicate) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'El usuario o correo ya está registrado' });
    }
    const [[role]] = await connection.query(
      "SELECT id FROM roles WHERE UPPER(nombre) = 'ADMINISTRADOR' LIMIT 1"
    );
    if (!role) throw new Error('No existe el rol ADMINISTRADOR');

    const [[existingAdmin]] = await connection.query(
      `SELECT u.id
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.empresa_id = ? AND ur.role_id = ?
       LIMIT 1`,
      [empresa.id, role.id]
    );
    if (existingAdmin) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'La empresa ya tiene un administrador principal' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await connection.query(
      `INSERT INTO users (
        username, email, password, name, role, tipo_usuario,
        es_super_admin, empresa_id, active
      ) VALUES (?, ?, ?, ?, 'admin', 'EMPRESA', 0, ?, 1)`,
      [username, email, passwordHash, [nombres, apellidos].filter(Boolean).join(' '), empresa.id]
    );
    await connection.query(
      `INSERT INTO user_profiles (user_id, nombres, apellidos, telefono, direccion)
       VALUES (?, ?, ?, ?, ?)`,
      [userResult.insertId, nombres, apellidos, phone.value, text(req.body?.direccion, 255)]
    );
    await connection.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userResult.insertId, role.id]
    );
    await connection.query(
      `INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
       SELECT ?, ?, id FROM permisos`,
      [empresa.id, role.id]
    );
    await connection.commit();

    await superAdminAudit.registrar({
      req,
      accion: 'CREAR_ADMIN_EMPRESA',
      entidad: 'USUARIO',
      entidadId: userResult.insertId,
      datosNuevos: { empresa_id: empresa.id, username, email, nombres, apellidos },
    });
    res.status(201).json({
      success: true,
      data: { id: userResult.insertId, empresa_id: empresa.id, username, email },
    });
  } catch (error) {
    if (connection) try { await connection.rollback(); } catch (_) {}
    console.error('createEmpresaAdministrador error:', error);
    res.status(500).json({ success: false, message: 'Error al crear el administrador principal' });
  } finally {
    if (connection) connection.release();
  }
};

exports.createEmpresa = async (req, res) => {
  let connection;
  try {
    const nombre = text(req.body?.nombre, 150);
    const slug = slugify(req.body?.slug || nombre);
    const tipoSuscripcion = text(req.body?.tipo_suscripcion, 20)?.toLowerCase() || 'prueba';
    const estado = tipoSuscripcion === 'prueba' ? 'demo' : 'activa';
    const plan = text(req.body?.plan, 50) || 'demo';
    const fechaInicio = text(req.body?.fecha_inicio, 10) || subscriptionAccess.todayString();
    const fechaVencimiento = text(req.body?.fecha_vencimiento, 10);
    const diasGracia = req.body?.dias_gracia === undefined ? 0 : Number(req.body.dias_gracia);

    if (!nombre || !slug) {
      return res.status(400).json({ success: false, message: 'Nombre y slug son requeridos' });
    }
    if (!['prueba', 'comercial'].includes(tipoSuscripcion)) {
      return res.status(400).json({ success: false, message: 'Tipo de suscripción no válido' });
    }
    if (!subscriptionAccess.isValidDate(fechaInicio, { nullable: false })) {
      return res.status(400).json({ success: false, message: 'fecha_inicio no es una fecha válida' });
    }
    if (!subscriptionAccess.isValidDate(fechaVencimiento)) {
      return res.status(400).json({ success: false, message: 'fecha_vencimiento no es una fecha válida' });
    }
    if (!Number.isInteger(diasGracia) || diasGracia < 0) {
      return res.status(400).json({ success: false, message: 'dias_gracia debe ser un entero mayor o igual a cero' });
    }
    if (fechaVencimiento && subscriptionAccess.diffDays(fechaInicio, fechaVencimiento) < 0) {
      return res.status(400).json({ success: false, message: 'fecha_inicio no puede ser posterior a fecha_vencimiento' });
    }

    const phone = validatePhone(req.body?.telefono, { label: 'El teléfono de la empresa' });
    if (!phone.ok) return res.status(400).json({ success: false, message: phone.message });

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [[duplicate]] = await connection.query(
      'SELECT id FROM empresas WHERE slug = ? OR (? IS NOT NULL AND nit = ?) LIMIT 1',
      [slug, text(req.body?.nit, 30), text(req.body?.nit, 30)]
    );
    if (duplicate) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Ya existe una empresa con ese slug o NIT' });
    }

    const [result] = await connection.query(
      `INSERT INTO empresas (
        nombre, nombre_comercial, razon_social, nit, slug, estado, plan,
        fecha_inicio, fecha_vencimiento, telefono, email, correo, direccion,
        color_primario, color_principal, moneda_codigo, moneda_simbolo, zona_horaria
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        text(req.body?.nombre_comercial, 150),
        text(req.body?.razon_social, 180),
        text(req.body?.nit, 30),
        slug,
        estado,
        plan,
        fechaInicio,
        fechaVencimiento,
        phone.value,
        text(req.body?.email, 150),
        text(req.body?.email, 150),
        text(req.body?.direccion, 255),
        text(req.body?.color_principal, 20) || '#2563eb',
        text(req.body?.color_principal, 20) || '#2563eb',
        text(req.body?.moneda_codigo, 10) || 'GTQ',
        text(req.body?.moneda_simbolo, 10) || 'Q',
        text(req.body?.zona_horaria, 80) || 'America/Guatemala',
      ]
    );

    const fechaFinGracia = subscriptionAccess.calcularFechaFinGracia(fechaVencimiento, diasGracia);
    const estadoSuscripcion = subscriptionAccess.calcularEstadoSuscripcion({
      tipo: tipoSuscripcion,
      fecha_vencimiento: fechaVencimiento,
      fecha_fin_gracia: fechaFinGracia,
      dias_gracia: diasGracia,
    });
    const [subscriptionResult] = await connection.query(
      `INSERT INTO suscripciones (
         empresa_id, plan, tipo, estado, fecha_inicio, fecha_vencimiento,
         dias_gracia, fecha_fin_gracia, proxima_a_vencer_dias
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 7)`,
      [
        result.insertId,
        plan,
        tipoSuscripcion,
        estadoSuscripcion,
        fechaInicio,
        fechaVencimiento,
        diasGracia,
        fechaFinGracia,
      ]
    );
    const subscriptionData = {
      plan,
      tipo: tipoSuscripcion,
      estado: estadoSuscripcion,
      fecha_inicio: fechaInicio,
      fecha_vencimiento: fechaVencimiento,
      dias_gracia: diasGracia,
      fecha_fin_gracia: fechaFinGracia,
    };
    await connection.query(
      `INSERT INTO historial_suscripciones (
         suscripcion_id, empresa_id, tipo_evento,
         estado_empresa_nuevo, estado_suscripcion_nuevo,
         fecha_inicio_nueva, fecha_vencimiento_nueva, dias_gracia_nuevo,
         motivo, super_admin_id, origen, datos_nuevos
       ) VALUES (?, ?, 'CREACION', ?, ?, ?, ?, ?, ?, ?, 'super_admin', ?)`,
      [
        subscriptionResult.insertId,
        result.insertId,
        estado,
        estadoSuscripcion,
        fechaInicio,
        fechaVencimiento,
        diasGracia,
        'Creación de empresa y suscripción',
        req.superAdmin.id,
        JSON.stringify(subscriptionData),
      ]
    );
    await connection.commit();

    await superAdminAudit.registrar({
      req,
      accion: 'CREAR_EMPRESA',
      entidad: 'EMPRESA',
      entidadId: result.insertId,
      datosNuevos: { ...req.body, suscripcion: subscriptionData },
    });
    return res.status(201).json({ success: true, data: { id: result.insertId, slug, estado } });
  } catch (error) {
    if (connection) try { await connection.rollback(); } catch (_) {}
    console.error('createEmpresa superadmin error:', error);
    return res.status(500).json({ success: false, message: 'Error al crear la empresa' });
  } finally {
    if (connection) connection.release();
  }
};
