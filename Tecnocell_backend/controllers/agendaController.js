// Controller: Agenda de entregas de reparaciones.
// Devuelve reparaciones con fecha_entrega_programada y eventos del calendario.

const db = require('../config/database');

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function isGlobalSuperadminTenant(req) {
  return isSuperadminTenant(req) && (req.tenant?.empresa_id ?? req.user?.empresa_id ?? null) == null;
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? null;
}

function requireTenantEmpresaId(req) {
  const empresaId = getTenantEmpresaId(req);
  if (empresaId == null) {
    throw new Error('Empresa requerida');
  }
  return empresaId;
}

function repairTenantClause(req, alias = 'r') {
  return isGlobalSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

function agendaTenantClause(req, alias = 'ae') {
  return isGlobalSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

function userTenantClause(req, alias = 'u') {
  return isGlobalSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

async function validateEmpresaExists(connectionOrDb, empresaId) {
  if (empresaId == null) return false;
  const [[empresa]] = await connectionOrDb.query(
    'SELECT id FROM empresas WHERE id = ? LIMIT 1',
    [empresaId]
  );
  return Boolean(empresa);
}

function normalizeEmpresaId(value) {
  if (value === undefined || value === null || value === '') return null;
  const empresaId = Number(value);
  return Number.isInteger(empresaId) && empresaId > 0 ? empresaId : NaN;
}

async function validateAgendaUserForTenant(connectionOrDb, userId, req, empresaId = null) {
  if (!userId) return null;

  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return null;
  }

  const params = [normalizedUserId];
  let query = 'SELECT id, empresa_id FROM users WHERE id = ? AND (active = 1 OR active IS NULL)';

  if (empresaId != null) {
    query += ' AND empresa_id = ?';
    params.push(empresaId);
  } else if (!isGlobalSuperadminTenant(req)) {
    query += ' AND empresa_id = ?';
    params.push(requireTenantEmpresaId(req));
  }

  const [[user]] = await connectionOrDb.query(query, params);
  return user || null;
}

async function validateEventoForTenant(connectionOrDb, eventoId, req) {
  const tenant = agendaTenantClause(req, 'ae');
  const [[evento]] = await connectionOrDb.query(
    `SELECT ae.* FROM agenda_eventos ae WHERE ae.id = ?${tenant.sql} LIMIT 1`,
    [eventoId, ...tenant.params]
  );
  return evento || null;
}

async function ensureColumn(tableName, columnName, alterSql) {
  const [[col]] = await db.query(
    `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  if (col.cnt === 0) {
    await db.query(alterSql);
  }
}

async function ensureIndex(tableName, indexName, createSql) {
  const [[idx]] = await db.query(
    `SELECT COUNT(*) AS cnt
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?`,
    [tableName, indexName]
  );

  if (idx.cnt === 0) {
    await db.query(createSql);
  }
}

async function resolveEventoEmpresaId(req, body) {
  if (!isSuperadminTenant(req)) {
    return requireTenantEmpresaId(req);
  }

  const tenantEmpresaId = getTenantEmpresaId(req);
  if (tenantEmpresaId != null) {
    return tenantEmpresaId;
  }

  const bodyEmpresaId = normalizeEmpresaId(body?.empresa_id);
  if (Number.isNaN(bodyEmpresaId)) {
    const error = new Error('Empresa invalida');
    error.statusCode = 400;
    throw error;
  }
  if (bodyEmpresaId == null) {
    const error = new Error('Empresa requerida para crear evento');
    error.statusCode = 400;
    throw error;
  }
  if (!(await validateEmpresaExists(db, bodyEmpresaId))) {
    const error = new Error('Empresa no encontrada');
    error.statusCode = 400;
    throw error;
  }

  return bodyEmpresaId;
}

// GET /api/agenda/entregas
exports.getEntregas = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, estado } = req.query;

    let query = `
      SELECT
        r.id,
        r.cliente_nombre,
        r.cliente_telefono,
        r.cliente_email,
        r.tipo_equipo,
        r.marca,
        r.modelo,
        r.color,
        r.estado,
        r.prioridad,
        r.fecha_ingreso,
        r.fecha_entrega_programada,
        r.nota_entrega_programada,
        r.fecha_entrega
      FROM reparaciones r
      WHERE r.fecha_entrega_programada IS NOT NULL
    `;

    const params = [];
    const tenant = repairTenantClause(req, 'r');
    query += tenant.sql;
    params.push(...tenant.params);

    if (fecha_inicio) {
      query += ' AND r.fecha_entrega_programada >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      query += ' AND r.fecha_entrega_programada <= ?';
      params.push(fecha_fin + ' 23:59:59');
    }

    if (estado) {
      const estados = estado.split(',').map(s => s.trim()).filter(Boolean);
      if (estados.length > 0) {
        query += ` AND r.estado IN (${estados.map(() => '?').join(',')})`;
        params.push(...estados);
      }
    }

    query += ' ORDER BY r.fecha_entrega_programada ASC';

    const [rows] = await db.query(query, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[agendaController] getEntregas error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener entregas' });
  }
};

// PATCH /api/reparaciones/:id/fecha-entrega
exports.patchFechaEntrega = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_entrega_programada, nota_entrega_programada } = req.body;

    if (!fecha_entrega_programada) {
      return res.status(400).json({
        success: false,
        message: 'fecha_entrega_programada es obligatoria',
      });
    }

    const tenant = repairTenantClause(req);
    const [rows] = await db.query(
      `SELECT id FROM reparaciones WHERE id = ?${tenant.sql.replace('r.', '')}`,
      [id, ...tenant.params]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reparacion no encontrada' });
    }

    await db.query(
      `UPDATE reparaciones
         SET fecha_entrega_programada = ?,
             nota_entrega_programada  = ?,
             updated_at               = NOW()
       WHERE id = ?${tenant.sql.replace('r.', '')}`,
      [fecha_entrega_programada, nota_entrega_programada ?? null, id, ...tenant.params]
    );

    const [[updated]] = await db.query(
      `SELECT id, fecha_entrega_programada, nota_entrega_programada, estado
         FROM reparaciones WHERE id = ?${tenant.sql.replace('r.', '')}`,
      [id, ...tenant.params]
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[agendaController] patchFechaEntrega error:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar fecha de entrega' });
  }
};

// DELETE /api/reparaciones/:id/fecha-entrega
exports.deleteFechaEntrega = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = repairTenantClause(req);
    const [rows] = await db.query(
      `SELECT id FROM reparaciones WHERE id = ?${tenant.sql.replace('r.', '')}`,
      [id, ...tenant.params]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reparacion no encontrada' });
    }

    await db.query(
      `UPDATE reparaciones
         SET fecha_entrega_programada = NULL,
             nota_entrega_programada  = NULL,
             updated_at               = NOW()
       WHERE id = ?${tenant.sql.replace('r.', '')}`,
      [id, ...tenant.params]
    );

    res.json({ success: true, message: 'Fecha de entrega eliminada' });
  } catch (error) {
    console.error('[agendaController] deleteFechaEntrega error:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar fecha de entrega' });
  }
};

// Auto-crear tabla agenda_eventos si no existe.
const ensureEventosTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS agenda_eventos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT(11) NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      fecha DATE NOT NULL,
      hora TIME DEFAULT NULL,
      descripcion TEXT DEFAULT NULL,
      tipo ENUM('nota','cita','recordatorio','otro') NOT NULL DEFAULT 'nota',
      color VARCHAR(20) DEFAULT NULL,
      creado_por VARCHAR(100) DEFAULT NULL,
      creado_por_id INT DEFAULT NULL,
      para_rol VARCHAR(50) DEFAULT NULL,
      para_usuario_id INT DEFAULT NULL,
      para_usuario_nombre VARCHAR(150) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_agenda_eventos_empresa_id (empresa_id),
      INDEX idx_agenda_eventos_empresa_fecha (empresa_id, fecha),
      INDEX idx_agenda_eventos_empresa_usuario (empresa_id, para_usuario_id),
      CONSTRAINT fk_agenda_eventos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn('agenda_eventos', 'empresa_id', 'ALTER TABLE agenda_eventos ADD COLUMN empresa_id INT(11) NULL AFTER id');
  await ensureColumn('agenda_eventos', 'creado_por_id', 'ALTER TABLE agenda_eventos ADD COLUMN creado_por_id INT DEFAULT NULL');
  await ensureColumn('agenda_eventos', 'para_rol', 'ALTER TABLE agenda_eventos ADD COLUMN para_rol VARCHAR(50) DEFAULT NULL');
  await ensureColumn('agenda_eventos', 'para_usuario_id', 'ALTER TABLE agenda_eventos ADD COLUMN para_usuario_id INT DEFAULT NULL');
  await ensureColumn('agenda_eventos', 'para_usuario_nombre', 'ALTER TABLE agenda_eventos ADD COLUMN para_usuario_nombre VARCHAR(150) DEFAULT NULL');

  await ensureIndex('agenda_eventos', 'idx_agenda_eventos_empresa_id', 'CREATE INDEX idx_agenda_eventos_empresa_id ON agenda_eventos (empresa_id)');
  await ensureIndex('agenda_eventos', 'idx_agenda_eventos_empresa_fecha', 'CREATE INDEX idx_agenda_eventos_empresa_fecha ON agenda_eventos (empresa_id, fecha)');
  await ensureIndex('agenda_eventos', 'idx_agenda_eventos_empresa_usuario', 'CREATE INDEX idx_agenda_eventos_empresa_usuario ON agenda_eventos (empresa_id, para_usuario_id)');
};

// GET /api/agenda/eventos
exports.getEventos = async (req, res) => {
  try {
    await ensureEventosTable();
    const { fecha_inicio, fecha_fin } = req.query;
    const userId = req.user?.id ?? null;
    const userRoles = Array.isArray(req.user?.roles)
      ? req.user.roles
      : (req.user?.role ? [req.user.role] : []);

    const tenant = agendaTenantClause(req, 'ae');
    let query = `SELECT ae.* FROM agenda_eventos ae WHERE 1=1${tenant.sql}`;
    const params = [...tenant.params];

    if (fecha_inicio) { query += ' AND ae.fecha >= ?'; params.push(fecha_inicio); }
    if (fecha_fin)    { query += ' AND ae.fecha <= ?'; params.push(fecha_fin); }

    const rolePH = userRoles.length > 0 ? userRoles.map(() => '?').join(',') : null;
    query += ` AND (
      (ae.para_rol IS NULL AND ae.para_usuario_id IS NULL)
      OR ae.para_usuario_id = ?
      OR ae.creado_por_id = ?
      ${rolePH ? `OR ae.para_rol IN (${rolePH})` : ''}
    )`;
    params.push(userId, userId);
    if (rolePH) params.push(...userRoles);

    query += ' ORDER BY ae.fecha ASC, COALESCE(ae.hora, "00:00:00") ASC';
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[agendaController] getEventos error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener eventos' });
  }
};

// POST /api/agenda/eventos
exports.createEvento = async (req, res) => {
  try {
    await ensureEventosTable();
    const { titulo, fecha, hora, descripcion, tipo, para_rol, para_usuario_id, para_usuario_nombre } = req.body;
    if (!titulo || !fecha) {
      return res.status(400).json({ success: false, message: 'titulo y fecha son obligatorios' });
    }

    const empresaId = await resolveEventoEmpresaId(req, req.body);
    let paraUsuarioId = null;
    if (para_usuario_id) {
      const user = await validateAgendaUserForTenant(db, para_usuario_id, req, empresaId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
      paraUsuarioId = user.id;
    }

    const creadorNombre = req.user?.name || req.user?.email || null;
    const creadorId = req.user?.id || null;
    const [result] = await db.query(
      `INSERT INTO agenda_eventos
        (empresa_id, titulo, fecha, hora, descripcion, tipo, creado_por, creado_por_id, para_rol, para_usuario_id, para_usuario_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        titulo.trim(), fecha, hora || null, descripcion?.trim() || null, tipo || 'nota',
        creadorNombre, creadorId,
        para_rol || null,
        paraUsuarioId,
        para_usuario_nombre || null,
      ]
    );
    const [rows] = await db.query('SELECT * FROM agenda_eventos WHERE id = ? AND empresa_id = ?', [result.insertId, empresaId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[agendaController] createEvento error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Error al crear evento' });
  }
};

// PUT /api/agenda/eventos/:id
exports.updateEvento = async (req, res) => {
  try {
    await ensureEventosTable();
    const { id } = req.params;
    const { titulo, fecha, hora, descripcion, tipo } = req.body;
    if (!titulo || !fecha) {
      return res.status(400).json({ success: false, message: 'titulo y fecha son obligatorios' });
    }

    const evento = await validateEventoForTenant(db, id, req);
    if (!evento) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    }

    const { para_rol, para_usuario_id, para_usuario_nombre } = req.body;
    let paraUsuarioId = null;
    if (para_usuario_id) {
      const user = await validateAgendaUserForTenant(db, para_usuario_id, req, evento.empresa_id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
      paraUsuarioId = user.id;
    }

    const tenant = agendaTenantClause(req, 'ae');
    await db.query(
      `UPDATE agenda_eventos ae
         SET ae.titulo=?, ae.fecha=?, ae.hora=?, ae.descripcion=?, ae.tipo=?,
             ae.para_rol=?, ae.para_usuario_id=?, ae.para_usuario_nombre=?
       WHERE ae.id=?${tenant.sql}`,
      [
        titulo.trim(), fecha, hora || null, descripcion?.trim() || null, tipo || 'nota',
        para_rol || null,
        paraUsuarioId,
        para_usuario_nombre || null,
        id,
        ...tenant.params,
      ]
    );
    const [rows] = await db.query('SELECT * FROM agenda_eventos WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[agendaController] updateEvento error:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar evento' });
  }
};

// DELETE /api/agenda/eventos/:id
exports.deleteEvento = async (req, res) => {
  try {
    await ensureEventosTable();
    const { id } = req.params;
    const evento = await validateEventoForTenant(db, id, req);
    if (!evento) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    }

    const tenant = agendaTenantClause(req, 'ae');
    const [result] = await db.query(
      `DELETE FROM agenda_eventos WHERE id = ?${tenant.sql.replace(/ae\./g, '')}`,
      [id, ...tenant.params]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    }
    res.json({ success: true, message: 'Evento eliminado' });
  } catch (error) {
    console.error('[agendaController] deleteEvento error:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar evento' });
  }
};

// GET /api/agenda/usuarios
exports.getUsuariosSimple = async (req, res) => {
  try {
    const tenant = userTenantClause(req, 'u');
    const [rows] = await db.query(
      `SELECT u.id,
              TRIM(CONCAT(COALESCE(p.nombres,''), ' ', COALESCE(p.apellidos,''))) AS nombre_completo,
              u.username,
              GROUP_CONCAT(r.nombre ORDER BY r.nombre SEPARATOR ',') AS roles
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        WHERE (u.active = 1 OR u.active IS NULL)${tenant.sql}
        GROUP BY u.id
        ORDER BY COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.nombres,''),' ',COALESCE(p.apellidos,''))),''), u.username)`,
      tenant.params
    );
    const data = rows.map(r => ({
      id: r.id,
      nombre: r.nombre_completo || r.username,
      roles: r.roles ? r.roles.split(',') : [],
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('[agendaController] getUsuariosSimple error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
  }
};
