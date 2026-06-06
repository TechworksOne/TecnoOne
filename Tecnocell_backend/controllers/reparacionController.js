// Controller para gestionar reparaciones con imágenes
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cajaController = require('./cajaController');
const contratoService = require('../services/contratoService');

// Métodos de pago válidos (igual que ventas)
const VALID_METODOS_PAGO_REP = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_BAC', 'TARJETA_NEONET', 'TARJETA_OTRA'];
function normalizarMetodoPago(m) {
  if (!m) return null;
  return VALID_METODOS_PAGO_REP.includes(m.toUpperCase()) ? m.toUpperCase() : null;
}
function esMetodoTarjeta(m) {
  return ['TARJETA_BAC', 'TARJETA_NEONET', 'TARJETA_OTRA'].includes(String(m || '').toUpperCase());
}

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? 1;
}

function addRepairTenantCondition(req, conditions, params, alias = 'r') {
  if (!isSuperadminTenant(req)) {
    conditions.push(`${alias}.empresa_id = ?`);
    params.push(getTenantEmpresaId(req));
  }
}

function repairTenantClause(req, alias = 'r') {
  return isSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [getTenantEmpresaId(req)] };
}

// Ruta base de uploads — siempre absoluta para ser compatible con Docker bind mount
// Dentro del contenedor es /app/uploads (mapeado a /var/www/Tecnocell_storage/uploads en el host)
const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');

// Configuración de Multer para almacenamiento de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const repairId = req.params.id || req.body.repairId || `REP${Date.now()}`;
    const tipo = req.body.imageTipo || 'historial';

    // Estructura: /app/uploads/reparaciones/REP123456/historial/
    const uploadPath = path.join(UPLOADS_BASE, 'reparaciones', repairId, tipo);

    // Crear directorios recursivamente
    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    
    // Sanitizar nombre
    const sanitized = basename.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // hist_123456789.jpg
    cb(null, `${sanitized}_${timestamp}${ext}`);
  }
});

// Filtros de archivo
const fileFilter = (req, file, cb) => {
  // Solo permitir imágenes
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'), false);
  }
};

// Configuración de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB por imagen
  }
});

// Middleware de upload
exports.uploadMiddleware = upload.array('fotos', 10);

// Helper: Convertir centavos a quetzales
const centavosAQuetzales = (centavos) => centavos / 100;
const quetzalesACentavos = (quetzales) => Math.round(quetzales * 100);

// Helper: obtener nombre del usuario autenticado
// Primero intenta req.user.username (nuevo JWT), si no consulta la BD por id
const getAuthUserName = async (req, connection) => {
  // 1. Nuevo JWT incluye username y/o name directamente
  if (req.user?.username) return req.user.username;
  if (req.user?.name)     return req.user.name;
  if (req.user?.nombre)   return req.user.nombre;

  // 2. Fallback: buscar en BD usando el id del token
  const userId = req.user?.id || req.user?.userId || req.user?.usuario_id;
  if (userId) {
    try {
      const conn = connection || db;
      const [rows] = await conn.query(
        `SELECT u.username, u.name, p.nombres, p.apellidos
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.id = ? LIMIT 1`,
        [userId]
      );
      if (rows.length) {
        const r = rows[0];
        if (r.username) return r.username;
        const fullName = [r.nombres, r.apellidos].filter(Boolean).join(' ').trim();
        if (fullName) return fullName;
        if (r.name)    return r.name;
      }
    } catch (_) { /* ignorar error de lookup, usar fallback */ }
  }

  return 'Sistema';
};

