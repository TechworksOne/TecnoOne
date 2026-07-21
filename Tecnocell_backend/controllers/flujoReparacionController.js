// Controller para gestionar el flujo de reparaciones (estados, checklist, historial)
const db = require('../config/database');
const { parseLimit } = require('../utils/pagination');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { imageFileFilter, getSafeImageExtension, sanitizeBaseName } = require('../utils/uploadSecurity');

// Ruta base de uploads — siempre absoluta para ser compatible con Docker bind mount
// Dentro del contenedor es /app/uploads (mapeado a /var/www/Tecnocell_storage/uploads en el host)
const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');

// Configuración de Multer para imágenes de ingreso de equipo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const repairId = req.params.id || req.body.reparacion_id;

    // Estructura: /app/uploads/reparaciones/REP123456/ingreso/
    const uploadPath = path.join(UPLOADS_BASE, 'reparaciones', repairId, 'ingreso');

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = getSafeImageExtension(file);
    const sanitized = sanitizeBaseName(file.originalname, 'ingreso');
    
    cb(null, `ingreso_${sanitized}_${timestamp}${ext}`);
  }
});

const fileFilter = imageFileFilter;

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

exports.uploadMiddleware = upload.array('fotos', 10);

const reparacionInventoryService = require('../services/reparacionInventoryService');

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true;
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? null;
}

function repairTenantClause(req, alias = 'r') {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  return {
    sql: ` AND ${alias}.empresa_id = ?`,
    params: [getTenantEmpresaId(req)]
  };
}

/**
 * Cláusula empresa+sucursal usando branchScope cuando está disponible.
 * specific  → empresa_id = ? AND sucursal_id = ?
 * consolidated → empresa_id = ? AND sucursal_id IN (?,...)
 * fallback (no branchScope) → empresa_id = ?
 */
function flujoScopeClause(req, alias = 'r') {
  if (req.branchScope) {
    return reparacionInventoryService.reparacionScopeClause(req.branchScope, alias);
  }
  return repairTenantClause(req, alias);
}

/**
 * Carga y valida una reparación contra empresa+sucursal del branchScope.
 * Retorna null si no existe o si pertenece a otra sucursal.
 */
async function validateReparacionScope(connectionOrDb, reparacionId, req) {
  const scope = flujoScopeClause(req, 'r');
  const [reparaciones] = await connectionOrDb.query(
    `SELECT r.*
     FROM reparaciones r
     WHERE r.id = ?${scope.sql}
     LIMIT 1`,
    [reparacionId, ...scope.params]
  );
  return reparaciones[0] || null;
}

// Alias de compatibilidad para código interno que no fue migrado aún
const validateReparacionForTenant = validateReparacionScope;

// ========== GUARDAR/ACTUALIZAR CHECKLIST DE INGRESO DE EQUIPO ==========
exports.legacyIngresoEquipoDisabled = (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'LEGACY_CHECKLIST_ENDPOINT_DISABLED',
    message: 'Este endpoint fue reemplazado por /api/check-equipo.'
  });
};

