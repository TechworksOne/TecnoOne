// Controller para gestionar reparaciones con imágenes
const db = require('../config/database');
const { parseLimit } = require('../utils/pagination');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { imageFileFilter, getSafeImageExtension, sanitizeBaseName } = require('../utils/uploadSecurity');
const { validatePhone } = require('../utils/phoneValidation');
const contratoService = require('../services/contratoService');
const auditoriaService = require('../services/auditoriaService');
const reparacionInventoryService = require('../services/reparacionInventoryService');
const { resolveRepairUploadDirectory } = require('../utils/repairUploadPath');
const { withoutDeviceCredentials } = require('../utils/repairCredentials');
const { safeErrorMessage, safeErrorDetails } = require('../utils/safeControllerError');

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


function normalizePrecioRevisionContrato(reqBody) {
  const raw =
    reqBody?.precioRevisionContrato ??
    reqBody?.precio_revision_contrato ??
    null;

  if (raw === null || raw === undefined || raw === '') return null;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeCondicionesServicioContrato(reqBody) {
  const raw =
    reqBody?.condicionesServicioContrato ??
    reqBody?.condiciones_servicio_contrato ??
    null;

  if (raw === null || raw === undefined) return null;

  const value = String(raw).trim();
  return value.length > 0 ? value : null;
}

function splitCondicionesServicio(value) {
  if (!value) return [];
  return String(value)
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);
}

function firstNonEmptyValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
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

function addRepairTenantCondition(req, conditions, params, alias = 'r') {
  if (!isSuperadminTenant(req)) {
    conditions.push(`${alias}.empresa_id = ?`);
    params.push(requireTenantEmpresaId(req));
  }
}

function repairTenantClause(req, alias = 'r') {
  return isSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

/**
 * Cláusula de scope usando branchScope cuando está disponible (rutas nuevas)
 * o repairTenantClause como fallback (rutas legado / super admin).
 */
function repairScopeClause(req, alias = 'r') {
  if (req.branchScope) {
    return reparacionInventoryService.reparacionScopeClause(req.branchScope, alias);
  }
  return repairTenantClause(req, alias);
}

// Ruta base de uploads — siempre absoluta para ser compatible con Docker bind mount
// Dentro del contenedor es /app/uploads (mapeado al storage persistente del host)
const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');

// Configuración de Multer para almacenamiento de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const repairId = req.params.id || req.body.repairId || `REP${Date.now()}`;
      const uploadPath = resolveRepairUploadDirectory(
        UPLOADS_BASE,
        repairId,
        req.body.imageTipo || 'historial'
      );
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = getSafeImageExtension(file);
    
    // Sanitizar nombre
    const sanitized = sanitizeBaseName(file.originalname, 'reparacion');
    
    // hist_123456789.jpg
    cb(null, `${sanitized}_${timestamp}${ext}`);
  }
});

// Filtros de archivo
const fileFilter = imageFileFilter;

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

function normalizeFirmaUsuarioUrl(firma) {
  if (!firma || typeof firma !== 'string') return null;

  const raw = firma.trim();
  if (!raw) return null;

  if (/^data:image\/(png|jpeg|jpg);base64,/i.test(raw)) {
    return raw;
  }

  if (/^data:image\/(png|jpeg|jpg);base64,/i.test(raw)) {
    return raw;
  }

  const normalized = raw.replaceAll(String.fromCharCode(92), '/');

  const uploadsIndex = normalized.indexOf('/uploads/');
  if (uploadsIndex >= 0) {
    return normalized.slice(uploadsIndex);
  }

  if (normalized.startsWith('/uploads/')) {
    return normalized;
  }

  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  if (normalized.startsWith('firmas/')) {
    return `/uploads/${normalized}`;
  }

  if (normalized.startsWith('/firmas/')) {
    return `/uploads${normalized}`;
  }

  if (normalized.startsWith('/app/uploads/')) {
    return normalized.replace('/app', '');
  }

  return `/uploads/${normalized.replace(/^\/+/, '')}`;
}

function safeSqlIdentifier(value) {
  const clean = String(value || '').trim();

  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    throw new Error(`Identificador SQL no seguro: ${clean}`);
  }

  return `\`${clean}\``;
}


function resolveFirmaClienteUrlByRepairId(repairId) {
  if (!repairId) return null;

  const firmaPath = path.join(
    __dirname,
    '..',
    'uploads',
    'firmas',
    'reparaciones',
    String(repairId),
    'firma_cliente.png'
  );

  if (fs.existsSync(firmaPath)) {
    return `/uploads/firmas/reparaciones/${repairId}/firma_cliente.png`;
  }

  return null;
}