// ========== CREAR REPARACIÓN ==========
exports.createReparacion = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // Resolver nombre del usuario autenticado antes de los INSERTs
    const authUserName = await getAuthUserName(req, connection);

    const {
      clienteNombre,
      clienteTelefono,
      clienteEmail,
      clienteId,
      // Equipo
      tipoEquipo,
      marca,
      modelo,
      color,
      imeiSerie,
      patronContrasena,
      acceso_tipo = 'ninguno',
      acceso_valor = null,
      estadoFisico,
      diagnosticoInicial,
      // Estado
      estado = 'RECIBIDA',
      prioridad = 'MEDIA',
      // Anticipo
      montoAnticipo = 0,
      metodoAnticipo,
      // Items
      items = [],
      manoDeObra = 0,
      // Accesorios
      accesorios,
      // Observaciones
      observaciones,
      // Fecha de ingreso seleccionada por el usuario
      fechaIngreso,
      // Fotos de recepción (URLs temporales o IDs si ya se subieron)
      fotosRecepcion = []
    } = req.body;
    
    // Generar ID único
    const repairId = `REP${Date.now()}`;
    const empresaId = getTenantEmpresaId(req);

    if (clienteId && !isSuperadminTenant(req)) {
      const [[cliente]] = await connection.query(
        'SELECT id FROM clientes WHERE id = ? AND empresa_id = ? AND activo = true',
        [clienteId, empresaId]
      );
      if (!cliente) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      }
    }
    
    // Calcular totales (convertir a centavos)
    const subtotalCentavos = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const manoObraCentavos = quetzalesACentavos(manoDeObra);
    const totalSinImpuestos = subtotalCentavos + manoObraCentavos;
    const impuestosCentavos = Math.round(totalSinImpuestos * 0.12);
    const totalCentavos = totalSinImpuestos + impuestosCentavos;
    const anticipoCentavos = quetzalesACentavos(montoAnticipo);
    
    // 1. Insertar reparación
    await connection.query(
      `INSERT INTO reparaciones (
        id, empresa_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email,
        tipo_equipo, marca, modelo, color, imei_serie, patron_contrasena,
        acceso_tipo, acceso_valor,
        estado_fisico, diagnostico_inicial,
        estado, prioridad,
        mano_obra, subtotal, impuestos, total,
        monto_anticipo, saldo_anticipo, metodo_anticipo,
        fecha_ingreso, observaciones, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        repairId, empresaId, clienteId || null, clienteNombre, clienteTelefono, clienteEmail,
        tipoEquipo, marca, modelo, color, imeiSerie, patronContrasena,
        acceso_tipo, acceso_valor,
        estadoFisico, diagnosticoInicial,
        estado, prioridad,
        manoObraCentavos, subtotalCentavos, impuestosCentavos, totalCentavos,
        anticipoCentavos, anticipoCentavos, metodoAnticipo,
        fechaIngreso || new Date().toISOString().split('T')[0], observaciones,
        authUserName
      ]
    );
    
    // 2. Insertar accesorios
    if (accesorios) {
      await connection.query(
        `INSERT INTO reparaciones_accesorios (
          reparacion_id, chip, estuche, memoria_sd, cargador, otros
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          repairId,
          accesorios.chip || false,
          accesorios.estuche || false,
          accesorios.memoriaSD || false,
          accesorios.cargador || false,
          accesorios.otros || null
        ]
      );
    }
    
    // 3. Insertar items/repuestos
    for (const item of items) {
      await connection.query(
        `INSERT INTO reparaciones_items (
          reparacion_id, item_id, item_tipo, nombre, cantidad, precio_unit, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          repairId,
          item.productId || item.id,
          item.tipo || 'manual',
          item.nombre,
          item.cantidad,
          quetzalesACentavos(item.precioUnit),
          quetzalesACentavos(item.subtotal)
        ]
      );
    }
    
    // 4. Crear entrada inicial en historial
    const notaInicial = anticipoCentavos > 0
      ? `Reparación creada. Anticipo recibido: Q${centavosAQuetzales(anticipoCentavos).toFixed(2)} (${metodoAnticipo})`
      : 'Reparación creada';
    
    const [historialResult] = await connection.query(
      `INSERT INTO reparaciones_historial (
        reparacion_id, estado, nota, user_nombre, tipo_evento, estado_anterior, descripcion
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [repairId, estado, notaInicial, authUserName, 'REPARACION_CREADA', null, 'Reparación registrada en el sistema']
    );
    
    const historialId = historialResult.insertId;
    
    // 5. Si hay fotos de recepción, asociarlas
    if (fotosRecepcion && fotosRecepcion.length > 0) {
      for (const foto of fotosRecepcion) {
        await connection.query(
          `INSERT INTO reparaciones_imagenes (
            reparacion_id, historial_id, tipo, filename, url_path
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            repairId,
            historialId,
            'recepcion',
            foto.filename || 'uploaded.jpg',
            foto.url_path || `/uploads/reparaciones/${repairId}/recepcion/${foto.filename}`
          ]
        );
      }
    }
    
    await connection.commit();
    
    // ── 6. Guardar firma del cliente (post-commit, no fatal) ──────────────
    const { firma_cliente_base64 } = req.body;
    let firmaClienteUrl = null;   // URL relativa para la BD y para contratoService

    if (
      firma_cliente_base64 &&
      typeof firma_cliente_base64 === 'string' &&
      firma_cliente_base64.startsWith('data:image/png;base64,')
    ) {
      try {
        const base64Data = firma_cliente_base64.replace(/^data:image\/png;base64,/, '');

        // Validar que no sea un canvas vacío (PNG todo-blanco suele ser < 600 bytes)
        const bufSize = Buffer.byteLength(base64Data, 'base64');
        if (bufSize < 600) {
          console.warn(`⚠️ Firma descartada — PNG posiblemente vacío (${bufSize} bytes)`);
        } else {
          const firmaDir  = path.join(__dirname, '..', 'uploads', 'firmas', 'reparaciones', repairId);
          const firmaFile = path.join(firmaDir, 'firma_cliente.png');
          fs.mkdirSync(firmaDir, { recursive: true });
          fs.writeFileSync(firmaFile, Buffer.from(base64Data, 'base64'));

          firmaClienteUrl    = `/uploads/firmas/reparaciones/${repairId}/firma_cliente.png`;
          const tecnicoId    = req.user?.id ?? req.user?.userId ?? null;

          await db.query(
            `UPDATE reparaciones
                SET firma_cliente_url      = ?,
                    firma_estado           = 'FIRMADO',
                    firmado_at             = NOW(),
                    firmado_por_usuario_id = ?
              WHERE id = ? AND empresa_id = ?`,
            [firmaClienteUrl, tecnicoId, repairId, empresaId]
          );
          console.log(`✅ Firma guardada para reparación ${repairId} → ${firmaClienteUrl}`);
        }
      } catch (firmaErr) {
        console.error('⚠️ Error guardando firma cliente:', firmaErr.message);
      }
    }

    // ── 7. Generar contrato PDF (post-commit, no fatal) ───────────────────
    try {
      const fechaFormateada = (fechaIngreso || new Date().toISOString().split('T')[0])
        .split('-').reverse().join('/');                   // YYYY-MM-DD → DD/MM/YYYY

      await contratoService.generarContrato({
        reparacionId:  repairId,
        fecha:         fechaFormateada,
        clienteNombre,
        clienteTel:    clienteTelefono,
        clienteEmail,
        tipoEquipo,
        marca,
        modelo,
        color,
        imei:          imeiSerie,
        acceso:        acceso_tipo !== 'ninguno' ? `${acceso_tipo} registrado` : 'ninguno',
        descripcion:   diagnosticoInicial,
        costoTotal:    centavosAQuetzales(totalCentavos),
        anticipo:      centavosAQuetzales(anticipoCentavos),
        saldo:         centavosAQuetzales(totalCentavos - anticipoCentavos),
        firmaClienteUrl,                              // URL relativa (/uploads/firmas/...)
      });
    } catch (pdfErr) {
      console.error('⚠️ Error generando contrato PDF:', pdfErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Reparación creada exitosamente',
      data: {
        id: repairId,
        total: centavosAQuetzales(totalCentavos)
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear reparación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la reparación',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ========== OBTENER TODAS LAS REPARACIONES ==========
exports.getAllReparaciones = async (req, res) => {
  try {
    const { estado, prioridad, search, limit = 100 } = req.query;
    
    let query = `
      SELECT
        r.*,
        (SELECT COUNT(*) FROM reparaciones_imagenes WHERE reparacion_id = r.id) as total_imagenes,
        (SELECT COUNT(*) FROM reparaciones_historial WHERE reparacion_id = r.id) as total_cambios,
        CONCAT(COALESCE(pt.nombres,''), ' ', COALESCE(pt.apellidos,'')) AS tecnico_nombre,
        ut.username AS tecnico_username,
        CONCAT(COALESCE(pa.nombres,''), ' ', COALESCE(pa.apellidos,'')) AS asignado_por_nombre
      FROM reparaciones r
      LEFT JOIN users ut ON ut.id = r.tecnico_asignado_id
      LEFT JOIN user_profiles pt ON pt.user_id = r.tecnico_asignado_id
      LEFT JOIN users ua ON ua.id = r.asignado_por
      LEFT JOIN user_profiles pa ON pa.user_id = r.asignado_por
      WHERE 1=1
    `;
    const params = [];
    const tenant = repairTenantClause(req, 'r');
    query += tenant.sql;
    params.push(...tenant.params);
    
    if (estado) {
      query += ' AND r.estado = ?';
      params.push(estado);
    }
    
    if (prioridad) {
      query += ' AND r.prioridad = ?';
      params.push(prioridad);
    }
    
    if (search) {
      query += ` AND (
        r.cliente_nombre LIKE ? OR
        r.cliente_telefono LIKE ? OR
        r.marca LIKE ? OR
        r.modelo LIKE ? OR
        r.imei_serie LIKE ? OR
        r.sticker_serie_interna LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    query += ' ORDER BY r.updated_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const [reparaciones] = await db.query(query, params);
    
    // Convertir centavos a quetzales
    const reparacionesFormateadas = reparaciones.map(rep => ({
      ...rep,
      mano_obra: centavosAQuetzales(rep.mano_obra),
      subtotal: centavosAQuetzales(rep.subtotal),
      impuestos: centavosAQuetzales(rep.impuestos),
      total: centavosAQuetzales(rep.total),
      monto_anticipo: centavosAQuetzales(rep.monto_anticipo),
      saldo_anticipo: centavosAQuetzales(rep.saldo_anticipo),
      monto_pagado_adicional: centavosAQuetzales(rep.monto_pagado_adicional || 0),
      total_invertido: centavosAQuetzales(rep.total_invertido || 0),
      diferencia_reparacion: centavosAQuetzales(rep.diferencia_reparacion || 0),
      total_ganancia: centavosAQuetzales(rep.total_ganancia || 0)
    }));
    
    res.json({
      success: true,
      data: reparacionesFormateadas
    });
    
  } catch (error) {
    console.error('Error al obtener reparaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las reparaciones',
      error: error.message
    });
  }
};

// ========== OBTENER UNA REPARACIÓN POR ID ==========
exports.getReparacionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener reparación principal
    const tenant = repairTenantClause(req);
    const [reparaciones] = await db.query(
      `SELECT * FROM reparaciones WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );
    
    if (reparaciones.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reparación no encontrada'
      });
    }
    
    const reparacion = reparaciones[0];
    
    // Obtener accesorios
    const [accesorios] = await db.query(
      'SELECT * FROM reparaciones_accesorios WHERE reparacion_id = ?',
      [id]
    );
    
    // Obtener items
    const [items] = await db.query(
      'SELECT * FROM reparaciones_items WHERE reparacion_id = ?',
      [id]
    );
    
    // Obtener historial con imágenes
    const [historial] = await db.query(
      `SELECT 
        h.*,
        h.created_at as fecha_cambio,
        GROUP_CONCAT(i.url_path) as fotos
      FROM reparaciones_historial h
      LEFT JOIN reparaciones_imagenes i ON i.historial_id = h.id
      WHERE h.reparacion_id = ?
      GROUP BY h.id
      ORDER BY h.created_at ASC`,
      [id]
    );
    
    // Formatear historial
    const historialFormateado = historial.map(h => ({
      ...h,
      fotos: h.fotos ? h.fotos.split(',') : [],
      costo_repuesto: centavosAQuetzales(h.costo_repuesto || 0),
      diferencia_reparacion: centavosAQuetzales(h.diferencia_reparacion || 0)
    }));
    
    // Obtener imágenes de recepción
    const [imagenesRecepcion] = await db.query(
      'SELECT * FROM reparaciones_imagenes WHERE reparacion_id = ? AND tipo = ?',
      [id, 'recepcion']
    );
    
    // Formatear respuesta
    const reparacionCompleta = {
      ...reparacion,
      mano_obra: centavosAQuetzales(reparacion.mano_obra),
      subtotal: centavosAQuetzales(reparacion.subtotal),
      impuestos: centavosAQuetzales(reparacion.impuestos),
      total: centavosAQuetzales(reparacion.total),
      monto_anticipo: centavosAQuetzales(reparacion.monto_anticipo),
      saldo_anticipo: centavosAQuetzales(reparacion.saldo_anticipo),
      total_invertido: centavosAQuetzales(reparacion.total_invertido || 0),
      diferencia_reparacion: centavosAQuetzales(reparacion.diferencia_reparacion || 0),
      total_ganancia: centavosAQuetzales(reparacion.total_ganancia || 0),
      accesorios: accesorios[0] || null,
      items: items.map(item => ({
        ...item,
        precio_unit: centavosAQuetzales(item.precio_unit),
        subtotal: centavosAQuetzales(item.subtotal)
      })),
      historial: historialFormateado,
      fotosRecepcion: imagenesRecepcion.map(img => img.url_path)
    };
    
    res.json({
      success: true,
      data: reparacionCompleta
    });
    
  } catch (error) {
    console.error('Error al obtener reparación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la reparación',
      error: error.message
    });
  }
};

// ========== CAMBIAR ESTADO CON IMÁGENES ==========
exports.changeRepairState = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const {
      estado,
      subEtapa,
      nota,
      piezaNecesaria,
      proveedor,
      costoRepuesto,
      stickerNumero,
      stickerUbicacion,
      stickerId,
      diferenciaReparacion
    } = req.body;
    
    const uploadedFiles = req.files || [];
    const tenant = repairTenantClause(req);
    
    // Obtener reparación actual
    const [reparaciones] = await connection.query(
      `SELECT * FROM reparaciones WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );
    
    if (reparaciones.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Reparación no encontrada'
      });
    }
    
    const reparacion = reparaciones[0];
    
    // 1. Crear entrada en historial
    const estadoAnterior = reparacion.estado;
    const [historialResult] = await connection.query(
      `INSERT INTO reparaciones_historial (
        reparacion_id, estado, sub_etapa, nota,
        pieza_necesaria, proveedor, costo_repuesto,
        sticker_numero, sticker_ubicacion,
        diferencia_reparacion, user_nombre,
        tipo_evento, estado_anterior, descripcion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, estado, subEtapa || null, nota,
        piezaNecesaria || null, proveedor || null,
        costoRepuesto ? quetzalesACentavos(parseFloat(costoRepuesto)) : null,
        stickerNumero || null, stickerUbicacion || null,
        diferenciaReparacion ? quetzalesACentavos(parseFloat(diferenciaReparacion)) : null,
        'Usuario',
        'CAMBIO_ESTADO', estadoAnterior, nota || null
      ]
    );
    
    const historialId = historialResult.insertId;
    
    // 2. Guardar imágenes en BD
    const tipoImagen = (estado === 'COMPLETADA' || estado === 'ENTREGADA') ? 'final' : 'historial';
    for (const file of uploadedFiles) {
      const urlPath = `/uploads/reparaciones/${id}/${tipoImagen}/${file.filename}`;
      
      await connection.query(
        `INSERT INTO reparaciones_imagenes (
          reparacion_id, historial_id, tipo, filename, url_path, file_size, mime_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, historialId, tipoImagen, file.filename, urlPath, file.size, file.mimetype]
      );
    }
    
    // 3. Actualizar estado de la reparación
    const updates = { estado };
    if (subEtapa) updates.sub_etapa = subEtapa;
    
    // Manejar costo de repuesto
    if (costoRepuesto && parseFloat(costoRepuesto) > 0) {
      const costoCentavos = quetzalesACentavos(parseFloat(costoRepuesto));
      const nuevoSaldo = reparacion.saldo_anticipo - costoCentavos;
      const nuevoInvertido = (reparacion.total_invertido || 0) + costoCentavos;
      
      updates.saldo_anticipo = nuevoSaldo;
      updates.total_invertido = nuevoInvertido;
    }
    
    // Manejar completada
    if (estado === 'COMPLETADA' && stickerNumero) {
      updates.sticker_serie_interna = stickerNumero;
      updates.sticker_ubicacion = stickerUbicacion;
      
      // Si se proporcionó un stickerId, asignar el sticker a la reparación
      if (stickerId) {
        await connection.query(
          `UPDATE stickers_garantia 
           SET estado = 'ASIGNADO', 
               reparacion_id = ?, 
               ubicacion_sticker = ?,
               fecha_asignacion = NOW()
           WHERE id = ? AND estado = 'DISPONIBLE'`,
          [id, stickerUbicacion, stickerId]
        );
      }
    }
    
    // Manejar entrega
    if (estado === 'ENTREGADA') {
      updates.fecha_cierre = new Date().toISOString().split('T')[0];
      
      if (diferenciaReparacion !== undefined) {
        const diferenciaCentavos = quetzalesACentavos(parseFloat(diferenciaReparacion));
        const saldoFinal = reparacion.saldo_anticipo + diferenciaCentavos;
        const gananciaTotal = (reparacion.monto_anticipo + diferenciaCentavos) - (reparacion.total_invertido || 0);
        
        updates.diferencia_reparacion = diferenciaCentavos;
        updates.saldo_anticipo = saldoFinal;
        updates.total_ganancia = gananciaTotal;
      }
    }
    
    // Construir query de actualización
    const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);
    
    await connection.query(
      `UPDATE reparaciones SET ${updateFields} WHERE id = ?${tenant.sql}`,
      [...updateValues, id, ...tenant.params]
    );
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      data: {
        historialId,
        imagenesSubidas: uploadedFiles.length
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al cambiar estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar el estado',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Actualizar solo el estado (simple)
exports.updateEstadoReparacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({
        success: false,
        message: 'El estado es requerido'
      });
    }

    // Obtener estado anterior antes de actualizar
    const tenant = repairTenantClause(req);
    const [[repActual]] = await db.query(
      `SELECT estado FROM reparaciones WHERE id = ?${tenant.sql}`, [id, ...tenant.params]
    );
    if (!repActual) {
      return res.status(404).json({ success: false, message: 'ReparaciÃ³n no encontrada' });
    }
    const estadoAnteriorSimple = repActual ? repActual.estado : null;

    // Actualizar estado en la reparación
    await db.query(
      `UPDATE reparaciones SET estado = ? WHERE id = ?${tenant.sql}`,
      [estado, id, ...tenant.params]
    );

    // Crear entrada en historial
    await db.query(
      `INSERT INTO reparaciones_historial (
        reparacion_id, estado, nota, user_nombre,
        tipo_evento, estado_anterior, descripcion
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        estado,
        `Estado actualizado a ${estado}`,
        'Usuario',
        'CAMBIO_ESTADO', estadoAnteriorSimple,
        `Estado actualizado a ${estado}`
      ]
    );

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el estado',
      error: error.message
    });
  }
};

// ========== HISTORIAL COMPLETO (línea de tiempo unificada) ==========
exports.getHistorialCompleto = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la reparación exista
    const tenant = repairTenantClause(req);
    const [[reparacion]] = await db.query(
      `SELECT * FROM reparaciones WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (!reparacion) {
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }

    const eventos = [];

    // 1. Entradas de reparaciones_historial
    const [historial] = await db.query(
      `SELECT h.*,
         GROUP_CONCAT(i.url_path ORDER BY i.id SEPARATOR ',') AS fotos_urls
       FROM reparaciones_historial h
       LEFT JOIN reparaciones_imagenes i ON i.historial_id = h.id
       WHERE h.reparacion_id = ?
       GROUP BY h.id
       ORDER BY h.created_at ASC`,
      [id]
    );

    for (const h of historial) {
      const tipoEvento = h.tipo_evento || (h.estado === 'ANTICIPO_REGISTRADO' ? 'ANTICIPO_REGISTRADO' : 'CAMBIO_ESTADO');
      const titulo = {
        REPARACION_CREADA: 'Reparación creada',
        CAMBIO_ESTADO: `Cambio de estado${h.estado ? ': ' + h.estado : ''}`,
        CHECKLIST_COMPLETADO: 'Checklist de recepción completado',
        ANTICIPO_REGISTRADO: 'Anticipo registrado',
      }[tipoEvento] || h.estado || 'Actualización';

      eventos.push({
        id: h.id,
        tipo_evento: tipoEvento,
        titulo,
        descripcion: h.descripcion || h.nota || null,
        estado_anterior: h.estado_anterior || null,
        estado_nuevo: (tipoEvento !== 'ANTICIPO_REGISTRADO') ? (h.estado || null) : null,
        nota: h.nota || null,
        usuario: h.user_nombre || 'Sistema',
        fecha: h.created_at,
        pieza_necesaria: h.pieza_necesaria || null,
        proveedor: h.proveedor || null,
        costo_repuesto: h.costo_repuesto ? centavosAQuetzales(h.costo_repuesto) : null,
        sticker_numero: h.sticker_numero || null,
        sticker_ubicacion: h.sticker_ubicacion || null,
        imagenes: h.fotos_urls ? h.fotos_urls.split(',').filter(Boolean) : []
      });
    }

    // 2. Checklist (check_equipo)
    const [[checklist]] = await db.query(
      'SELECT * FROM check_equipo WHERE reparacion_id = ? ORDER BY created_at ASC LIMIT 1',
      [id]
    );
    if (checklist) {
      // Solo añadir si no hay ya un evento CHECKLIST_COMPLETADO en historial
      const yaExiste = eventos.some(e => e.tipo_evento === 'CHECKLIST_COMPLETADO');
      if (!yaExiste) {
        eventos.push({
          id: `checklist-${checklist.id}`,
          tipo_evento: 'CHECKLIST_COMPLETADO',
          titulo: 'Checklist de recepción completado',
          descripcion: checklist.observaciones || 'Se completó el checklist de recepción del equipo',
          estado_anterior: null,
          estado_nuevo: 'RECIBIDA',
          nota: checklist.observaciones || null,
          usuario: checklist.realizado_por || 'Sistema',
          fecha: checklist.created_at,
          imagenes: []
        });
      }
    }

    // 3. Movimientos de caja relacionados
    const [movCaja] = await db.query(
      `SELECT cc.*, 'caja_chica' as origen
       FROM caja_chica cc
       WHERE cc.referencia_tipo = 'REPARACION' AND cc.referencia_id = ?
       ORDER BY cc.fecha_movimiento ASC`,
      [id]
    );
    for (const mov of movCaja) {
      eventos.push({
        id: `caja-${mov.id}`,
        tipo_evento: mov.estado === 'CONFIRMADO' ? 'ANTICIPO_CONFIRMADO' : 'ANTICIPO_PENDIENTE',
        titulo: mov.estado === 'CONFIRMADO' ? 'Anticipo confirmado (Caja)' : 'Anticipo registrado como pendiente (Caja)',
        descripcion: mov.concepto || null,
        estado_anterior: null,
        estado_nuevo: null,
        nota: mov.observaciones || null,
        usuario: mov.realizado_por || 'Sistema',
        fecha: mov.fecha_movimiento,
        monto: parseFloat(mov.monto),
        metodo_pago: 'EFECTIVO',
        banco: null,
        imagenes: []
      });
    }

    // 4. Movimientos bancarios relacionados
    const [movBanco] = await db.query(
      `SELECT mb.*, cb.nombre as banco_nombre, 'banco' as origen
       FROM movimientos_bancarios mb
       LEFT JOIN cuentas_bancarias cb ON cb.id = mb.cuenta_id
       WHERE mb.referencia_tipo = 'REPARACION' AND mb.referencia_id = ?
       ORDER BY mb.fecha_movimiento ASC`,
      [id]
    );
    for (const mov of movBanco) {
      eventos.push({
        id: `banco-${mov.id}`,
        tipo_evento: mov.estado === 'CONFIRMADO' ? 'ANTICIPO_CONFIRMADO' : 'ANTICIPO_PENDIENTE',
        titulo: mov.estado === 'CONFIRMADO' ? 'Anticipo confirmado (Transferencia)' : 'Anticipo registrado como pendiente (Transferencia)',
        descripcion: mov.concepto || null,
        estado_anterior: null,
        estado_nuevo: null,
        nota: mov.observaciones || null,
        usuario: mov.realizado_por || 'Sistema',
        fecha: mov.fecha_movimiento,
        monto: parseFloat(mov.monto),
        metodo_pago: 'TRANSFERENCIA',
        banco: mov.banco_nombre || null,
        imagenes: []
      });
    }

    // Ordenar todos los eventos por fecha ascendente
    eventos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Deduplicar: si hay un evento ANTICIPO_REGISTRADO del historial y también un movimiento pendiente de caja/banco,
    // conservar solo el del historial (más informativo) para evitar duplicar
    const eventosFinales = [];
    const anticipoHistorialFecha = eventos
      .filter(e => e.tipo_evento === 'ANTICIPO_REGISTRADO')
      .map(e => new Date(e.fecha).toISOString().substring(0, 10));

    for (const ev of eventos) {
      if ((ev.tipo_evento === 'ANTICIPO_PENDIENTE') &&
          anticipoHistorialFecha.includes(new Date(ev.fecha).toISOString().substring(0, 10))) {
        // Hay un registro en historial para la misma fecha → skip movimiento duplicado
        continue;
      }
      eventosFinales.push(ev);
    }

    res.json({
      success: true,
      data: {
        reparacion: {
          id: reparacion.id,
          cliente_nombre: reparacion.cliente_nombre,
          cliente_telefono: reparacion.cliente_telefono,
          equipo: `${reparacion.marca} ${reparacion.modelo}`,
          estado_actual: reparacion.estado,
          prioridad: reparacion.prioridad,
          fecha_ingreso: reparacion.fecha_ingreso,
          tecnico_asignado: reparacion.tecnico_asignado || null,
          diagnostico_inicial: reparacion.diagnostico_inicial
        },
        eventos: eventosFinales
      }
    });

  } catch (error) {
    console.error('Error al obtener historial completo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el historial',
      error: error.message
    });
  }
};