// ========== CAMBIAR ESTADO DE REPARACIÓN ==========
exports.cambiarEstado = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id: reparacionId } = req.params;
    const { nuevoEstado, nota, userId, userName } = req.body;
    
    // Validaciones
    const estadosPermitidos = [
      'RECIBIDA', 'EN_DIAGNOSTICO', 'ESPERANDO_AUTORIZACION', 'AUTORIZADA',
      'EN_REPARACION', 'ESPERANDO_PIEZA', 'COMPLETADA', 'ENTREGADA',
      'CANCELADA', 'STAND_BY'
    ];
    
    if (!estadosPermitidos.includes(nuevoEstado)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Estado no válido'
      });
    }
    
    const reparacion = await validateReparacionScope(connection, reparacionId, req);
    if (!reparacion) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Reparacion no encontrada'
      });
    }

    // Actualizar estado en reparaciones
    if (nuevoEstado === 'ENTREGADA') {
      await connection.query(
        'UPDATE reparaciones SET estado = ?, fecha_entrega = NOW(), fecha_cierre = CURDATE(), updated_at = NOW() WHERE id = ? AND empresa_id = ? AND sucursal_id = ?',
        [nuevoEstado, reparacionId, reparacion.empresa_id, reparacion.sucursal_id]
      );
    } else {
      await connection.query(
        'UPDATE reparaciones SET estado = ?, updated_at = NOW() WHERE id = ? AND empresa_id = ? AND sucursal_id = ?',
        [nuevoEstado, reparacionId, reparacion.empresa_id, reparacion.sucursal_id]
      );
    }

    // Registrar en historial
    await connection.query(
      `INSERT INTO reparaciones_historial 
       (reparacion_id, estado, nota, user_nombre, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [reparacionId, nuevoEstado, nota || `Estado cambiado a ${nuevoEstado}`, userName || 'Sistema', userId || null]
    );
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      data: {
        reparacion_id: reparacionId,
        nuevo_estado: nuevoEstado
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al cambiar estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ========== OBTENER HISTORIAL DE REPARACIÓN ==========
exports.getHistorial = async (req, res) => {
  try {
    const { id: reparacionId } = req.params;

    const reparacion = await validateReparacionScope(db, reparacionId, req);
    if (!reparacion) {
      return res.status(404).json({
        success: false,
        message: 'Reparacion no encontrada'
      });
    }
    
    const [historial] = await db.query(
      `SELECT 
        h.*,
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', i.id,
            'filename', i.filename,
            'url_path', i.url_path,
            'tipo', i.tipo
          )
        )
        FROM reparaciones_imagenes i
        WHERE i.historial_id = h.id) as imagenes
       FROM reparaciones_historial h
       WHERE h.reparacion_id = ?
       ORDER BY h.created_at DESC`,
      [reparacionId]
    );
    
    res.json({
      success: true,
      data: historial.map(h => ({
        ...h,
        imagenes: h.imagenes ? JSON.parse(h.imagenes) : []
      }))
    });
    
  } catch (error) {
    console.error('❌ Error al obtener historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
    });
  }
};

// ========== ASIGNAR TÉCNICO ==========
exports.asignarTecnico = async (req, res) => {
  try {
    const { id: reparacionId } = req.params;
    const { tecnicoId, tecnicoNombre } = req.body;

    const reparacion = await validateReparacionScope(db, reparacionId, req);
    if (!reparacion) {
      return res.status(404).json({
        success: false,
        message: 'Reparacion no encontrada'
      });
    }

    if (tecnicoId) {
      const [tecnicos] = await db.query(
        'SELECT id FROM users WHERE id = ? AND empresa_id = ? AND active = TRUE LIMIT 1',
        [tecnicoId, reparacion.empresa_id]
      );

      if (tecnicos.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tecnico no encontrado'
        });
      }
    }
    
    await db.query(
      'UPDATE reparaciones SET tecnico_asignado = ?, updated_at = NOW() WHERE id = ? AND empresa_id = ? AND sucursal_id = ?',
      [tecnicoNombre, reparacionId, reparacion.empresa_id, reparacion.sucursal_id]
    );
    
    res.json({
      success: true,
      message: 'Técnico asignado exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error al asignar técnico:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar técnico',
      error: error.message
    });
  }
};

// ========== CAMBIAR PRIORIDAD ==========
exports.cambiarPrioridad = async (req, res) => {
  try {
    const { id: reparacionId } = req.params;
    const { prioridad } = req.body;
    
    const prioridadesPermitidas = ['BAJA', 'MEDIA', 'ALTA'];
    
    if (!prioridadesPermitidas.includes(prioridad)) {
      return res.status(400).json({
        success: false,
        message: 'Prioridad no válida'
      });
    }
    
    const reparacion = await validateReparacionScope(db, reparacionId, req);
    if (!reparacion) {
      return res.status(404).json({
        success: false,
        message: 'Reparacion no encontrada'
      });
    }

    await db.query(
      'UPDATE reparaciones SET prioridad = ?, updated_at = NOW() WHERE id = ? AND empresa_id = ? AND sucursal_id = ?',
      [prioridad, reparacionId, reparacion.empresa_id, reparacion.sucursal_id]
    );
    
    res.json({
      success: true,
      message: 'Prioridad actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error al cambiar prioridad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar prioridad',
      error: error.message
    });
  }
};

// ========== REPARACIONES DEL FLUJO ACTIVO (excluye terminales) ==========
const ESTADOS_EXCLUIDOS_FLUJO = ['ENTREGADA', 'CANCELADA', 'ANULADA', 'CANCELADO'];

exports.getReparacionesFlujoActivo = async (req, res) => {
  try {
    const { search, prioridad, limit = 200 } = req.query;
    const tenant = flujoScopeClause(req, 'r');

    let query = `
      SELECT 
        r.*,
        EXISTS (
            SELECT 1
            FROM check_equipo ce
            WHERE ce.reparacion_id = r.id
          ) AS tiene_checklist
      FROM reparaciones r
      WHERE r.estado NOT IN (${ESTADOS_EXCLUIDOS_FLUJO.map(() => '?').join(',')})${tenant.sql}
    `;
    const params = [...ESTADOS_EXCLUIDOS_FLUJO, ...tenant.params];

    if (prioridad) {
      query += ' AND r.prioridad = ?';
      params.push(prioridad);
    }

    if (search) {
      query += ` AND (r.id LIKE ? OR r.cliente_nombre LIKE ? OR r.marca LIKE ? OR r.modelo LIKE ? OR r.cliente_telefono LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    query += ' ORDER BY r.updated_at DESC LIMIT ?';
    params.push(parseLimit(limit, { defaultLimit: 50, maxLimit: 100 }));

    const [rows] = await db.query(query, params);

    const data = rows.map(r => ({
      ...r,
      mano_obra:    r.mano_obra    / 100,
      subtotal:     r.subtotal     / 100,
      impuestos:    r.impuestos    / 100,
      total:        r.total        / 100,
      monto_anticipo: r.monto_anticipo / 100,
      saldo_anticipo: r.saldo_anticipo / 100,
      total_invertido: (r.total_invertido || 0) / 100,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error flujo activo:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== HISTORIAL DE REPARACIONES ENTREGADAS ==========
exports.getEntregadas = async (req, res) => {
  try {
    const { search, estado_garantia, fecha_inicio, fecha_fin, limit = 200 } = req.query;
    const tenant = flujoScopeClause(req, 'r');

    let query = `
      SELECT
        r.*,
        COALESCE(DATE(r.fecha_entrega), r.fecha_cierre) AS fecha_entrega_calc,
        CASE
          WHEN (r.garantia_dias IS NULL OR r.garantia_dias = 0 OR (r.fecha_entrega IS NULL AND r.fecha_cierre IS NULL))
            THEN 'sin_garantia'
          WHEN DATE_ADD(COALESCE(DATE(r.fecha_entrega), r.fecha_cierre), INTERVAL r.garantia_dias DAY) >= CURDATE()
            THEN 'vigente'
          ELSE 'vencida'
        END AS estado_garantia,
        DATE_ADD(COALESCE(DATE(r.fecha_entrega), r.fecha_cierre), INTERVAL r.garantia_dias DAY) AS fecha_garantia_fin
      FROM reparaciones r
      WHERE r.estado = 'ENTREGADA'${tenant.sql}
    `;
    const params = [...tenant.params];

    if (search) {
      query += ` AND (r.id LIKE ? OR r.cliente_nombre LIKE ? OR r.marca LIKE ? OR r.modelo LIKE ? OR r.cliente_telefono LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    if (fecha_inicio) {
      query += ' AND COALESCE(DATE(r.fecha_entrega), r.fecha_cierre) >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      query += ' AND COALESCE(DATE(r.fecha_entrega), r.fecha_cierre) <= ?';
      params.push(fecha_fin);
    }

    // Filtro de garantía aplicado post-query o via HAVING
    if (estado_garantia) {
      if (estado_garantia === 'vigente') {
        query += ` AND r.garantia_dias > 0
          AND DATE_ADD(COALESCE(DATE(r.fecha_entrega), r.fecha_cierre), INTERVAL r.garantia_dias DAY) >= CURDATE()`;
      } else if (estado_garantia === 'vencida') {
        query += ` AND r.garantia_dias > 0
          AND DATE_ADD(COALESCE(DATE(r.fecha_entrega), r.fecha_cierre), INTERVAL r.garantia_dias DAY) < CURDATE()`;
      } else if (estado_garantia === 'sin_garantia') {
        query += ` AND (r.garantia_dias IS NULL OR r.garantia_dias = 0)`;
      }
    }

    query += ' ORDER BY COALESCE(r.fecha_entrega, r.fecha_cierre) DESC LIMIT ?';
    params.push(parseLimit(limit, { defaultLimit: 50, maxLimit: 100 }));

    const [rows] = await db.query(query, params);

    const data = rows.map(r => ({
      ...r,
      mano_obra:      r.mano_obra      / 100,
      subtotal:       r.subtotal       / 100,
      impuestos:      r.impuestos      / 100,
      total:          r.total          / 100,
      monto_anticipo: r.monto_anticipo / 100,
      saldo_anticipo: r.saldo_anticipo / 100,
      total_invertido:(r.total_invertido || 0) / 100,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error historial entregadas:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== REINGRESAR POR GARANTÍA ==========
exports.reingresarGarantia = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id: reparacionId } = req.params;
    const { motivo, repuesto, observaciones, tecnico, userId, userName } = req.body;

    // Validaciones de entrada
    if (!motivo || !motivo.trim()) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'El motivo del reingreso es obligatorio.' });
    }
    if (!repuesto || !repuesto.trim()) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Debe indicar el repuesto afectado.' });
    }

    // Obtener reparación
    const rep = await validateReparacionScope(connection, reparacionId, req);

    if (!rep) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Reparación no encontrada.' });
    }

    if (rep.estado !== 'ENTREGADA') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Solo se pueden reingresar reparaciones con estado ENTREGADA.' });
    }

    // Validar garantía vigente
    const fechaBase = rep.fecha_entrega ? new Date(rep.fecha_entrega) : (rep.fecha_cierre ? new Date(rep.fecha_cierre) : null);
    if (!fechaBase) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'La reparación no tiene fecha de entrega registrada.' });
    }

    const garantiaDias = rep.garantia_dias || 0;
    if (garantiaDias === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Esta reparación no tiene garantía registrada.' });
    }

    const fechaGarantiaFin = new Date(fechaBase);
    fechaGarantiaFin.setDate(fechaGarantiaFin.getDate() + garantiaDias);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaGarantiaFin < hoy) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `La garantía venció el ${fechaGarantiaFin.toLocaleDateString('es-GT')}. Debe crear una nueva reparación.`
      });
    }

    // Actualizar reparación: vuelve al flujo activo
    await connection.query(
      `UPDATE reparaciones SET
        estado          = 'EN_DIAGNOSTICO',
        prioridad       = 'ALTA',
        es_garantia     = 1,
        motivo_garantia = ?,
        repuesto_garantia = ?,
        fecha_reingreso = NOW(),
        tecnico_asignado = COALESCE(?, tecnico_asignado),
        updated_at      = NOW()
       WHERE id = ? AND empresa_id = ? AND sucursal_id = ?`,
      [motivo.trim(), repuesto.trim(), tecnico || null, reparacionId, rep.empresa_id, rep.sucursal_id]
    );

    // Registrar en historial
    const nota = `Reingreso por garantía. Repuesto afectado: ${repuesto}. Motivo: ${motivo}.${observaciones ? ' Obs: ' + observaciones : ''}`;
    await connection.query(
      `INSERT INTO reparaciones_historial
       (reparacion_id, estado, nota, user_nombre, tipo_evento, estado_anterior, descripcion, created_by)
       VALUES (?, 'EN_DIAGNOSTICO', ?, ?, 'REINGRESO_GARANTIA', 'ENTREGADA', ?, ?)`,
      [reparacionId, nota, userName || 'Sistema', nota, userId || null]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Reparación reingresada por garantía. Ahora aparece en el flujo con prioridad ALTA.',
      data: { reparacion_id: reparacionId, nuevo_estado: 'EN_DIAGNOSTICO', prioridad: 'ALTA', es_garantia: 1 }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error reingresar garantía:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

module.exports = exports;