const getAuthUserFirmaUrl = async (req, connection) => {
  try {
    const userId =
      req.user?.id ||
      req.user?.userId ||
      req.user?.usuario_id ||
      req.user?.usuarioId ||
      req.user?.id_usuario;

    const username =
      req.user?.username ||
      req.user?.usuario ||
      req.user?.nombre_usuario ||
      null;

    const email =
      req.user?.email ||
      req.user?.correo ||
      null;

    console.log('[ContratoPDF] req.user receptor:', {
      id: req.user?.id,
      userId: req.user?.userId,
      usuario_id: req.user?.usuario_id,
      usuarioId: req.user?.usuarioId,
      id_usuario: req.user?.id_usuario,
      username: req.user?.username,
      usuario: req.user?.usuario,
      nombre_usuario: req.user?.nombre_usuario,
      email: req.user?.email,
      correo: req.user?.correo,
    });

    if (!userId && !username && !email) {
      console.warn('[ContratoPDF] No se encontró identificador para firma receptor');
      return null;
    }

    const [columns] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND (
           COLUMN_NAME IN (
             'firma',
             'firma_url',
             'firmaUrl',
             'firma_path',
             'firma_digital',
             'signature',
             'signature_url'
           )
           OR COLUMN_NAME LIKE '%firma%'
           OR COLUMN_NAME LIKE '%signature%'
         )
       ORDER BY TABLE_NAME, COLUMN_NAME`
    );

    console.log('[ContratoPDF] columnas candidatas firma receptor:', columns);

    for (const candidate of columns) {
      const tableName = candidate.TABLE_NAME;
      const firmaColumn = candidate.COLUMN_NAME;

      const [tableColumns] = await connection.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
      );

      const colSet = new Set(tableColumns.map((c) => c.COLUMN_NAME));

      const where = [];
      const params = [];

      if (userId) {
        for (const col of ['usuario_id', 'user_id', 'id_usuario', 'id_user', 'created_by', 'id']) {
          if (colSet.has(col)) {
            where.push(`${safeSqlIdentifier(col)} = ?`);
            params.push(userId);
          }
        }
      }

      if (username) {
        for (const col of ['username', 'usuario', 'nombre_usuario', 'created_by_username']) {
          if (colSet.has(col)) {
            where.push(`${safeSqlIdentifier(col)} = ?`);
            params.push(username);
          }
        }
      }

      if (email) {
        for (const col of ['email', 'correo']) {
          if (colSet.has(col)) {
            where.push(`${safeSqlIdentifier(col)} = ?`);
            params.push(email);
          }
        }
      }

      if (where.length === 0) {
        continue;
      }

      const query = `
        SELECT ${safeSqlIdentifier(firmaColumn)} AS firma
        FROM ${safeSqlIdentifier(tableName)}
        WHERE (${where.join(' OR ')})
          AND ${safeSqlIdentifier(firmaColumn)} IS NOT NULL
          AND TRIM(${safeSqlIdentifier(firmaColumn)}) <> ''
        LIMIT 1
      `;

      const [rows] = await connection.query(query, params);

      if (rows[0]?.firma) {
        const firmaNormalizada = normalizeFirmaUsuarioUrl(rows[0].firma);

        console.log('[ContratoPDF] firma receptor encontrada en:', {
          tableName,
          firmaColumn,
          firmaBD: rows[0].firma,
          firmaNormalizada,
        });

        return firmaNormalizada;
      }
    }

    console.warn('[ContratoPDF] No se encontró firma receptor en tablas candidatas');
    return null;
  } catch (error) {
    console.warn('[ContratoPDF] No se pudo obtener firma del usuario receptor:', error.message);
    return null;
  }
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
      patron_contrasena,
      pin,
      password,
      contrasena,
      patron,
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
      cuentaBancariaId = null,
      cuentaBancariaAnticipoId = null,
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

    const telefonoValidado = validatePhone(clienteTelefono, {
      label: 'El teléfono del cliente',
    });

    if (!telefonoValidado.ok) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const clienteTelefonoNormalizado = telefonoValidado.value;
    
    // Generar ID único
    const repairId = `REP${Date.now()}`;
    const empresaId = requireTenantEmpresaId(req);
    // sucursal_id proviene del branchScope (ya validado por middleware); nunca del body.
    const sucursalId = Number(req.branchScope.sucursalId);

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
    const metodoAnticipoNormalizado = anticipoCentavos > 0 ? (metodoAnticipo || 'efectivo') : null;
    const cuentaAnticipoId = cuentaBancariaAnticipoId || cuentaBancariaId || null;

    const precioRevisionContrato = normalizePrecioRevisionContrato(req.body);
    const condicionesServicioContrato = normalizeCondicionesServicioContrato(req.body);
    
    // 1. Insertar reparación
    await connection.query(
      `INSERT INTO reparaciones (
        id, empresa_id, sucursal_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email,
        tipo_equipo, marca, modelo, color, imei_serie, patron_contrasena,
        acceso_tipo, acceso_valor,
        estado_fisico, diagnostico_inicial,
        estado, prioridad,
        mano_obra, subtotal, impuestos, total,
        monto_anticipo, saldo_anticipo, metodo_anticipo,
        fecha_ingreso, observaciones,
        precio_revision_contrato, condiciones_servicio_contrato,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        repairId, empresaId, sucursalId, clienteId || null, clienteNombre, clienteTelefonoNormalizado, clienteEmail,
        tipoEquipo, marca, modelo, color, imeiSerie, patronContrasena,
        acceso_tipo, acceso_valor,
        estadoFisico, diagnosticoInicial,
        estado, prioridad,
        manoObraCentavos, subtotalCentavos, impuestosCentavos, totalCentavos,
        anticipoCentavos, anticipoCentavos, metodoAnticipoNormalizado,
        fechaIngreso || new Date().toISOString().split('T')[0], observaciones,
        precioRevisionContrato, condicionesServicioContrato,
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
    const anticipoEstadoTexto =
      metodoAnticipoNormalizado === 'efectivo'
        ? 'registrado en caja operativa'
        : 'pendiente de confirmación bancaria';

    const notaInicial = anticipoCentavos > 0
      ? `Reparación creada. Anticipo registrado: Q${centavosAQuetzales(anticipoCentavos).toFixed(2)} (${metodoAnticipoNormalizado}) ${anticipoEstadoTexto}`
      : 'Reparación creada';
    
    const [historialResult] = await connection.query(
      `INSERT INTO reparaciones_historial (
        reparacion_id, estado, nota, user_nombre, tipo_evento, estado_anterior, descripcion
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [repairId, estado, notaInicial, authUserName, 'REPARACION_CREADA', null, 'Reparación registrada en el sistema']
    );
    
    const historialId = historialResult.insertId;

    // 4.1. Registrar anticipo como movimiento pendiente en Caja/Bancos
    if (anticipoCentavos > 0) {
      const montoDecimal = centavosAQuetzales(anticipoCentavos);
      const conceptoAnticipo = `Anticipo de reparación ${repairId}`;
      const metodoLabel =
        metodoAnticipoNormalizado === 'efectivo' ? 'Efectivo'
        : metodoAnticipoNormalizado === 'transferencia' ? 'Transferencia'
        : metodoAnticipoNormalizado === 'tarjeta_bac' ? 'Tarjeta BAC'
        : metodoAnticipoNormalizado === 'tarjeta_neonet' ? 'Tarjeta Neonet'
        : 'Tarjeta';

      let cuentaUsadaId = null;

      // El anticipo siempre se registra en el ledger financiero
      // de la reparación. Para EFECTIVO, este método exige y deriva
      // automáticamente la sesión operativa abierta del usuario.
      await reparacionInventoryService.registerFinancialMovement(
        connection,
        {
          branchScope: req.branchScope,
          reparacionId: repairId,
          pagoIndice: 0,
          metodo:
            String(
              metodoAnticipoNormalizado
            ).toUpperCase(),
          montoCentavos:
            anticipoCentavos,
          usuarioId:
            req.user?.id ??
            req.user?.userId ??
            null,
        }
      );

      if (metodoAnticipoNormalizado === 'efectivo') {
        // No existe movimiento en Caja Chica.
        // El efectivo pertenece exclusivamente a Caja Operativa.
      } else if (metodoAnticipoNormalizado === 'transferencia') {
        if (!cuentaAnticipoId) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Debe seleccionar una cuenta bancaria para el anticipo por transferencia'
          });
        }

        const [cuentas] = await connection.query(
          `SELECT id FROM cuentas_bancarias
           WHERE id = ? AND empresa_id = ? AND activa = TRUE
           LIMIT 1`,
          [cuentaAnticipoId, empresaId]
        );

        if (cuentas.length === 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Cuenta bancaria no encontrada para esta empresa'
          });
        }

        cuentaUsadaId = Number(cuentaAnticipoId);

        await connection.query(
          `INSERT INTO movimientos_bancarios
           (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones, referencia_tipo, referencia_id)
           VALUES (?, ?, 'INGRESO', ?, ?, 'ANTICIPO_REPARACION', 'PENDIENTE', ?, 'Anticipo por transferencia registrado desde recepción de reparación', 'REPARACION', ?)`,
          [empresaId, cuentaUsadaId, montoDecimal, conceptoAnticipo, authUserName || 'Sistema', repairId]
        );
      } else if (metodoAnticipoNormalizado === 'tarjeta_bac') {
        const [cuentaBac] = await connection.query(
          `SELECT id FROM cuentas_bancarias
           WHERE empresa_id = ?
             AND (nombre LIKE '%BAC%' OR pos_asociado LIKE '%BAC%')
             AND activa = TRUE
           ORDER BY id
           LIMIT 1`,
          [empresaId]
        );

        cuentaUsadaId = cuentaBac.length > 0 ? cuentaBac[0].id : null;

        if (!cuentaUsadaId) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'No hay una cuenta bancaria activa asociada a POS BAC'
          });
        }

        await connection.query(
          `INSERT INTO movimientos_bancarios
           (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones, referencia_tipo, referencia_id)
           VALUES (?, ?, 'INGRESO', ?, ?, 'ANTICIPO_REPARACION', 'PENDIENTE', ?, 'Anticipo por tarjeta BAC registrado desde recepción de reparación', 'REPARACION', ?)`,
          [empresaId, cuentaUsadaId, montoDecimal, conceptoAnticipo, authUserName || 'Sistema', repairId]
        );
      } else if (metodoAnticipoNormalizado === 'tarjeta_neonet') {
        const [cuentaNeonet] = await connection.query(
          `SELECT id FROM cuentas_bancarias
           WHERE empresa_id = ?
             AND (nombre LIKE '%Industrial%' OR nombre LIKE '%Neonet%' OR pos_asociado LIKE '%NEONET%' OR pos_asociado LIKE '%Industrial%')
             AND activa = TRUE
           ORDER BY id
           LIMIT 1`,
          [empresaId]
        );

        cuentaUsadaId = cuentaNeonet.length > 0 ? cuentaNeonet[0].id : null;

        if (!cuentaUsadaId) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'No hay una cuenta bancaria activa asociada a POS Neonet/Industrial'
          });
        }

        await connection.query(
          `INSERT INTO movimientos_bancarios
           (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones, referencia_tipo, referencia_id)
           VALUES (?, ?, 'INGRESO', ?, ?, 'ANTICIPO_REPARACION', 'PENDIENTE', ?, 'Anticipo por tarjeta Neonet registrado desde recepción de reparación', 'REPARACION', ?)`,
          [empresaId, cuentaUsadaId, montoDecimal, conceptoAnticipo, authUserName || 'Sistema', repairId]
        );
      }

      if (cuentaUsadaId) {
        await connection.query(
          `UPDATE reparaciones
           SET cuenta_bancaria_anticipo_id = ?
           WHERE id = ? AND empresa_id = ?`,
          [cuentaUsadaId, repairId, empresaId]
        );
      }

      await connection.query(
        `INSERT INTO reparaciones_historial
         (reparacion_id, estado, nota, user_nombre, tipo_evento, estado_anterior, descripcion)
         VALUES (?, 'ANTICIPO_REGISTRADO', ?, ?, 'ANTICIPO_REGISTRADO', NULL, ?)`,
        [
          repairId,
          metodoAnticipoNormalizado === 'efectivo'
            ? `Anticipo Q${montoDecimal.toFixed(2)} (${metodoLabel}) registrado en Caja Operativa`
            : `Anticipo Q${montoDecimal.toFixed(2)} (${metodoLabel}) – pendiente de confirmación bancaria`,
          authUserName || 'Sistema',
          metodoAnticipoNormalizado === 'efectivo'
            ? `Anticipo de Q${montoDecimal.toFixed(2)} registrado por ${metodoLabel} en la sesión operativa de caja.`
            : `Anticipo de Q${montoDecimal.toFixed(2)} registrado por ${metodoLabel}. Pendiente de confirmación bancaria.`
        ]
      );
    }
    
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
    
    await auditoriaService.registrar({
      req, empresaId, scope: 'branch', sucursalId,
      accion: 'REPARACION_CREADA', entidad: 'REPARACION', entidadId: repairId,
      descripcion: `Reparación ${repairId} creada para ${clienteNombre}`,
      datosNuevos: {
        estado, prioridad, cliente_id: clienteId || null, tipo_equipo: tipoEquipo,
        marca, modelo, total_centavos: totalCentavos, anticipo_centavos: anticipoCentavos,
        fecha_ingreso: fechaIngreso || new Date().toISOString().split('T')[0],
      },
      metadata: { sucursal_id: sucursalId, repuestos_solicitados: items.length },
      connection, strict: true,
    });

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

      let negocioContrato = {
        nombre: 'Negocio',
      };

      try {
        const [empresas] = await db.query(
          `SELECT id, nombre, nombre_comercial, razon_social, nit, telefono,
                  COALESCE(NULLIF(correo, ''), email) AS email,
                  direccion, logo_url, color_primario,
                  precio_revision_default, condiciones_servicio_contrato
           FROM empresas
           WHERE id = ?
           LIMIT 1`,
          [empresaId]
        );

        if (empresas.length > 0) {
          const empresa = empresas[0];
          negocioContrato = {
            nombre: empresa.nombre_comercial || empresa.nombre || empresa.razon_social || 'Negocio',
            razonSocial: empresa.razon_social || null,
            nit: empresa.nit || null,
            telefono: empresa.telefono || null,
            email: empresa.email || null,
            direccion: empresa.direccion || null,
            logoUrl: empresa.logo_url || null,
            colorPrimario: empresa.color_primario || null,
            precioRevisionDefault: empresa.precio_revision_default != null ? Number(empresa.precio_revision_default) : null,
            condicionesServicioContrato: empresa.condiciones_servicio_contrato || null,
          };
        }
      } catch (empresaErr) {
        console.warn('No se pudo cargar empresa para contrato PDF:', empresaErr.message);
      }

      const firmaReceptorUrl = await getAuthUserFirmaUrl(req, db);
      const receptorUsuario = req.user?.username || req.user?.email || null;
      let clienteContratoEmail = clienteEmail || '';
      let clienteContratoNit = null;

      if (clienteId) {
        const [[clienteContrato]] = await db.query(
          `SELECT email, nit
           FROM clientes
           WHERE id = ? AND empresa_id = ?
           LIMIT 1`,
          [clienteId, empresaId]
        );
        clienteContratoEmail = clienteContrato?.email || clienteContratoEmail;
        clienteContratoNit = clienteContrato?.nit || null;
      }

      await contratoService.generarContrato({
        reparacionId:  repairId,
        fecha:         fechaFormateada,
        negocio:       negocioContrato,
        clienteNombre,
        clienteTel:    clienteTelefonoNormalizado,
        clienteEmail: clienteContratoEmail,
        clienteNit:   clienteContratoNit,
        tipoEquipo,
        marca,
        modelo,
        color,
        imei:          imeiSerie,
        acceso:        acceso_tipo !== 'ninguno' ? `${acceso_tipo} registrado` : 'ninguno',
        accesoTipo:    acceso_tipo,
        accesoValor:   acceso_valor || patronContrasena || patron_contrasena || pin || password || contrasena || patron || null,
        patronContrasena: patronContrasena || patron_contrasena || null,
        mostrarValorAcceso: true,
        descripcion:   diagnosticoInicial,
        precioRevision: firstNonEmptyValue(
          normalizePrecioRevisionContrato(req.body),
          negocioContrato.precioRevisionDefault
        ),
        condicionesServicio: splitCondicionesServicio(
          firstNonEmptyValue(
            normalizeCondicionesServicioContrato(req.body),
            negocioContrato.condicionesServicioContrato
          )
        ),
        costoTotal:    centavosAQuetzales(totalCentavos),
        anticipo:      centavosAQuetzales(anticipoCentavos),
        saldo:         centavosAQuetzales(totalCentavos - anticipoCentavos),
        firmaClienteUrl,                              // URL relativa (/uploads/firmas/...)
        receptorNombre: authUserName,
        receptorUsuario,
        firmaReceptorUrl,
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
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al crear la reparación',
      error: safeErrorDetails(error)
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
    const tenant = repairScopeClause(req, 'r');
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
    params.push(parseLimit(limit, { defaultLimit: 50, maxLimit: 100 }));
    
    const [reparaciones] = await db.query(query, params);
    
    // Convertir centavos a quetzales
    const reparacionesFormateadas = reparaciones.map(rep => {
      const safeRepair = withoutDeviceCredentials(rep);
      return ({
        ...safeRepair,
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
      });
    });
    
    res.json({
      success: true,
      data: reparacionesFormateadas
    });
    
  } catch (error) {
    console.error('Error al obtener reparaciones:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al obtener las reparaciones',
      error: safeErrorDetails(error)
    });
  }
};

// ========== OBTENER UNA REPARACIÓN POR ID ==========
exports.getReparacionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener reparación principal
    const tenant = repairScopeClause(req);
    const [reparaciones] = await db.query(
      `SELECT r.* FROM reparaciones r WHERE r.id = ?${tenant.sql}`,
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
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al obtener la reparación',
      error: safeErrorDetails(error)
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

    let repuestosUsadosEstado = [];

    try {
      const rawRepuestos = req.body.repuestosUsados;

      if (Array.isArray(rawRepuestos)) {
        repuestosUsadosEstado = rawRepuestos;
      } else if (rawRepuestos) {
        repuestosUsadosEstado = JSON.parse(rawRepuestos);
      }

      if (!Array.isArray(repuestosUsadosEstado)) {
        throw new Error('Formato inválido');
      }
    } catch (_) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'El formato de los repuestos utilizados es inválido',
      });
    }

    const uploadedFiles = req.files || [];
    const tenant = repairScopeClause(req);
    
    // Obtener reparación actual
    const [reparaciones] = await connection.query(
      `SELECT r.* FROM reparaciones r WHERE r.id = ?${tenant.sql}`,
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

    const authUserId =
      req.user?.id ||
      req.user?.userId ||
      req.user?.usuario_id ||
      null;

    let costoRepuestosUsados = 0;

    for (let lineaIdx = 0; lineaIdx < repuestosUsadosEstado.length; lineaIdx++) {
      const item = repuestosUsadosEstado[lineaIdx];
      const repuestoId = Number(
        item.repuesto_id ?? item.repuestoId
      );
      const cantidad = Number(item.cantidad);

      if (
        !Number.isInteger(repuestoId) ||
        repuestoId <= 0 ||
        !Number.isInteger(cantidad) ||
        cantidad <= 0
      ) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Repuesto o cantidad inválida',
        });
      }

      // Obtener precio_costo para el cálculo de costos (solo lectura del catálogo)
      const [[repuestoCatalog]] = await connection.query(
        `SELECT id, nombre, precio_costo FROM repuestos
         WHERE id = ? AND empresa_id = ? FOR UPDATE`,
        [repuestoId, reparacion.empresa_id]
      );

      if (!repuestoCatalog) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Repuesto ID ${repuestoId} no encontrado para esta empresa`,
        });
      }

      const costoUnitario = Number(repuestoCatalog.precio_costo || 0);
      const subtotal = costoUnitario * cantidad;
      costoRepuestosUsados += subtotal;

      // Consumir desde repuesto_existencias (no toca repuestos.stock)
      await reparacionInventoryService.consumeRepuesto(connection, {
        branchScope: req.branchScope,
        reparacionId: id,
        repuestoId,
        cantidad,
        linea: lineaIdx,
        usuarioId: authUserId,
      });

      await connection.query(
        `INSERT INTO reparacion_repuestos (
          empresa_id, sucursal_id, reparacion_id,
          repuesto_id, nombre, cantidad, costo_unitario, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reparacion.empresa_id,
          Number(req.branchScope.sucursalId),
          id,
          repuestoId,
          repuestoCatalog.nombre,
          cantidad,
          costoUnitario,
          subtotal,
        ]
      );
    }

    
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
        id, safeEstadoHistorial(estado), subEtapa || null, nota,
        piezaNecesaria || null, proveedor || null,
        costoRepuesto ? quetzalesACentavos(parseFloat(costoRepuesto)) : null,
        stickerNumero || null, stickerUbicacion || null,
        diferenciaReparacion ? quetzalesACentavos(parseFloat(diferenciaReparacion)) : null,
        'Usuario',
        'CAMBIO_ESTADO', estadoAnterior ? safeEstadoHistorial(estadoAnterior) : null, nota || null
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

    if (costoRepuestosUsados > 0) {
      updates.costo_repuestos_total =
        Number(reparacion.costo_repuestos_total || 0) +
        costoRepuestosUsados;

      updates.total_invertido =
        Number(reparacion.total_invertido || 0) +
        costoRepuestosUsados;
    }
    
    // Manejar costo de repuesto
    if (costoRepuesto && parseFloat(costoRepuesto) > 0) {
      const costoCentavos = quetzalesACentavos(parseFloat(costoRepuesto));
      const nuevoSaldo = reparacion.saldo_anticipo - costoCentavos;
      const nuevoInvertido =
        Number(
          updates.total_invertido ??
          reparacion.total_invertido ??
          0
        ) + costoCentavos;
      
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
           WHERE id = ? AND estado = 'DISPONIBLE' AND empresa_id = ?`,
          [id, stickerUbicacion, stickerId, reparacion.empresa_id]
        );
      }
    }
    
    // Manejar entrega
    if (estado === 'ENTREGADA') {
      updates.fecha_cierre = new Date().toISOString().split('T')[0];
      
      if (diferenciaReparacion !== undefined) {
        const diferenciaCentavos = quetzalesACentavos(parseFloat(diferenciaReparacion));
        const saldoFinal = reparacion.saldo_anticipo + diferenciaCentavos;
        const gananciaTotal =
          (reparacion.monto_anticipo + diferenciaCentavos) -
          Number(
            updates.total_invertido ??
            reparacion.total_invertido ??
            0
          );
        
        updates.diferencia_reparacion = diferenciaCentavos;
        updates.saldo_anticipo = saldoFinal;
        updates.total_ganancia = gananciaTotal;
      }
    }
    
    // Construir query de actualización con whitelist de columnas permitidas
    const allowedUpdateFields = new Set([
      'estado',
      'sub_etapa',
      'saldo_anticipo',
      'total_invertido',
      'costo_repuestos_total',
      'sticker_serie_interna',
      'sticker_ubicacion',
      'fecha_cierre',
      'diferencia_reparacion',
      'total_ganancia',
    ]);

    const updateKeys = Object.keys(updates);

    const invalidUpdateFields = updateKeys.filter(key => !allowedUpdateFields.has(key));
    if (invalidUpdateFields.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Campos de actualización no permitidos',
      });
    }

    const updateFields = updateKeys.map(key => `${key} = ?`).join(', ');
    const updateValues = updateKeys.map(key => updates[key]);
    
    await connection.query(
      `UPDATE reparaciones r SET ${updateFields} WHERE r.id = ?${tenant.sql}`,
      [...updateValues, id, ...tenant.params]
    );
    
    await auditoriaService.registrar({
      req,
      empresaId: Number(req.branchScope.empresaId),
      scope: 'branch',
      sucursalId: Number(req.branchScope.sucursalId),
      accion: 'REPARACION_ESTADO_CAMBIADO',
      entidad: 'REPARACION',
      entidadId: id,
      descripcion: `Estado de reparación ${id} cambiado de ${estadoAnterior} a ${estado}`,
      datosAnteriores: { estado: estadoAnterior },
      datosNuevos: { ...updates, estado, repuestos_consumidos: repuestosUsadosEstado },
      metadata: { sucursal_id: Number(req.branchScope.sucursalId), historial_id: historialId },
      connection,
      strict: true,
    });
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
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al cambiar el estado',
      error: safeErrorDetails(error)
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
    const tenant = repairScopeClause(req);
    const [[repActual]] = await db.query(
      `SELECT r.estado FROM reparaciones r WHERE r.id = ?${tenant.sql}`, [id, ...tenant.params]
    );
    if (!repActual) {
      return res.status(404).json({ success: false, message: 'ReparaciÃ³n no encontrada' });
    }
    const estadoAnteriorSimple = repActual ? repActual.estado : null;

    // Actualizar estado en la reparación
    await db.query(
      `UPDATE reparaciones r SET estado = ? WHERE r.id = ?${tenant.sql}`,
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
        safeEstadoHistorial(estado),
        `Estado actualizado a ${estado}`,
        'Usuario',
        'CAMBIO_ESTADO', estadoAnteriorSimple ? safeEstadoHistorial(estadoAnteriorSimple) : null,
        `Estado actualizado a ${estado}`
      ]
    );

    await auditoriaService.registrar({
      req,
      empresaId: req.tenant?.empresa_id ?? req.branchScope?.empresaId,
      accion: 'EDITAR',
      entidad: 'REPARACION',
      entidadId: id,
      descripcion: `Estado de reparación actualizado a ${estado}`,
      datosAnteriores: { estado: estadoAnteriorSimple },
      datosNuevos: { estado },
    });
    res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al actualizar el estado',
      error: safeErrorDetails(error)
    });
  }
};