// Normaliza un estado de reparacion al subconjunto válido del enum de historial.
// reparaciones.estado tiene EN_PROCESO; reparaciones_historial originalmente no.
// La migración v2 corrige el enum, pero este mapa protege mientras tanto.
const HISTORIAL_ESTADOS_VALIDOS = new Set([
  'RECIBIDA','EN_DIAGNOSTICO','ESPERANDO_AUTORIZACION','AUTORIZADA',
  'EN_REPARACION','EN_PROCESO','ESPERANDO_PIEZA','COMPLETADA',
  'ENTREGADA','CANCELADA','STAND_BY','ANTICIPO_REGISTRADO'
]);
function safeEstadoHistorial(estado) {
  return HISTORIAL_ESTADOS_VALIDOS.has(estado) ? estado : 'EN_REPARACION';
}

// ========== ACTUALIZAR PRIORIDAD ==========
exports.updatePrioridad = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { prioridad } = req.body;
    const usuario = req.user?.username || req.user?.name || req.user?.nombre || 'Usuario';

    const PRIORIDADES_VALIDAS = ['BAJA', 'MEDIA', 'ALTA'];
    if (!prioridad || !PRIORIDADES_VALIDAS.includes(prioridad)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Prioridad inválida. Debe ser BAJA, MEDIA o ALTA' });
    }

    const tenant = repairTenantClause(req);
    const [[rep]] = await connection.query(
      `SELECT id, estado, prioridad FROM reparaciones WHERE id = ?${tenant.sql}`, [id, ...tenant.params]
    );
    if (!rep) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }
    if (rep.estado === 'CANCELADA') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'No se puede modificar una reparación cancelada' });
    }

    const prioridadAnterior = rep.prioridad;
    await connection.query(
      `UPDATE reparaciones SET prioridad = ?, updated_by = ? WHERE id = ?${tenant.sql}`,
      [prioridad, usuario, id, ...tenant.params]
    );

    await connection.query(
      `INSERT INTO reparaciones_historial
        (reparacion_id, estado, nota, user_nombre, tipo_evento, estado_anterior, descripcion)
       VALUES (?, ?, ?, ?, 'CAMBIO_PRIORIDAD', ?, ?)`,
      [
        id, safeEstadoHistorial(rep.estado),
        `Prioridad cambiada de ${prioridadAnterior} a ${prioridad}`,
        usuario, prioridadAnterior,
        `Prioridad actualizada: ${prioridadAnterior} → ${prioridad}`
      ]
    );

    await connection.commit();
    res.json({ success: true, message: 'Prioridad actualizada exitosamente', data: { prioridad } });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar prioridad:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar la prioridad', error: error.message });
  } finally {
    connection.release();
  }
};

