// Controller: Agenda de entregas de reparaciones
// Devuelve reparaciones con fecha_entrega_programada para el calendario de entregas.

const db = require('../config/database');

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? 1;
}

function repairTenantClause(req, alias = 'r') {
  return isSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [getTenantEmpresaId(req)] };
}

// ─── GET /api/agenda/entregas ─────────────────────────────────────────────
// Retorna reparaciones que tienen fecha_entrega_programada asignada.
// Filtros opcionales: fecha_inicio, fecha_fin, estado (query params)
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

// ─── PATCH /api/reparaciones/:id/fecha-entrega ────────────────────────────
// Actualiza fecha_entrega_programada y nota_entrega_programada
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

    // Verificar que la reparación exista
    const tenant = repairTenantClause(req);
    const [rows] = await db.query(`SELECT id FROM reparaciones WHERE id = ?${tenant.sql.replace('r.', '')}`, [id, ...tenant.params]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }

    await db.query(
      `UPDATE reparaciones
         SET fecha_entrega_programada = ?,
             nota_entrega_programada  = ?,
             updated_at               = NOW()
       WHERE id = ?${tenant.sql.replace('r.', '')}`,
      [fecha_entrega_programada, nota_entrega_programada ?? null, id, ...tenant.params]
    );

    // Devolver la reparación actualizada (campos de entrega)
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

// ─── DELETE /api/reparaciones/:id/fecha-entrega ───────────────────────────
// Limpia la fecha programada de entrega (sin borrar la reparación)
exports.deleteFechaEntrega = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = repairTenantClause(req);
    const [rows] = await db.query(`SELECT id FROM reparaciones WHERE id = ?${tenant.sql.replace('r.', '')}`, [id, ...tenant.params]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
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

// ─── Auto-crear tabla agenda_eventos si no existe ─────────────────────────────
const ensureEventosTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS agenda_eventos (
      id INT AUTO_INCREMENT PRIMARY KEY,
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Migración: agregar columnas nuevas si la tabla ya existía sin ellas
  const [[col]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agenda_eventos' AND COLUMN_NAME = 'para_rol'`
  );
  if (col.cnt === 0) {
    await db.query(`ALTER TABLE agenda_eventos ADD COLUMN creado_por_id INT DEFAULT NULL`);
    await db.query(`ALTER TABLE agenda_eventos ADD COLUMN para_rol VARCHAR(50) DEFAULT NULL`);
    await db.query(`ALTER TABLE agenda_eventos ADD COLUMN para_usuario_id INT DEFAULT NULL`);
    await db.query(`ALTER TABLE agenda_eventos ADD COLUMN para_usuario_nombre VARCHAR(150) DEFAULT NULL`);
  }
};

// ─── GET /api/agenda/eventos ──────────────────────────────────────────────────
exports.getEventos = async (req, res) => {
  try {
    await ensureEventosTable();
    const { fecha_inicio, fecha_fin } = req.query;
    const userId = req.user?.id ?? null;
    const userRoles = Array.isArray(req.user?.roles)
      ? req.user.roles
      : (req.user?.role ? [req.user.role] : []);

    let query = 'SELECT * FROM agenda_eventos WHERE 1=1';
    const params = [];
    if (fecha_inicio) { query += ' AND fecha >= ?'; params.push(fecha_inicio); }
    if (fecha_fin)    { query += ' AND fecha <= ?'; params.push(fecha_fin); }

    // Filtro de visibilidad: públicos + asignados a mí + mi rol + los que yo creé
    const rolePH = userRoles.length > 0 ? userRoles.map(() => '?').join(',') : null;
    query += ` AND (
      (para_rol IS NULL AND para_usuario_id IS NULL)
      OR para_usuario_id = ?
      OR creado_por_id = ?
      ${rolePH ? `OR para_rol IN (${rolePH})` : ''}
    )`;
    params.push(userId, userId);
    if (rolePH) params.push(...userRoles);

    query += ' ORDER BY fecha ASC, COALESCE(hora, "00:00:00") ASC';
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[agendaController] getEventos error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener eventos' });
  }
};

// ─── POST /api/agenda/eventos ─────────────────────────────────────────────────
exports.createEvento = async (req, res) => {
  try {
    await ensureEventosTable();
    const { titulo, fecha, hora, descripcion, tipo, para_rol, para_usuario_id, para_usuario_nombre } = req.body;
    if (!titulo || !fecha) {
      return res.status(400).json({ success: false, message: 'titulo y fecha son obligatorios' });
    }
    const creadorNombre = req.user?.name || req.user?.email || null;
    const creadorId = req.user?.id || null;
    const [result] = await db.query(
      `INSERT INTO agenda_eventos
        (titulo, fecha, hora, descripcion, tipo, creado_por, creado_por_id, para_rol, para_usuario_id, para_usuario_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        titulo.trim(), fecha, hora || null, descripcion?.trim() || null, tipo || 'nota',
        creadorNombre, creadorId,
        para_rol || null,
        para_usuario_id ? Number(para_usuario_id) : null,
        para_usuario_nombre || null,
      ]
    );
    const [rows] = await db.query('SELECT * FROM agenda_eventos WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[agendaController] createEvento error:', error);
    res.status(500).json({ success: false, message: 'Error al crear evento' });
  }
};

// ─── PUT /api/agenda/eventos/:id ──────────────────────────────────────────────
exports.updateEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, fecha, hora, descripcion, tipo } = req.body;
    if (!titulo || !fecha) {
      return res.status(400).json({ success: false, message: 'titulo y fecha son obligatorios' });
    }
    const [check] = await db.query('SELECT id FROM agenda_eventos WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    }
    const { para_rol, para_usuario_id, para_usuario_nombre } = req.body;
    await db.query(
      `UPDATE agenda_eventos
         SET titulo=?, fecha=?, hora=?, descripcion=?, tipo=?,
             para_rol=?, para_usuario_id=?, para_usuario_nombre=?
       WHERE id=?`,
      [
        titulo.trim(), fecha, hora || null, descripcion?.trim() || null, tipo || 'nota',
        para_rol || null,
        para_usuario_id ? Number(para_usuario_id) : null,
        para_usuario_nombre || null,
        id,
      ]
    );
    const [rows] = await db.query('SELECT * FROM agenda_eventos WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[agendaController] updateEvento error:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar evento' });
  }
};

// ─── DELETE /api/agenda/eventos/:id ──────────────────────────────────────────
exports.deleteEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const [check] = await db.query('SELECT id FROM agenda_eventos WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    }
    await db.query('DELETE FROM agenda_eventos WHERE id = ?', [id]);
    res.json({ success: true, message: 'Evento eliminado' });
  } catch (error) {
    console.error('[agendaController] deleteEvento error:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar evento' });
  }
};

// ─── GET /api/agenda/usuarios — lista simple para el selector del admin ───────
exports.getUsuariosSimple = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id,
              TRIM(CONCAT(COALESCE(p.nombres,''), ' ', COALESCE(p.apellidos,''))) AS nombre_completo,
              u.username,
              GROUP_CONCAT(r.nombre ORDER BY r.nombre SEPARATOR ',') AS roles
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.active = 1 OR u.active IS NULL
        GROUP BY u.id
        ORDER BY COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.nombres,''),' ',COALESCE(p.apellidos,''))),''), u.username)`
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
