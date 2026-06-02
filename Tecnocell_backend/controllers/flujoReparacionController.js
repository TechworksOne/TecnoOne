// Controller para gestionar el flujo de reparaciones (estados, checklist, historial)
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const sanitized = basename.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    cb(null, `ingreso_${sanitized}_${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

exports.uploadMiddleware = upload.array('fotos', 10);

// ========== GUARDAR/ACTUALIZAR CHECKLIST DE INGRESO DE EQUIPO ==========
exports.saveIngresoEquipo = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id: reparacionId } = req.params;
    const { checks, observaciones } = req.body;
    
    // Validaciones
    if (!checks) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar los checks del equipo'
      });
    }
    
    // Verificar que la reparación existe
    const [reparaciones] = await connection.query(
      'SELECT id, tipo_equipo FROM reparaciones WHERE id = ?',
      [reparacionId]
    );
    
    if (reparaciones.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Reparación no encontrada'
      });
    }
    
    const tipoEquipo = reparaciones[0].tipo_equipo;
    
    // Procesar fotos si fueron subidas
    const fotos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        fotos.push({
          filename: file.filename,
          url_path: `/uploads/reparaciones/${reparacionId}/ingreso/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype
        });
      }
    }
    
    // Verificar si ya existe un checklist para esta reparación
    const [existing] = await connection.query(
      'SELECT id FROM ingreso_equipo_checklist WHERE reparacion_id = ?',
      [reparacionId]
    );
    
    if (existing.length > 0) {
      // Actualizar existente
      await connection.query(
        `UPDATE ingreso_equipo_checklist 
         SET checks = ?, fotos = ?, observaciones = ?, updated_at = NOW()
         WHERE reparacion_id = ?`,
        [
          JSON.stringify(checks),
          fotos.length > 0 ? JSON.stringify(fotos) : null,
          observaciones,
          reparacionId
        ]
      );
    } else {
      // Crear nuevo
      await connection.query(
        `INSERT INTO ingreso_equipo_checklist 
         (reparacion_id, tipo_equipo, checks, fotos, observaciones)
         VALUES (?, ?, ?, ?, ?)`,
        [
          reparacionId,
          tipoEquipo,
          JSON.stringify(checks),
          fotos.length > 0 ? JSON.stringify(fotos) : null,
          observaciones
        ]
      );
    }
    
    await connection.commit();
    
    res.status(200).json({
      success: true,
      message: 'Checklist de ingreso guardado exitosamente',
      data: {
        reparacion_id: reparacionId,
        checks: checks,
        fotos: fotos,
        observaciones: observaciones
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al guardar checklist de ingreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar checklist de ingreso',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ========== OBTENER CHECKLIST DE INGRESO DE EQUIPO ==========
exports.getIngresoEquipo = async (req, res) => {
  try {
    const { id: reparacionId } = req.params;
    
    const [checklist] = await db.query(
      `SELECT 
        ic.*,
        r.tipo_equipo,
        r.marca,
        r.modelo
       FROM ingreso_equipo_checklist ic
       INNER JOIN reparaciones r ON ic.reparacion_id = r.id
       WHERE ic.reparacion_id = ?`,
      [reparacionId]
    );
    
    if (checklist.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró checklist de ingreso para esta reparación'
      });
    }
    
    // Parsear JSON
    const data = checklist[0];
    data.checks = JSON.parse(data.checks);
    data.fotos = data.fotos ? JSON.parse(data.fotos) : [];
    
    res.json({
      success: true,
      data: data
    });
    
  } catch (error) {
    console.error('❌ Error al obtener checklist de ingreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener checklist de ingreso',
      error: error.message
    });
  }
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
    
    // Actualizar estado en reparaciones
    if (nuevoEstado === 'ENTREGADA') {
      await connection.query(
        'UPDATE reparaciones SET estado = ?, fecha_entrega = NOW(), fecha_cierre = CURDATE(), updated_at = NOW() WHERE id = ?',
        [nuevoEstado, reparacionId]
      );
    } else {
      await connection.query(
        'UPDATE reparaciones SET estado = ?, updated_at = NOW() WHERE id = ?',
        [nuevoEstado, reparacionId]
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
    
    await db.query(
      'UPDATE reparaciones SET tecnico_asignado = ?, updated_at = NOW() WHERE id = ?',
      [tecnicoNombre, reparacionId]
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
    
    await db.query(
      'UPDATE reparaciones SET prioridad = ?, updated_at = NOW() WHERE id = ?',
      [prioridad, reparacionId]
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

    let query = `
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM ingreso_equipo_checklist WHERE reparacion_id = r.id) as tiene_checklist
      FROM reparaciones r
      WHERE r.estado NOT IN (${ESTADOS_EXCLUIDOS_FLUJO.map(() => '?').join(',')})
    `;
    const params = [...ESTADOS_EXCLUIDOS_FLUJO];

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
    params.push(parseInt(limit));

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
      WHERE r.estado = 'ENTREGADA'
    `;
    const params = [];

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
    params.push(parseInt(limit));

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
    const [[rep]] = await connection.query('SELECT * FROM reparaciones WHERE id = ?', [reparacionId]);

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
       WHERE id = ?`,
      [motivo.trim(), repuesto.trim(), tecnico || null, reparacionId]
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