// ========== REGISTRAR PAGO DE SALDO PENDIENTE ==========
exports.registrarPagoSaldo = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { monto, metodoPago } = req.body;
    const usuario = req.user?.username || req.user?.name || req.user?.nombre || 'Usuario';

    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'El monto debe ser un número mayor a cero' });
    }

    const METODOS_VALIDOS = ['efectivo', 'tarjeta'];
    if (!metodoPago || !METODOS_VALIDOS.includes(metodoPago)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Método de pago inválido. Use efectivo o tarjeta' });
    }

    const tenant = repairTenantClause(req);
    const [[rep]] = await connection.query(
      `SELECT id, estado, total, monto_anticipo, monto_pagado_adicional FROM reparaciones WHERE id = ?${tenant.sql}`, [id, ...tenant.params]
    );
    if (!rep) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }
    if (rep.estado === 'CANCELADA') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'No se puede registrar pago en una reparación cancelada' });
    }

    const totalCentavos = rep.total || 0;
    const yaPageadoCentavos = (rep.monto_anticipo || 0) + (rep.monto_pagado_adicional || 0);
    const saldoPendienteCentavos = totalCentavos - yaPageadoCentavos;

    if (saldoPendienteCentavos <= 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Esta reparación ya está totalmente pagada' });
    }

    const montoCentavos = quetzalesACentavos(montoNum);
    if (montoCentavos > saldoPendienteCentavos) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `El monto excede el saldo pendiente de Q${centavosAQuetzales(saldoPendienteCentavos).toFixed(2)}`
      });
    }

    const nuevoMontoPagadoAdicional = (rep.monto_pagado_adicional || 0) + montoCentavos;
    await connection.query(
      `UPDATE reparaciones SET monto_pagado_adicional = ?, metodo_pago_adicional = ?, updated_by = ? WHERE id = ?${tenant.sql}`,
      [nuevoMontoPagadoAdicional, metodoPago, usuario, id, ...tenant.params]
    );

    await connection.query(
      `INSERT INTO reparaciones_historial
        (reparacion_id, estado, nota, user_nombre, tipo_evento, estado_anterior, descripcion)
       VALUES (?, ?, ?, ?, 'PAGO_SALDO', NULL, ?)`,
      [
        id, safeEstadoHistorial(rep.estado),
        `Pago de saldo registrado: Q${montoNum.toFixed(2)} (${metodoPago})`,
        usuario,
        `Pago de saldo Q${montoNum.toFixed(2)} en ${metodoPago}`
      ]
    );

    await connection.commit();

    const totalPagado = centavosAQuetzales((rep.monto_anticipo || 0) + nuevoMontoPagadoAdicional);
    const saldoRestante = centavosAQuetzales(totalCentavos - (rep.monto_anticipo || 0) - nuevoMontoPagadoAdicional);

    res.json({
      success: true,
      message: 'Pago registrado exitosamente',
      data: {
        totalPagado,
        saldoRestante,
        montoPagadoAdicional: centavosAQuetzales(nuevoMontoPagadoAdicional)
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al registrar pago de saldo:', error);
    res.status(500).json({ success: false, message: 'Error al registrar el pago', error: error.message });
  } finally {
    connection.release();
  }
};

// ========== CANCELAR REPARACIÓN ==========
exports.cancelarReparacion = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const b = req.body;
    const usuario = req.user?.username || req.user?.name || req.user?.nombre || 'Usuario';

    // Aceptar camelCase y snake_case para compatibilidad
    const motivo          = b.motivo ?? b.motivo_cancelacion ?? '';
    const devolverDinero  = Boolean(b.devolver_dinero ?? b.devolucion ?? false);
    const montoDevolucion = Number(
      b.devolucion_monto ??
      b.devolucionMonto  ??
      b.monto_devolucion ??
      b.montoDevolucion  ??
      b.monto_a_devolver ??
      b.montoADevolver   ??
      0
    );
    const motivoRetencion = String(
      b.motivo_retencion ?? b.motivoRetencion ?? ''
    ).trim();

    // ── Validaciones básicas ─────────────────────────────────────────────
    const motivoLimpio = String(motivo || '').trim();
    if (!motivoLimpio) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'El motivo de cancelación es requerido' });
    }

    const devolver        = devolverDinero;
    const montoDev        = devolver ? Math.max(0, montoDevolucion) : 0;
    const motivoRetLimpio = motivoRetencion;

    // ── Cargar reparación ────────────────────────────────────────────────
    const tenant = repairTenantClause(req);
    const [[rep]] = await connection.query(
      `SELECT id, estado, cliente_nombre, monto_anticipo, metodo_anticipo,
              cuenta_bancaria_anticipo_id
         FROM reparaciones WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (!rep) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }
    if (rep.estado === 'CANCELADA') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'La reparación ya está cancelada' });
    }
    if (rep.estado === 'ENTREGADA') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'No se puede cancelar una reparación ya entregada' });
    }

    const montoAnticipo = centavosAQuetzales(Number(rep.monto_anticipo) || 0);

    // ── Validaciones de devolución ───────────────────────────────────────
    if (devolver && montoDev > montoAnticipo) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `No se puede devolver más del anticipo recibido (Q${montoAnticipo.toFixed(2)})`
      });
    }
    const montoRetenido = montoAnticipo - montoDev;
    if (montoRetenido > 0.01 && !motivoRetLimpio) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'El motivo de retención es requerido cuando se retiene parte del anticipo'
      });
    }

    const estadoAnterior = rep.estado;
    const fechaHoy = new Date().toISOString().split('T')[0];

    // ── Buscar movimiento de anticipo (INGRESO) vinculado ────────────────
    let anticipoMovId = null;
    let devolucionMovId = null;
    const notasAnticipo = [];

    // Caja chica: anticipo en efectivo
    const [movsCaja] = await connection.query(
      `SELECT * FROM caja_chica
       WHERE referencia_tipo = 'REPARACION' AND referencia_id = ?
         AND categoria = 'ANTICIPO_REPARACION' AND tipo_movimiento = 'INGRESO'
       ORDER BY id DESC LIMIT 1`,
      [id]
    );

    // Banco: anticipo por transferencia / tarjeta
    const [movsBanco] = await connection.query(
      `SELECT * FROM movimientos_bancarios
       WHERE referencia_tipo = 'REPARACION' AND referencia_id = ?
         AND categoria = 'ANTICIPO_REPARACION' AND tipo_movimiento = 'INGRESO'
       ORDER BY id DESC LIMIT 1`,
      [id]
    );

    // ── Procesar anticipo en Caja Chica ──────────────────────────────────
    for (const mov of movsCaja) {
      anticipoMovId = mov.id;
      if (mov.estado === 'PENDIENTE') {
        // El anticipo nunca llegó a confirmarse → anular
        await connection.query(
          `UPDATE caja_chica SET estado = 'ANULADO' WHERE id = ?`,
          [mov.id]
        );
        notasAnticipo.push(`Anticipo en caja anulado (Q${Number(mov.monto).toFixed(2)})`);
      } else if (mov.estado === 'CONFIRMADO' && devolver && montoDev > 0) {
        // Anticipo confirmado + hay devolución → registrar EGRESO de devolución
        const concepto = `Devolución de anticipo reparación ${id} - ${rep.cliente_nombre}`;
        const observ   = [
          `Cancelación: ${motivoLimpio}`,
          montoRetenido > 0 ? `Monto retenido: Q${montoRetenido.toFixed(2)} — ${motivoRetLimpio}` : null,
        ].filter(Boolean).join(' | ');

        const [result] = await connection.query(
          `INSERT INTO caja_chica
             (tipo_movimiento, monto, concepto, categoria, estado, realizado_por,
              observaciones, referencia_tipo, referencia_id)
           VALUES ('EGRESO', ?, ?, 'DEVOLUCION_ANTICIPO_REPARACION', 'PENDIENTE', ?, ?, 'REPARACION', ?)`,
          [montoDev, concepto, usuario, observ, id]
        );
        devolucionMovId = result.insertId;
        notasAnticipo.push(`Egreso por devolución de anticipo (caja) Q${montoDev.toFixed(2)} — PENDIENTE de confirmar`);
      } else if (mov.estado === 'CONFIRMADO' && (!devolver || montoDev === 0)) {
        notasAnticipo.push(`Anticipo en caja confirmado; sin devolución al cliente (Q${montoAnticipo.toFixed(2)} retenido)`);
      }
    }

    // ── Procesar anticipo en Banco ───────────────────────────────────────
    for (const mov of movsBanco) {
      anticipoMovId = mov.id;
      if (mov.estado === 'PENDIENTE') {
        await connection.query(
          `UPDATE movimientos_bancarios SET estado = 'ANULADO' WHERE id = ?`,
          [mov.id]
        );
        notasAnticipo.push(`Anticipo bancario anulado (Q${Number(mov.monto).toFixed(2)})`);
      } else if (mov.estado === 'CONFIRMADO' && devolver && montoDev > 0) {
        const concepto = `Devolución de anticipo reparación ${id} - ${rep.cliente_nombre}`;
        const observ   = [
          `Cancelación: ${motivoLimpio}`,
          montoRetenido > 0 ? `Monto retenido: Q${montoRetenido.toFixed(2)} — ${motivoRetLimpio}` : null,
        ].filter(Boolean).join(' | ');

        const [result] = await connection.query(
          `INSERT INTO movimientos_bancarios
             (cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por,
              observaciones, referencia_tipo, referencia_id)
           VALUES (?, 'EGRESO', ?, ?, 'DEVOLUCION_ANTICIPO_REPARACION', 'PENDIENTE', ?, ?, 'REPARACION', ?)`,
          [mov.cuenta_id, montoDev, concepto, usuario, observ, id]
        );
        devolucionMovId = result.insertId;
        notasAnticipo.push(`Egreso por devolución de anticipo (banco) Q${montoDev.toFixed(2)} — PENDIENTE de confirmar`);
      } else if (mov.estado === 'CONFIRMADO' && (!devolver || montoDev === 0)) {
        notasAnticipo.push(`Anticipo bancario confirmado; sin devolución al cliente (Q${montoAnticipo.toFixed(2)} retenido)`);
      }
    }

    // ── UPDATE reparaciones con trazabilidad completa ────────────────────
    await connection.query(
      `UPDATE reparaciones
         SET estado                  = 'CANCELADA',
             fecha_cancelacion       = ?,
             motivo_cancelacion      = ?,
             devolucion_monto        = ?,
             monto_retenido          = ?,
             motivo_retencion        = ?,
             anticipo_movimiento_id  = ?,
             devolucion_movimiento_id = ?,
             updated_by              = ?
       WHERE id = ?${tenant.sql}`,
      [
        fechaHoy,
        motivoLimpio,
        montoDev,
        montoRetenido,
        motivoRetLimpio || null,
        anticipoMovId,
        devolucionMovId,
        usuario,
        id,
        ...tenant.params,
      ]
    );

    // ── Historial ────────────────────────────────────────────────────────
    const partes = [
      `Reparación cancelada. Motivo: ${motivoLimpio}`,
      devolver && montoDev > 0
        ? `Devolución: Q${montoDev.toFixed(2)}`
        : 'Sin devolución al cliente',
      montoRetenido > 0
        ? `Retenido: Q${montoRetenido.toFixed(2)} — ${motivoRetLimpio}`
        : null,
      ...notasAnticipo,
    ].filter(Boolean);

    await connection.query(
      `INSERT INTO reparaciones_historial
         (reparacion_id, estado, nota, user_nombre, tipo_evento, estado_anterior, descripcion)
       VALUES (?, 'CANCELADA', ?, ?, 'CANCELACION', ?, ?)`,
      [
        id,
        partes.join(' | '),
        usuario,
        estadoAnterior,
        `Cancelada desde ${estadoAnterior}. Motivo: ${motivoLimpio}`,
      ]
    );

    await connection.commit();
    res.json({
      success: true,
      message: 'Reparación cancelada exitosamente',
      data: {
        devolucionMonto:     montoDev,
        montoRetenido,
        motivoRetencion:     motivoRetLimpio || null,
        anticipoMovimientoId: anticipoMovId,
        devolucionMovimientoId: devolucionMovId,
        accionesAnticipo:    notasAnticipo,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al cancelar reparación:', error);
    res.status(500).json({ success: false, message: 'Error al cancelar la reparación', error: error.message });
  } finally {
    connection.release();
  }
};

// ========== COMPLETAR REPARACIÓN (con repuestos, regalías y pago) ==========
exports.completarReparacion = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      nota,
      stickerId,
      stickerNumero,
      stickerUbicacion,
    } = req.body;

    // JSON fields sent as strings in FormData
    const repuestosUsados  = JSON.parse(req.body.repuestosUsados  || '[]');
    const regaliasUsadas   = JSON.parse(req.body.regaliasUsadas   || '[]');
    const pagoFinalRaw     = req.body.pagoFinal ? JSON.parse(req.body.pagoFinal) : null;
    const uploadedFiles    = req.files || [];

    // ── 1. Obtener reparación ─────────────────────────────────────────────
    const tenant = repairTenantClause(req);
    const [[reparacion]] = await connection.query(
      `SELECT * FROM reparaciones WHERE id = ?${tenant.sql}`, [id, ...tenant.params]
    );
    if (!reparacion) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }

    const authUserName = await getAuthUserName(req, connection);

    // ── 2. Procesar repuestos utilizados ─────────────────────────────────
    const inventarioEmpresaId = reparacion.empresa_id ?? getTenantEmpresaId(req);
    let costoRepuestosTotal = 0;
    for (const item of repuestosUsados) {
      const [[rep]] = await connection.query(
        'SELECT id, nombre, precio_costo, stock FROM repuestos WHERE id = ? AND empresa_id = ?', [item.repuesto_id, inventarioEmpresaId]
      );
      if (!rep) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Repuesto ID ${item.repuesto_id} no encontrado` });
      }
      if (rep.stock < item.cantidad) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para "${rep.nombre}". Disponible: ${rep.stock}, solicitado: ${item.cantidad}`
        });
      }
      const costoUnit  = rep.precio_costo || 0;   // centavos
      const subtotal   = costoUnit * item.cantidad;
      costoRepuestosTotal += subtotal;

      await connection.query('UPDATE repuestos SET stock = stock - ? WHERE id = ? AND empresa_id = ?', [item.cantidad, rep.id, inventarioEmpresaId]);
      await connection.query(
        `INSERT INTO reparacion_repuestos (reparacion_id, repuesto_id, nombre, cantidad, costo_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, rep.id, rep.nombre, item.cantidad, costoUnit, subtotal]
      );
    }

    // ── 3. Procesar regalías ──────────────────────────────────────────────
    let costoRegaliasTotal = 0;
    for (const item of regaliasUsadas) {
      let costoUnit = 0;
      let nombreItem = item.nombre || '';

      if (item.tipo === 'producto') {
        const [[prod]] = await connection.query(
          'SELECT id, nombre, precio_costo, stock FROM productos WHERE id = ? AND empresa_id = ?', [item.id, inventarioEmpresaId]
        );
        if (!prod) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: `Producto ID ${item.id} no encontrado` });
        }
        if (prod.stock < item.cantidad) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}, solicitado: ${item.cantidad}`
          });
        }
        costoUnit  = Math.round((prod.precio_costo || 0) * 100); // quetzales → centavos
        nombreItem = prod.nombre;
        await connection.query('UPDATE productos SET stock = stock - ? WHERE id = ? AND empresa_id = ?', [item.cantidad, prod.id, inventarioEmpresaId]);
      } else {
        const [[rep]] = await connection.query(
          'SELECT id, nombre, precio_costo, stock FROM repuestos WHERE id = ? AND empresa_id = ?', [item.id, inventarioEmpresaId]
        );
        if (!rep) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: `Repuesto ID ${item.id} no encontrado` });
        }
        if (rep.stock < item.cantidad) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente para "${rep.nombre}". Disponible: ${rep.stock}, solicitado: ${item.cantidad}`
          });
        }
        costoUnit  = rep.precio_costo || 0;
        nombreItem = rep.nombre;
        await connection.query('UPDATE repuestos SET stock = stock - ? WHERE id = ? AND empresa_id = ?', [item.cantidad, rep.id, inventarioEmpresaId]);
      }

      const subtotal = costoUnit * item.cantidad;
      costoRegaliasTotal += subtotal;

      await connection.query(
        `INSERT INTO reparacion_regalias (reparacion_id, item_id, nombre, tipo_inventario, cantidad, costo_unitario, subtotal, nota)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, item.id, nombreItem, item.tipo || 'repuesto', item.cantidad, costoUnit, subtotal, item.nota || null]
      );
    }

    // ── 4. Procesar pago final ────────────────────────────────────────────
    let montoBaseCentavos      = 0;   // monto antes de interés
    let interesMontoCentavos   = 0;   // monto del recargo tarjeta
    let montoPagoFinalCentavos = 0;   // montoBase + interés (lo que el cliente paga)
    let metodoPagoFinal        = null;
    let fechaPagoFinal         = null;
    let observacionPagoFinal   = null;
    let cuentaBancariaId       = null;
    let porcentajeInteres      = 0;
    let referenciaPago         = null;

    if (pagoFinalRaw && parseFloat(pagoFinalRaw.monto) > 0) {
      montoBaseCentavos  = quetzalesACentavos(parseFloat(pagoFinalRaw.monto));
      metodoPagoFinal    = normalizarMetodoPago(pagoFinalRaw.metodo) || pagoFinalRaw.metodo || null;
      fechaPagoFinal     = pagoFinalRaw.fecha      || new Date().toISOString().split('T')[0];
      observacionPagoFinal = pagoFinalRaw.observacion || null;
      cuentaBancariaId   = pagoFinalRaw.cuenta_bancaria_id ? parseInt(pagoFinalRaw.cuenta_bancaria_id, 10) : null;
      porcentajeInteres  = parseFloat(pagoFinalRaw.porcentaje_interes) || 0;
      referenciaPago     = pagoFinalRaw.referencia || null;

      // Validaciones de método de pago
      if (metodoPagoFinal && metodoPagoFinal !== 'EFECTIVO') {
        if (!cuentaBancariaId) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Debe seleccionar una cuenta bancaria para pagos con transferencia o tarjeta'
          });
        }
        // Verificar que la cuenta bancaria existe y está activa
        const [[cuenta]] = await connection.query(
          'SELECT id, nombre FROM cuentas_bancarias WHERE id = ? AND activa = TRUE', [cuentaBancariaId]
        );
        if (!cuenta) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Cuenta bancaria ID ${cuentaBancariaId} no encontrada o inactiva`
          });
        }
      }

      // Calcular interés (solo para tarjeta)
      if (esMetodoTarjeta(metodoPagoFinal) && porcentajeInteres > 0) {
        interesMontoCentavos = Math.round(montoBaseCentavos * porcentajeInteres / 100);
      }
      montoPagoFinalCentavos = montoBaseCentavos + interesMontoCentavos;
    }

    const totalPagadoCentavos = (reparacion.monto_anticipo || 0) + montoPagoFinalCentavos;
    const totalReparacion     = reparacion.total || 0;
    const estadoPago =
      totalPagadoCentavos >= totalReparacion ? 'pagado' :
      totalPagadoCentavos  > 0              ? 'parcial' : 'pendiente';
    const gananciaNeta = totalReparacion - costoRepuestosTotal - costoRegaliasTotal;

    // ── 5. Asignar sticker ────────────────────────────────────────────────
    if (stickerId && stickerNumero) {
      await connection.query(
        `UPDATE stickers_garantia
         SET estado = 'ASIGNADO', reparacion_id = ?, ubicacion_sticker = ?, fecha_asignacion = NOW()
         WHERE id = ? AND estado = 'DISPONIBLE'`,
        [id, stickerUbicacion || null, stickerId]
      );
    }

    // ── 6. Actualizar reparación ──────────────────────────────────────────
    await connection.query(
      `UPDATE reparaciones SET
         estado                 = 'COMPLETADA',
         sticker_serie_interna  = COALESCE(?, sticker_serie_interna),
         sticker_ubicacion      = COALESCE(?, sticker_ubicacion),
         monto_pago_final       = ?,
         metodo_pago_final      = ?,
         fecha_pago_final       = ?,
         observacion_pago_final = ?,
         estado_pago            = ?,
         total_pagado           = ?,
         ganancia_neta          = ?,
         costo_repuestos_total  = ?,
         costo_regalias_total   = ?,
         cuenta_bancaria_id     = COALESCE(?, cuenta_bancaria_id),
         porcentaje_interes     = ?,
         interes_monto          = ?,
         referencia_pago        = COALESCE(?, referencia_pago)
       WHERE id = ?${tenant.sql}`,
      [
        stickerNumero || null, stickerUbicacion || null,
        montoPagoFinalCentavos, metodoPagoFinal, fechaPagoFinal, observacionPagoFinal,
        estadoPago, totalPagadoCentavos, gananciaNeta,
        costoRepuestosTotal, costoRegaliasTotal,
        cuentaBancariaId || null,
        porcentajeInteres, interesMontoCentavos,
        referenciaPago || null,
        id,
        ...tenant.params
      ]
    );

    // ── 7. Insertar historial ─────────────────────────────────────────────
    const notaHistorial = nota || 'Reparación completada';
    let notaConPago = notaHistorial;
    if (metodoPagoFinal && montoPagoFinalCentavos > 0) {
      const metodoLabel = {
        EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
        TARJETA_BAC: 'Tarjeta BAC', TARJETA_NEONET: 'Tarjeta Neonet', TARJETA_OTRA: 'Tarjeta',
      }[metodoPagoFinal] || metodoPagoFinal;
      const montoDisplay = centavosAQuetzales(montoPagoFinalCentavos).toFixed(2);
      notaConPago += `\n[Pago final: Q${montoDisplay} vía ${metodoLabel}${porcentajeInteres > 0 ? ` (interés ${porcentajeInteres}%)` : ''}]`;
    }

    const [histResult] = await connection.query(
      `INSERT INTO reparaciones_historial
         (reparacion_id, estado, nota, user_nombre, tipo_evento, estado_anterior, descripcion,
          sticker_numero, sticker_ubicacion)
       VALUES (?, 'COMPLETADA', ?, ?, 'CAMBIO_ESTADO', ?, ?, ?, ?)`,
      [
        id, notaConPago, authUserName, reparacion.estado,
        notaConPago, stickerNumero || null, stickerUbicacion || null
      ]
    );
    const historialId = histResult.insertId;

    // ── 8. Guardar imágenes finales ───────────────────────────────────────
    for (const file of uploadedFiles) {
      const urlPath = `/uploads/reparaciones/${id}/final/${file.filename}`;
      await connection.query(
        `INSERT INTO reparaciones_imagenes (reparacion_id, historial_id, tipo, filename, url_path, file_size, mime_type)
         VALUES (?, ?, 'final', ?, ?, ?, ?)`,
        [id, historialId, file.filename, urlPath, file.size, file.mimetype]
      );
    }

    await connection.commit();

    // ── 9. Registrar movimiento financiero (fuera de la transacción principal) ──
    if (metodoPagoFinal && montoPagoFinalCentavos > 0) {
      try {
        await cajaController.registrarMovimientoReparacion(
          id,
          reparacion.cliente_nombre || '',
          metodoPagoFinal,
          montoPagoFinalCentavos,
          authUserName,
          null,          // connection separada (fuera de TX)
          cuentaBancariaId,
          referenciaPago
        );
      } catch (cajaErr) {
        // No revertir la reparación por error financiero; solo loguear
        console.error('⚠️ Error al registrar movimiento financiero de reparación:', cajaErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Reparación completada exitosamente',
      data: {
        estadoPago,
        totalPagado:     centavosAQuetzales(totalPagadoCentavos),
        gananciaNeta:    centavosAQuetzales(gananciaNeta),
        costoRepuestos:  centavosAQuetzales(costoRepuestosTotal),
        costoRegalias:   centavosAQuetzales(costoRegaliasTotal),
        montoPagoFinal:  centavosAQuetzales(montoPagoFinalCentavos),
        interesAplicado: centavosAQuetzales(interesMontoCentavos),
        imagenesSubidas: uploadedFiles.length,
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error al completar reparación:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al completar la reparación' });
  } finally {
    connection.release();
  }
};

// ========== DESCARGAR CONTRATO PDF ==========
exports.descargarContrato = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = repairTenantClause(req);
    const [[rep]] = await db.query(
      `SELECT id, firma_estado FROM reparaciones WHERE id = ?${tenant.sql}`, [id, ...tenant.params]
    );
    if (!rep) {
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }

    const contratoPath = path.join(
      __dirname, '..', 'uploads', 'contratos', id, `contrato_reparacion_${id}.pdf`
    );

    if (!fs.existsSync(contratoPath)) {
      return res.status(404).json({ success: false, message: 'Contrato no generado aún' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contrato_${id}.pdf"`);
    res.sendFile(contratoPath);
  } catch (err) {
    console.error('Error al descargar contrato:', err);
    res.status(500).json({ success: false, message: 'Error al obtener el contrato' });
  }
};