// ========== HISTORIAL COMPLETO (línea de tiempo unificada) ==========
exports.getHistorialCompleto = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la reparación exista
    const tenant = repairScopeClause(req);
    const [[reparacion]] = await db.query(
      `SELECT r.* FROM reparaciones r WHERE r.id = ?${tenant.sql}`,
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

    // 3. Movimientos efectivos de Caja Operativa
    const [movCajaOperativa] =
      await db.query(
        `SELECT
           rmf.*,
           u.name AS usuario_nombre
         FROM reparacion_movimientos_financieros rmf
         LEFT JOIN users u
           ON u.id = rmf.usuario_id
         WHERE rmf.reparacion_id = ?
           AND UPPER(rmf.metodo) = 'EFECTIVO'
         ORDER BY
           rmf.created_at ASC,
           rmf.id ASC`,
        [id]
      );

    for (const mov of movCajaOperativa) {
      const esReversa =
        mov.accion === 'REVERSA';

      const esAnticipo =
        Number(mov.pago_indice) === 0;

      eventos.push({
        id:
          `caja-operativa-${mov.id}`,
        tipo_evento:
          esReversa
            ? 'DEVOLUCION_EFECTIVO'
            : (
                esAnticipo
                  ? 'ANTICIPO_CONFIRMADO'
                  : 'PAGO_SALDO'
              ),
        titulo:
          esReversa
            ? 'Devolución registrada en Caja Operativa'
            : (
                esAnticipo
                  ? 'Anticipo registrado en Caja Operativa'
                  : 'Pago en efectivo registrado en Caja Operativa'
              ),
        descripcion:
          esReversa
            ? 'Salida de efectivo registrada en la sesión operativa de caja'
            : 'Ingreso de efectivo registrado en la sesión operativa de caja',
        estado_anterior: null,
        estado_nuevo: null,
        nota: null,
        usuario:
          mov.usuario_nombre ||
          (
            mov.usuario_id
              ? `Usuario #${mov.usuario_id}`
              : 'Sistema'
          ),
        fecha: mov.created_at,
        monto:
          centavosAQuetzales(
            Number(
              mov.monto_centavos ||
              0
            )
          ),
        metodo_pago: 'EFECTIVO',
        banco: null,
        imagenes: [],
      });
    }

    // 3.1. Movimientos históricos de Caja Chica
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
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al obtener el historial',
      error: safeErrorDetails(error)
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
  if (!estado) return null;

  // reparaciones.estado acepta EN_PROCESO,
  // pero reparaciones_historial.estado usa EN_REPARACION.
  if (estado === 'EN_PROCESO') return 'EN_REPARACION';

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

    const tenant = repairScopeClause(req);
    const [[rep]] = await connection.query(
      `SELECT r.id, r.estado, r.prioridad FROM reparaciones r WHERE r.id = ?${tenant.sql}`, [id, ...tenant.params]
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
      `UPDATE reparaciones r SET prioridad = ?, updated_by = ? WHERE r.id = ?${tenant.sql}`,
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
    res.status(error.statusCode || 500).json({ success: false, message: safeErrorMessage(error, 'Error al actualizar la prioridad'), error: safeErrorDetails(error) });
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
    const usuarioId = req.user?.id || req.user?.userId || null;

    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'El monto debe ser un número mayor a cero' });
    }

    const METODOS_VALIDOS = ['efectivo', 'transferencia', 'tarjeta', 'tarjeta_bac', 'tarjeta_neonet', 'tarjeta_otra'];
    const metodoNorm = String(metodoPago || '').toLowerCase();
    if (!metodoNorm || !METODOS_VALIDOS.includes(metodoNorm)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Método de pago inválido' });
    }

    const tenant = repairScopeClause(req);
    const [[rep]] = await connection.query(
      `SELECT
         r.id,
         r.estado,
         r.total,
         r.monto_anticipo,
         r.monto_pagado_adicional,
         r.monto_pago_final
       FROM reparaciones r
       WHERE r.id = ?${tenant.sql}
       FOR UPDATE`,
      [id, ...tenant.params]
    );
    if (!rep) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }
    if (rep.estado === 'CANCELADA') {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'No se puede registrar pago en una reparación cancelada' });
    }

    const totalCentavos = Number(rep.total || 0);

    const yaPagadoCentavos =
      Number(rep.monto_anticipo || 0) +
      Number(rep.monto_pagado_adicional || 0) +
      Number(rep.monto_pago_final || 0);

    const saldoPendienteCentavos =
      Math.max(0, totalCentavos - yaPagadoCentavos);

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

    // Validar caja scope para efectivo; registrar en ledger financiero.
    const metodoLedger = metodoNorm.toUpperCase();
    const [[pagoIndiceRow]] = await connection.query(
      `SELECT COALESCE(MAX(pago_indice), -1) + 1 AS siguiente_indice
       FROM reparacion_movimientos_financieros
       WHERE empresa_id = ?
         AND sucursal_id = ?
         AND reparacion_id = ?
         AND accion = 'INGRESO'`,
      [
        Number(req.branchScope.empresaId),
        Number(req.branchScope.sucursalId),
        id,
      ]
    );

    const pagoIndice = Number(pagoIndiceRow.siguiente_indice);

    await reparacionInventoryService.registerFinancialMovement(connection, {
      branchScope: req.branchScope,
      reparacionId: id,
      pagoIndice,
      metodo: metodoLedger,
      montoCentavos,
      usuarioId,
    });

    const nuevoMontoPagadoAdicional =
      Number(rep.monto_pagado_adicional || 0) +
      montoCentavos;

    const nuevoTotalPagado =
      Number(rep.monto_anticipo || 0) +
      nuevoMontoPagadoAdicional +
      Number(rep.monto_pago_final || 0);

    const nuevoEstadoPago =
      nuevoTotalPagado >= totalCentavos
        ? 'pagado'
        : nuevoTotalPagado > 0
          ? 'parcial'
          : 'pendiente';

    await connection.query(
      `UPDATE reparaciones r
       SET monto_pagado_adicional = ?,
           metodo_pago_adicional = ?,
           total_pagado = ?,
           estado_pago = ?,
           updated_by = ?
       WHERE r.id = ?${tenant.sql}`,
      [
        nuevoMontoPagadoAdicional,
        metodoNorm,
        nuevoTotalPagado,
        nuevoEstadoPago,
        usuario,
        id,
        ...tenant.params,
      ]
    );

    await connection.query(
      `INSERT INTO reparaciones_historial
        (reparacion_id, estado, nota, user_nombre, tipo_evento, estado_anterior, descripcion)
       VALUES (?, ?, ?, ?, 'PAGO_SALDO', NULL, ?)`,
      [
        id, safeEstadoHistorial(rep.estado),
        `Pago de saldo registrado: Q${montoNum.toFixed(2)} (${metodoNorm})`,
        usuario,
        `Pago de saldo Q${montoNum.toFixed(2)} en ${metodoNorm}`
      ]
    );

    await connection.commit();

    const totalPagado =
      centavosAQuetzales(nuevoTotalPagado);

    const saldoRestante =
      centavosAQuetzales(
        Math.max(0, totalCentavos - nuevoTotalPagado)
      );

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
    res.status(error.statusCode || 500).json({ success: false, message: safeErrorMessage(error, 'Error al registrar el pago'), error: safeErrorDetails(error) });
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
    const tenant = repairScopeClause(req, 'r');
    const [[rep]] = await connection.query(
      `SELECT
         r.id,
         r.estado,
         r.cliente_nombre,
         r.monto_anticipo,
         r.monto_pagado_adicional,
         r.monto_pago_final,
         r.metodo_anticipo,
         r.cuenta_bancaria_anticipo_id
       FROM reparaciones r
       WHERE r.id = ?${tenant.sql}
       FOR UPDATE`,
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

    /*
     * Mientras el flujo de cancelación administre únicamente
     * devoluciones del anticipo, no es seguro cancelar una
     * reparación que ya recibió pagos posteriores.
     *
     * No se modifica dinero ni estado: la operación completa
     * se rechaza antes de cualquier reversa.
     */
    const pagosPosterioresCentavos =
      Number(rep.monto_pagado_adicional || 0) +
      Number(rep.monto_pago_final || 0);

    if (pagosPosterioresCentavos > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        code:
          'REPAIR_CANCEL_ADDITIONAL_PAYMENTS_REQUIRE_REFUND_FLOW',
        message:
          'La reparación tiene pagos posteriores al anticipo. Debe procesarse mediante un flujo de devolución antes de cancelarla.',
      });
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

    /*
     * Compatibilidad histórica:
     * Las reparaciones antiguas podían tener el anticipo efectivo
     * almacenado en caja_chica.
     *
     * Ya no se crean movimientos comerciales nuevos allí.
     */
    const [movsCajaLegacy] =
      await connection.query(
        `SELECT *
         FROM caja_chica
         WHERE referencia_tipo = 'REPARACION'
           AND referencia_id = ?
           AND categoria = 'ANTICIPO_REPARACION'
           AND tipo_movimiento = 'INGRESO'
         ORDER BY id DESC
         LIMIT 1`,
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

    // ── Compatibilidad con anticipos legacy de Caja Chica ───────────────
    if (movsCajaLegacy.length > 0) {
      const legacy = movsCajaLegacy[0];

      anticipoMovId = legacy.id;

      /*
       * Una devolución de un anticipo histórico no puede volver a
       * contaminar Caja Chica. Se bloquea para que sea migrada o
       * resuelta explícitamente antes de devolver físicamente dinero.
       */
      if (
        devolver &&
        montoDev > 0
      ) {
        const error = new Error(
          'Este anticipo pertenece al flujo histórico de Caja Chica. Debe migrarse antes de registrar una devolución.'
        );
        error.statusCode = 409;
        error.code =
          'LEGACY_REPAIR_CASH_REFUND_REQUIRES_MIGRATION';
        throw error;
      }

      if (legacy.estado === 'PENDIENTE') {
        notasAnticipo.push(
          `Anticipo histórico de Caja Chica pendiente: Q${Number(legacy.monto).toFixed(2)}`
        );
      } else if (
        legacy.estado === 'CONFIRMADO'
      ) {
        notasAnticipo.push(
          `Anticipo histórico de Caja Chica retenido: Q${Number(legacy.monto).toFixed(2)}`
        );
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

    // ── Revertir inventario de repuestos (ledger; idempotente) ──────────────
    // Si hay repuestos en reparacion_repuestos pero sin ledger → bloquea (histórico inseguro)
    const [repuestosConsumo] = await connection.query(
      'SELECT repuesto_id FROM reparacion_repuestos WHERE reparacion_id = ? LIMIT 10',
      [id]
    );
    const inventarioResult = await reparacionInventoryService.reverseAllRepuestos(connection, {
      branchScope: req.branchScope,
      reparacionId: id,
      usuarioId: req.user?.id || null,
      fallbackItems: repuestosConsumo,
    });
    if (inventarioResult.reversed > 0) {
      notasAnticipo.push(`Inventario revertido: ${inventarioResult.reversed} tipo(s) de repuesto`);
    }

    // ── Revertir movimientos financieros en ledger (idempotente) ─────────────
    const [regaliasRegistradas] = await connection.query(
      `SELECT item_id, tipo_inventario
       FROM reparacion_regalias
       WHERE reparacion_id = ?
       LIMIT 100`,
      [id]
    );

    const regaliasResult =
      await reparacionInventoryService.reverseAllRegalias(connection, {
        branchScope: req.branchScope,
        reparacionId: id,
        usuarioId: req.user?.id || req.user?.userId || null,
        fallbackItems: regaliasRegistradas,
      });

    if (regaliasResult.reversed > 0) {
      notasAnticipo.push(
        `Regalías revertidas: ${regaliasResult.reversed}`
      );
    }

    /*
     * Una cancelación solo provoca salida física de dinero
     * cuando realmente se devuelve dinero al cliente.
     *
     * El anticipo inicial siempre utiliza pago_indice = 0.
     */
    let financieroResult = {
      count: 0,
      montoCentavos: 0,
    };

    if (
      devolver &&
      montoDev > 0 &&
      !movsCajaLegacy.length
    ) {
      financieroResult =
        await reparacionInventoryService
          .reverseFinancialPaymentAmount(
            connection,
            {
              branchScope:
                req.branchScope,
              reparacionId: id,
              pagoIndice: 0,
              montoCentavos:
                quetzalesACentavos(
                  montoDev
                ),
              usuarioId:
                req.user?.id ??
                req.user?.userId ??
                null,
            }
          );

      if (financieroResult.count > 0) {
        anticipoMovId =
          financieroResult.ingresoId ||
          anticipoMovId;

        devolucionMovId =
          financieroResult.reversaId ||
          devolucionMovId;

        notasAnticipo.push(
          `Devolución registrada en ledger financiero: Q${montoDev.toFixed(2)}`
        );
      }
    }

    await connection.query(
      `UPDATE reparaciones r
         SET estado                  = 'CANCELADA',
             fecha_cancelacion       = ?,
             motivo_cancelacion      = ?,
             devolucion_monto        = ?,
             monto_retenido          = ?,
             motivo_retencion        = ?,
             anticipo_movimiento_id  = ?,
             devolucion_movimiento_id = ?,
             updated_by              = ?
       WHERE r.id = ?${tenant.sql}`,
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

    await auditoriaService.registrar({
      req,
      empresaId: Number(req.branchScope.empresaId),
      scope: 'branch',
      sucursalId: Number(req.branchScope.sucursalId),
      accion: 'REPARACION_CANCELADA',
      entidad: 'REPARACION',
      entidadId: id,
      descripcion: `Reparación ${id} cancelada`,
      datosAnteriores: { estado: estadoAnterior },
      datosNuevos: {
        estado: 'CANCELADA',
        motivo: motivoLimpio,
        devolucion_monto: montoDev,
        monto_retenido: montoRetenido,
      },
      metadata: { sucursal_id: Number(req.branchScope.sucursalId), reversa_inventario: true },
      connection,
      strict: true,
    });
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
    res.status(error.statusCode || 500).json({ success: false, message: safeErrorMessage(error, 'Error al cancelar la reparación'), error: safeErrorDetails(error) });
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
    const tenant = repairScopeClause(req);
    const [[reparacion]] = await connection.query(
      `SELECT r.*
       FROM reparaciones r
       WHERE r.id = ?${tenant.sql}
       FOR UPDATE`,
      [id, ...tenant.params]
    );
    if (!reparacion) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }

    const authUserName = await getAuthUserName(req, connection);

    const authUserId =
      req.user?.id ||
      req.user?.userId ||
      req.user?.usuario_id ||
      null;

    if (['COMPLETADA', 'ENTREGADA'].includes(reparacion.estado)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: `La reparación ya se encuentra en estado ${reparacion.estado}`,
      });
    }

    // ── 2. Procesar repuestos utilizados ─────────────────────────────────
    const inventarioEmpresaId =
      reparacion.empresa_id ?? requireTenantEmpresaId(req);

    let costoRepuestosTotal = 0;

    for (let lineaIdx = 0; lineaIdx < repuestosUsados.length; lineaIdx++) {
      const item = repuestosUsados[lineaIdx];
      const cantidad = Number(item.cantidad);

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'La cantidad del repuesto debe ser un entero mayor que cero',
        });
      }

      // Leer solo precio_costo del catálogo (no modifica repuestos.stock)
      const [[rep]] = await connection.query(
        `SELECT id, nombre, precio_costo
         FROM repuestos
         WHERE id = ? AND empresa_id = ?
         FOR UPDATE`,
        [item.repuesto_id, inventarioEmpresaId]
      );

      if (!rep) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Repuesto ID ${item.repuesto_id} no encontrado`,
        });
      }

      const costoUnit = Number(rep.precio_costo || 0);
      const subtotal = costoUnit * cantidad;
      costoRepuestosTotal += subtotal;

      // Consumir desde repuesto_existencias (no toca repuestos.stock)
      await reparacionInventoryService.consumeRepuesto(connection, {
        branchScope: req.branchScope,
        reparacionId: id,
        repuestoId: rep.id,
        cantidad,
        linea: lineaIdx,
        usuarioId: authUserId,
      });

      await connection.query(
        `INSERT INTO reparacion_repuestos (
          empresa_id, sucursal_id, reparacion_id,
          repuesto_id, nombre, cantidad, costo_unitario, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inventarioEmpresaId,
          Number(req.branchScope.sucursalId),
          id,
          rep.id,
          rep.nombre,
          cantidad,
          costoUnit,
          subtotal,
        ]
      );
    }

    // ── 3. Procesar regalías ──────────────────────────────────────────────
    let costoRegaliasTotal = 0;

    for (
      let regaliaIdx = 0;
      regaliaIdx < regaliasUsadas.length;
      regaliaIdx++
    ) {
      const item = regaliasUsadas[regaliaIdx];
      const cantidad = Number(item.cantidad);

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'La cantidad de la regalía debe ser un entero mayor que cero',
        });
      }

      const tipoRegalia =
        String(item.tipo || '').toLowerCase() === 'producto'
          ? 'PRODUCTO'
          : 'REPUESTO';

      let costoUnit = 0;
      let nombreItem = item.nombre || '';

      if (tipoRegalia === 'PRODUCTO') {
        const [[prod]] = await connection.query(
          `SELECT id, nombre, precio_costo
           FROM productos
           WHERE id = ? AND empresa_id = ?
           FOR UPDATE`,
          [item.id, inventarioEmpresaId]
        );

        if (!prod) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Producto ID ${item.id} no encontrado`,
          });
        }

        costoUnit = Math.round(
          Number(prod.precio_costo || 0) * 100
        );
        nombreItem = prod.nombre;
      } else {
        const [[rep]] = await connection.query(
          `SELECT id, nombre, precio_costo
           FROM repuestos
           WHERE id = ? AND empresa_id = ?
           FOR UPDATE`,
          [item.id, inventarioEmpresaId]
        );

        if (!rep) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Repuesto ID ${item.id} no encontrado`,
          });
        }

        costoUnit = Number(rep.precio_costo || 0);
        nombreItem = rep.nombre;
      }

      await reparacionInventoryService.consumeRegalia(connection, {
        branchScope: req.branchScope,
        reparacionId: id,
        tipoItem: tipoRegalia,
        itemId: item.id,
        cantidad,
        linea: regaliaIdx,
        usuarioId: authUserId,
      });

      const subtotal = costoUnit * cantidad;
      costoRegaliasTotal += subtotal;

      await connection.query(
        `INSERT INTO reparacion_regalias (
          reparacion_id,
          item_id,
          nombre,
          tipo_inventario,
          cantidad,
          costo_unitario,
          subtotal,
          nota
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.id,
          nombreItem,
          tipoRegalia.toLowerCase(),
          cantidad,
          costoUnit,
          subtotal,
          item.nota || null,
        ]
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
          'SELECT id, nombre FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE',
          [cuentaBancariaId, inventarioEmpresaId]
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

    const totalPagadoCentavos =
      Number(reparacion.monto_anticipo || 0) +
      Number(reparacion.monto_pagado_adicional || 0) +
      montoPagoFinalCentavos;
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
         WHERE id = ? AND estado = 'DISPONIBLE' AND empresa_id = ?`,
        [id, stickerUbicacion || null, stickerId, reparacion.empresa_id]
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

    // ── 9. Registrar movimiento financiero en ledger (dentro de la transacción) ──
    // Pago + inventario + reparación son atómicos. Si el ledger falla → rollback total.
    if (metodoPagoFinal && montoPagoFinalCentavos > 0) {
      const [[pagoIndiceRow]] = await connection.query(
        `SELECT COALESCE(MAX(pago_indice), -1) + 1 AS siguiente_indice
         FROM reparacion_movimientos_financieros
         WHERE empresa_id = ?
           AND sucursal_id = ?
           AND reparacion_id = ?
           AND accion = 'INGRESO'`,
        [
          Number(req.branchScope.empresaId),
          Number(req.branchScope.sucursalId),
          id,
        ]
      );

      const pagoIndice =
        Number(pagoIndiceRow.siguiente_indice);

      await reparacionInventoryService.registerFinancialMovement(connection, {
        branchScope: req.branchScope,
        reparacionId: id,
        pagoIndice,
        metodo: metodoPagoFinal,
        montoCentavos: montoPagoFinalCentavos,
        usuarioId: authUserId,
      });
    }

    await auditoriaService.registrar({
      req, empresaId: reparacion.empresa_id, scope: 'branch',
      sucursalId: Number(req.branchScope.sucursalId),
      accion: 'REPARACION_FINALIZADA', entidad: 'REPARACION', entidadId: id,
      descripcion: `Reparación ${id} finalizada`,
      datosAnteriores: { estado: reparacion.estado },
      datosNuevos: { estado: 'COMPLETADA', estado_pago: estadoPago, repuestos_consumidos: repuestosUsados, regalias_consumidas: regaliasUsadas },
      metadata: { sucursal_id: Number(req.branchScope.sucursalId), historial_id: historialId },
      connection, strict: true,
    });

    await connection.commit();

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
    res.status(error.statusCode || 500).json({ success: false, message: safeErrorMessage(error, 'Error al completar la reparación') });
  } finally {
    connection.release();
  }
};

