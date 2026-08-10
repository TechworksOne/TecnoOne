// Controller: Órdenes de Trabajo (OT)
// Gestiona la asignación de reparaciones a técnicos
const db = require('../config/database');
const auditoriaService = require('../services/auditoriaService');
const permisoService = require('../services/permisoService');
const reparacionInventoryService = require('../services/reparacionInventoryService');

// Estados que ya no son trabajo activo
const ESTADOS_INACTIVOS = ['CANCELADA', 'ENTREGADA'];

// ── Helper: verificar si el usuario es admin ───────────────────────────────
function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? null;
}

function requireTenantEmpresaId(req) {
  const empresaId = getTenantEmpresaId(req);
  if (empresaId === null || empresaId === undefined || empresaId === '') {
    const error = new Error('Empresa requerida');
    error.statusCode = 403;
    throw error;
  }
  return empresaId;
}

function addRepairTenantFilter(req, where, params, alias = 'r') {
  const scope = repairTenantClause(req, alias);
  params.push(...scope.params);
  return `${where}${scope.sql}`;
}

function repairTenantClause(req, alias = 'r') {
  if (req.branchScope) {
    return reparacionInventoryService.reparacionScopeClause(req.branchScope, alias);
  }
  return isSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

// ── Columnas SELECT reutilizables ──────────────────────────────────────────
const OT_SELECT = `
  r.id,
  r.cliente_nombre,
  r.cliente_telefono,
  r.tipo_equipo,
  r.marca,
  r.modelo,
  r.estado,
  r.prioridad,
  r.fecha_ingreso,
  r.fecha_entrega_programada,
  r.tecnico_asignado_id,
  r.asignado_por,
  r.asignado_en,
  CONCAT(COALESCE(pt.nombres,''), ' ', COALESCE(pt.apellidos,'')) AS tecnico_nombre,
  ut.username AS tecnico_username,
  CONCAT(COALESCE(pa.nombres,''), ' ', COALESCE(pa.apellidos,'')) AS asignado_por_nombre,
  ua.username AS asignado_por_username
`;

// ── GET /api/ot ────────────────────────────────────────────────────────────
// Admin : todas las OT ACTIVAS (estado NOT IN CANCELADA, ENTREGADA)
// Técnico: SOLO sus OT activas asignadas (no ve las de otros ni sin asignar)
exports.getOrdenesTrabajo = async (req, res) => {
  try {
    const { estado, tecnico_id, busqueda, limit = 200 } = req.query;
    const canViewAll = await permisoService.hasPermission(req, 'ordenes_trabajo.ver_todas');

    const params = [];

    // Base: solo estados activos
    let where = `WHERE r.estado NOT IN ('CANCELADA','ENTREGADA')`;
    where = addRepairTenantFilter(req, where, params);

    // Restricción de rol: técnico solo ve sus propias reparaciones asignadas
    if (!canViewAll) {
      where += ' AND r.tecnico_asignado_id = ?';
      params.push(req.user.id);
    }

    // Filtros opcionales
    if (estado) {
      where += ' AND r.estado = ?';
      params.push(estado);
    }
    if (tecnico_id !== undefined && canViewAll) {
      const tid = parseInt(tecnico_id, 10);
      if (tid === 0) {
        // Sin asignar
        where += ' AND r.tecnico_asignado_id IS NULL';
      } else if (!isNaN(tid)) {
        where += ' AND r.tecnico_asignado_id = ?';
        params.push(tid);
      }
    }
    if (busqueda) {
      where += ` AND (
        r.cliente_nombre LIKE ? OR
        r.cliente_telefono LIKE ? OR
        r.marca LIKE ? OR
        r.modelo LIKE ? OR
        r.id LIKE ?
      )`;
      const like = `%${busqueda}%`;
      params.push(like, like, like, like, like);
    }

    params.push(parseInt(limit, 10));

    const [rows] = await db.query(
      `SELECT ${OT_SELECT}
       FROM reparaciones r
       LEFT JOIN users ut ON ut.id = r.tecnico_asignado_id
       LEFT JOIN user_profiles pt ON pt.user_id = r.tecnico_asignado_id
       LEFT JOIN users ua ON ua.id = r.asignado_por
       LEFT JOIN user_profiles pa ON pa.user_id = r.asignado_por
       ${where}
       ORDER BY r.updated_at DESC
       LIMIT ?`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getOrdenesTrabajo error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── GET /api/ot/historial ──────────────────────────────────────────────────
// Devuelve OTs canceladas y entregadas (historial).
// Admin: todas. Técnico: solo las de él.
exports.getHistorialOT = async (req, res) => {
  try {
    const { busqueda, tecnico_id, limit = 100 } = req.query;
    const canViewAll = await permisoService.hasPermission(req, 'ordenes_trabajo.ver_todas');
    const params = [];

    let where = `WHERE r.estado IN ('CANCELADA','ENTREGADA')`;
    where = addRepairTenantFilter(req, where, params);

    // Técnico solo ve su propio historial
    if (!canViewAll) {
      where += ' AND r.tecnico_asignado_id = ?';
      params.push(req.user.id);
    } else if (tecnico_id !== undefined) {
      const tid = parseInt(tecnico_id, 10);
      if (!isNaN(tid) && tid > 0) {
        where += ' AND r.tecnico_asignado_id = ?';
        params.push(tid);
      }
    }

    if (busqueda) {
      where += ` AND (
        r.cliente_nombre LIKE ? OR
        r.cliente_telefono LIKE ? OR
        r.marca LIKE ? OR
        r.modelo LIKE ? OR
        r.id LIKE ?
      )`;
      const like = `%${busqueda}%`;
      params.push(like, like, like, like, like);
    }

    params.push(parseInt(limit, 10));

    const [rows] = await db.query(
      `SELECT ${OT_SELECT}
       FROM reparaciones r
       LEFT JOIN users ut ON ut.id = r.tecnico_asignado_id
       LEFT JOIN user_profiles pt ON pt.user_id = r.tecnico_asignado_id
       LEFT JOIN users ua ON ua.id = r.asignado_por
       LEFT JOIN user_profiles pa ON pa.user_id = r.asignado_por
       ${where}
       ORDER BY r.updated_at DESC
       LIMIT ?`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getHistorialOT error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── GET /api/ot/resumen ────────────────────────────────────────────────────
// Dashboard: conteos para tarjetas KPI.
// Admin: conteos globales + carga por técnico.
// Técnico: solo sus propios conteos.
exports.getResumenOT = async (req, res) => {
  try {
    const canViewAll = await permisoService.hasPermission(req, 'ordenes_trabajo.ver_todas');
    const tenant = repairTenantClause(req);

    if (canViewAll) {
      // Conteos por estado (solo activos)
      const [stateCounts] = await db.query(
        `SELECT estado, COUNT(*) AS total
         FROM reparaciones
         WHERE estado NOT IN ('CANCELADA','ENTREGADA')${tenant.sql.replaceAll('r.', '')}
         GROUP BY estado`,
        tenant.params
      );

      // Conteo sin asignar
      const [[sinAsignarRow]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM reparaciones
         WHERE tecnico_asignado_id IS NULL
           AND estado NOT IN ('CANCELADA','ENTREGADA')${tenant.sql.replaceAll('r.', '')}`,
        tenant.params
      );

      // Carga por técnico
      const [techRows] = await db.query(
        `SELECT
           r.tecnico_asignado_id AS id,
           TRIM(CONCAT(COALESCE(pt.nombres,''), ' ', COALESCE(pt.apellidos,''))) AS nombre,
           ut.username,
           pt.foto_perfil,
           COUNT(*) AS total_activas,
           SUM(CASE WHEN r.estado = 'EN_REPARACION'   THEN 1 ELSE 0 END) AS en_reparacion,
           SUM(CASE WHEN r.estado = 'ESPERANDO_PIEZA' THEN 1 ELSE 0 END) AS esperando_pieza,
           SUM(CASE WHEN r.estado = 'COMPLETADA'      THEN 1 ELSE 0 END) AS listas,
           SUM(CASE WHEN r.estado = 'EN_DIAGNOSTICO'  THEN 1 ELSE 0 END) AS en_diagnostico
         FROM reparaciones r
         JOIN users ut ON ut.id = r.tecnico_asignado_id
         LEFT JOIN user_profiles pt ON pt.user_id = r.tecnico_asignado_id
         WHERE r.tecnico_asignado_id IS NOT NULL
           AND r.estado NOT IN ('CANCELADA','ENTREGADA')
           ${tenant.sql}
         GROUP BY r.tecnico_asignado_id, pt.nombres, pt.apellidos, pt.foto_perfil, ut.username
         ORDER BY total_activas DESC`,
        tenant.params
      );

      const porEstado = {};
      stateCounts.forEach(r => { porEstado[r.estado] = Number(r.total); });

      const tecnicos = techRows.map(t => ({
        id: t.id,
        nombre: (t.nombre && t.nombre.trim() !== '') ? t.nombre : t.username,
        username: t.username,
        foto_perfil: t.foto_perfil || null,
        total_activas:  Number(t.total_activas  || 0),
        en_reparacion:  Number(t.en_reparacion  || 0),
        esperando_pieza: Number(t.esperando_pieza || 0),
        listas:         Number(t.listas         || 0),
        en_diagnostico: Number(t.en_diagnostico || 0),
      }));

      return res.json({
        success: true,
        data: {
          porEstado,
          sinAsignar: Number(sinAsignarRow?.total ?? 0),
          tecnicos,
        },
      });
    } else {
      // Técnico: sus propios conteos
      const userId = req.user.id;

      const [stateCounts] = await db.query(
        `SELECT estado, COUNT(*) AS total
         FROM reparaciones
         WHERE tecnico_asignado_id = ?
           AND estado NOT IN ('CANCELADA','ENTREGADA')
           ${tenant.sql.replaceAll('r.', '')}
         GROUP BY estado`,
        [userId, ...tenant.params]
      );

      const [[vencidasRow]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM reparaciones
         WHERE tecnico_asignado_id = ?
           AND estado NOT IN ('CANCELADA','ENTREGADA')
           AND fecha_entrega_programada IS NOT NULL
           AND fecha_entrega_programada < NOW()
           ${tenant.sql.replaceAll('r.', '')}`,
        [userId, ...tenant.params]
      );

      const porEstado = {};
      stateCounts.forEach(r => { porEstado[r.estado] = Number(r.total); });

      return res.json({
        success: true,
        data: {
          porEstado,
          vencidas: Number(vencidasRow?.total ?? 0),
        },
      });
    }
  } catch (error) {
    console.error('getResumenOT error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/reparaciones/:id/asignar-tecnico ────────────────────────────
// Asigna o cambia el técnico de una reparación
exports.asignarTecnico = async (req, res) => {
  try {
    const { id } = req.params;
    const { tecnico_id } = req.body;

    if (!tecnico_id) {
      return res.status(400).json({ success: false, message: 'tecnico_id es requerido' });
    }

    // Verificar que la reparación existe
    const tenant = repairTenantClause(req);
    const [[rep]] = await db.query(`SELECT id FROM reparaciones WHERE id = ?${tenant.sql.replaceAll('r.', '')}`, [id, ...tenant.params]);
    if (!rep) {
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }

    // Verificar que el técnico es un usuario válido y activo
    const [[tecnico]] = await db.query(
      `SELECT u.id, u.username, u.name,
              CONCAT(COALESCE(p.nombres,''), ' ', COALESCE(p.apellidos,'')) AS nombre_completo
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.active = 1
         AND u.empresa_id = ?
         AND EXISTS (
           SELECT 1 FROM usuario_sucursales us
           WHERE us.usuario_id = u.id
             AND us.empresa_id = u.empresa_id
             AND us.sucursal_id = ?
         )`,
      [parseInt(tecnico_id, 10), requireTenantEmpresaId(req), Number(req.branchScope.sucursalId)]
    );
    if (!tecnico) {
      return res.status(404).json({ success: false, message: 'Técnico no encontrado o inactivo' });
    }

    // Actualizar asignación (tecnico_asignado guarda el nombre para compatibilidad con dashboard)
    await db.query(
      `UPDATE reparaciones
         SET tecnico_asignado    = ?,
             tecnico_asignado_id = ?,
             asignado_por = ?,
             asignado_en = NOW()
       WHERE id = ?${tenant.sql.replaceAll('r.', '')}`,
      [tecnico.name, parseInt(tecnico_id, 10), req.user.id, id, ...tenant.params]
    );

    // Devolver datos actualizados
    const [[updated]] = await db.query(
      `SELECT
         r.tecnico_asignado_id,
         r.asignado_por,
         r.asignado_en,
         CONCAT(COALESCE(pt.nombres,''), ' ', COALESCE(pt.apellidos,'')) AS tecnico_nombre,
         ut.username AS tecnico_username,
         CONCAT(COALESCE(pa.nombres,''), ' ', COALESCE(pa.apellidos,'')) AS asignado_por_nombre
       FROM reparaciones r
       LEFT JOIN users ut ON ut.id = r.tecnico_asignado_id
       LEFT JOIN user_profiles pt ON pt.user_id = r.tecnico_asignado_id
       LEFT JOIN users ua ON ua.id = r.asignado_por
       LEFT JOIN user_profiles pa ON pa.user_id = r.asignado_por
       WHERE r.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    await auditoriaService.registrar({
      req,
      empresaId: req.tenant?.empresa_id,
      accion: 'ASIGNAR_TECNICO',
      entidad: 'REPARACION',
      entidadId: id,
      descripcion: `Técnico ${tecnico.name || tecnico.username || tecnico.id} asignado`,
      datosNuevos: { tecnico_id: tecnico.id, tecnico_nombre: tecnico.name || tecnico.nombre_completo },
    });
    res.json({
      success: true,
      message: 'Técnico asignado correctamente',
      data: updated,
    });
  } catch (error) {
    console.error('asignarTecnico error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/reparaciones/:id/asignar-tecnico ───────────────────────────
// Quita la asignación técnica de una reparación
exports.quitarAsignacion = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = repairTenantClause(req);
    const [[rep]] = await db.query(`SELECT id FROM reparaciones WHERE id = ?${tenant.sql.replaceAll('r.', '')}`, [id, ...tenant.params]);
    if (!rep) {
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }

    await db.query(
      `UPDATE reparaciones
         SET tecnico_asignado    = NULL,
             tecnico_asignado_id = NULL,
             asignado_por = NULL,
             asignado_en = NULL
       WHERE id = ?${tenant.sql.replaceAll('r.', '')}`,
      [id, ...tenant.params]
    );

    res.json({ success: true, message: 'Asignación eliminada correctamente' });
  } catch (error) {
    console.error('quitarAsignacion error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── GET /api/usuarios/tecnicos ─────────────────────────────────────────────
// Devuelve usuarios que pueden recibir OT (rol ADMINISTRADOR o TECNICO, activos)
exports.getTecnicos = async (req, res) => {
  try {
    const allowedSucursalIds = req.branchScope.mode === 'specific'
      ? [Number(req.branchScope.sucursalId)]
      : req.branchScope.allowedSucursalIds.map(Number).filter(Number.isInteger);
    if (!allowedSucursalIds.length) {
      return res.json({ success: true, data: [] });
    }
    const branchPlaceholders = allowedSucursalIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT
         u.id,
         u.username,
         u.name,
         u.email,
         CONCAT(COALESCE(p.nombres,''), ' ', COALESCE(p.apellidos,'')) AS nombre_completo,
         GROUP_CONCAT(DISTINCT r.nombre ORDER BY r.nombre SEPARATOR ',') AS roles
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       INNER JOIN usuario_sucursales us
         ON us.usuario_id = u.id
        AND us.empresa_id = u.empresa_id
        AND us.sucursal_id IN (${branchPlaceholders})
        WHERE u.active = 1 AND u.empresa_id = ?
       GROUP BY u.id, u.username, u.name, u.email, p.nombres, p.apellidos
       HAVING SUM(
           CASE WHEN LOWER(r.nombre) IN ('admin','administrador','tecnico','técnico') THEN 1 ELSE 0 END
         ) > 0
       ORDER BY nombre_completo, u.username`,
      [...allowedSucursalIds, requireTenantEmpresaId(req)]
    );

    const result = rows.map(u => ({
      ...u,
      roles: u.roles ? u.roles.split(',') : [],
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('getTecnicos error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