// ========== DESCARGAR CONTRATO PDF ==========
exports.descargarContrato = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = repairScopeClause(req, 'r');
    const [[rep]] = await db.query(
      `SELECT r.* FROM reparaciones r WHERE r.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (!rep) {
      return res.status(404).json({ success: false, message: 'Reparación no encontrada' });
    }

    const contratoPath = path.join(
      __dirname, '..', 'uploads', 'contratos', id, `contrato_reparacion_${id}.pdf`
    );

    if (!fs.existsSync(contratoPath)) {
      console.warn('[ContratoPDF] contrato faltante, regenerando:', contratoPath);
      const [[empresa]] = await db.query(
        `SELECT id, nombre, nombre_comercial, razon_social, nit, telefono, correo, email, direccion, logo_url, color_primario,
                precio_revision_default, condiciones_servicio_contrato
         FROM empresas
         WHERE id = ?
         LIMIT 1`,
        [rep.empresa_id]
      );

      if (!empresa) {
        return res.status(500).json({ success: false, message: 'No se pudo cargar la empresa para generar el contrato' });
      }

      const formatFechaContrato = (value) => {
        if (!value) return new Date().toLocaleDateString('es-GT');
        const raw = String(value);
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[3]}/${match[2]}/${match[1]}`;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
          ? raw
          : parsed.toLocaleDateString('es-GT');
      };

      const firmaReceptorUrl = await getAuthUserFirmaUrl(req, db);
      const receptorUsuario = req.user?.username || req.user?.email || rep.created_by || null;

      try {
        await contratoService.generarContrato({
          reparacionId: rep.id,
          fecha: formatFechaContrato(rep.fecha_ingreso || rep.created_at),
          negocio: {
            nombre: empresa.nombre_comercial || empresa.nombre || empresa.razon_social || 'Negocio',
            razonSocial: empresa.razon_social || empresa.nombre_legal || null,
            nit: empresa.nit || empresa.nit_empresa || null,
            telefono: empresa.telefono || empresa.telefono_empresa || empresa.celular || null,
            email: empresa.correo || empresa.email || empresa.email_empresa || null,
            direccion: empresa.direccion || empresa.direccion_empresa || null,
            logoUrl: empresa.logo_url || empresa.logoUrl || empresa.logo || null,
            colorPrimario: empresa.color_primario || empresa.colorPrimario || null,
          },
          clienteNombre: rep.cliente_nombre || '',
          clienteTel: rep.cliente_telefono || '',
          clienteEmail: rep.cliente_email || '',
          tipoEquipo: rep.tipo_equipo || '',
          marca: rep.marca || '',
          modelo: rep.modelo || '',
          color: rep.color || '',
          imei: rep.imei_serie || '',
          acceso: rep.acceso_tipo && rep.acceso_tipo !== 'ninguno' ? `${rep.acceso_tipo} registrado` : 'ninguno',
          accesoTipo: rep.acceso_tipo || 'ninguno',
          accesoValor: rep.acceso_valor || null,
          patronContrasena: rep.patron_contrasena || null,
          mostrarValorAcceso: true,
          descripcion: rep.diagnostico_inicial || rep.observaciones || '',
          precioRevision: firstNonEmptyValue(
            rep.precio_revision_contrato != null ? Number(rep.precio_revision_contrato) : null,
            empresa.precio_revision_default != null ? Number(empresa.precio_revision_default) : null
          ),
          condicionesServicio: splitCondicionesServicio(
            firstNonEmptyValue(
              rep.condiciones_servicio_contrato,
              empresa.condiciones_servicio_contrato
            )
          ),
          costoTotal: centavosAQuetzales(rep.total || 0),
          anticipo: centavosAQuetzales(rep.monto_anticipo || 0),
          anticipoRecibido: centavosAQuetzales(rep.monto_anticipo || 0),
          firmaClienteUrl: rep.firma_cliente_url || resolveFirmaClienteUrlByRepairId(rep.id) || null,
          receptorNombre: rep.created_by || 'Usuario receptor',
          receptorUsuario,
          firmaReceptorUrl,
        });
      } catch (generateErr) {
        console.error('Error regenerando contrato PDF:', generateErr);
        return res.status(500).json({ success: false, message: 'No se pudo generar el contrato' });
      }

      if (fs.existsSync(contratoPath)) {
        console.log(`[ContratoPDF] contrato regenerado para descarga: ${contratoPath}`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contrato_${id}.pdf"`);
        return res.sendFile(contratoPath);
      }
      return res.status(500).json({ success: false, message: 'No se pudo generar el contrato' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contrato_${id}.pdf"`);
    res.sendFile(contratoPath);
  } catch (err) {
    console.error('Error al descargar contrato:', err);
    res.status(500).json({ success: false, message: 'Error al obtener el contrato' });
  }
};
