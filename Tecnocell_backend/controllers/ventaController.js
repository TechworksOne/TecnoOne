const db = require('../config/database');
const { parsePagination } = require('../utils/pagination');
const cajaController = require('./cajaController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  imageFileFilter,
  getSafeImageExtension,
} = require('../utils/uploadSecurity');
const { validatePhone } = require('../utils/phoneValidation');
const auditoriaService = require('../services/auditoriaService');

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

function ventaTenantClause(req, alias = 'v') {
  return isSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

const VENTAS_UPLOADS_BASE = path.join(
  __dirname,
  '..',
  'uploads',
  'ventas'
);

const uploadComprobante = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const empresaId = requireTenantEmpresaId(req);
        const dir = path.join(
          VENTAS_UPLOADS_BASE,
          String(empresaId),
          'comprobantes'
        );

        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const ext = getSafeImageExtension(file);
      const random = Math.random().toString(36).slice(2, 10);

      cb(null, `comprobante-${Date.now()}-${random}${ext}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: imageFileFilter,
});

exports.uploadComprobante = uploadComprobante;

exports.subirComprobante = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);

    if (!req.file) {
      return res.status(400).json({
        message: 'Debes seleccionar una imagen de comprobante.',
      });
    }

    const url = `/uploads/ventas/${empresaId}/comprobantes/${req.file.filename}`;

    return res.status(201).json({
      success: true,
      data: { url },
    });
  } catch (error) {
    console.error('Error al subir comprobante:', error);

    return res.status(error.statusCode || 500).json({
      message: error.message || 'Error al subir el comprobante.',
    });
  }
};

// Valores permitidos para metodo_pago (deben coincidir con el ENUM de la DB)
const VALID_METODOS_PAGO = [
  'EFECTIVO', 'TRANSFERENCIA',
  'TARJETA', // legado
  'TARJETA_BAC', 'TARJETA_NEONET', 'TARJETA_OTRA',
  'MIXTO'
];

/**
 * Normaliza el metodo_pago al valor que acepta el ENUM de la DB.
 * Si viene en minúsculas o es un alias, lo convierte.
 */
function normalizeMetodoPago(metodo) {
  if (!metodo) return null;
  const upper = metodo.toUpperCase();
  // Mapear alias legacy lowercase
  const MAP = {
    'TARJETA': 'TARJETA',
    'TARJETA_BAC': 'TARJETA_BAC',
    'TARJETA_NEONET': 'TARJETA_NEONET',
    'TARJETA_OTRA': 'TARJETA_OTRA',
    'EFECTIVO': 'EFECTIVO',
    'TRANSFERENCIA': 'TRANSFERENCIA',
    'MIXTO': 'MIXTO',
  };
  return MAP[upper] || null;
}

/**
 * Crear una nueva venta
 * POST /api/ventas
 */
exports.createVenta = async (req, res) => {
  let connection;

  try {
    const {
      cliente_id,
      cliente_nombre,
      cliente_telefono,
      cliente_email,
      cliente_nit,
      cliente_direccion,
      cotizacion_id,
      numero_cotizacion,
      tipo_venta,
      items,
      subtotal,
      impuestos,
      descuento,
      total,
      metodo_pago,
      pagos,
      monto_pagado,
      observaciones,
      notas_internas,
      created_by,
      interes_tarjeta,
    } = req.body;

    const telefonoValidado = validatePhone(cliente_telefono, {
      label: 'El teléfono del cliente',
    });

    if (!telefonoValidado.ok) {
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const clienteTelefonoNormalizado = telefonoValidado.value;

    const empresaId = requireTenantEmpresaId(req);

    if (!cliente_id || !cliente_nombre) {
      return res.status(400).json({
        error: 'Cliente es requerido',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'La venta debe tener al menos un item',
      });
    }

    if (!total || Number(total) <= 0) {
      return res.status(400).json({
        error: 'El total debe ser mayor a 0',
      });
    }

    if (!metodo_pago) {
      return res.status(400).json({
        error: 'El método de pago es requerido',
      });
    }

    const metodoPagoNorm = normalizeMetodoPago(metodo_pago);

    if (!metodoPagoNorm) {
      return res.status(400).json({
        error: `Método de pago inválido: "${metodo_pago}". Valores permitidos: ${VALID_METODOS_PAGO.join(', ')}`,
      });
    }

    let pagosNormalizados = null;

    if (pagos && Array.isArray(pagos)) {
      pagosNormalizados = [];

      for (const pago of pagos) {
        const metodoPagoIndividual = normalizeMetodoPago(pago.metodo);

        if (!metodoPagoIndividual) {
          return res.status(400).json({
            error: `Método de pago inválido en pago: "${pago.metodo}"`,
          });
        }

        pagosNormalizados.push({
          ...pago,
          metodo: metodoPagoIndividual,
        });
      }
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    if (cliente_id && !isSuperadminTenant(req)) {
      const [clientes] = await connection.query(
        `SELECT id
         FROM clientes
         WHERE id = ?
           AND empresa_id = ?
           AND activo = true
         LIMIT 1`,
        [cliente_id, empresaId]
      );

      if (clientes.length === 0) {
        const error = new Error('Cliente no encontrado');
        error.statusCode = 404;
        throw error;
      }
    }

    const itemsJSON = JSON.stringify(items);
    const pagosJSON = pagosNormalizados
      ? JSON.stringify(pagosNormalizados)
      : null;

    const query = `
      INSERT INTO ventas (
        empresa_id,
        cliente_id,
        cliente_nombre,
        cliente_telefono,
        cliente_email,
        cliente_nit,
        cliente_direccion,
        cotizacion_id,
        numero_cotizacion,
        tipo_venta,
        items,
        subtotal,
        impuestos,
        descuento,
        interes_tarjeta,
        total,
        metodo_pago,
        pagos,
        monto_pagado,
        observaciones,
        notas_internas,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.query(query, [
      empresaId,
      cliente_id,
      cliente_nombre,
      clienteTelefonoNormalizado,
      cliente_email || null,
      cliente_nit || null,
      cliente_direccion || null,
      cotizacion_id || null,
      numero_cotizacion || null,
      tipo_venta || 'PRODUCTOS',
      itemsJSON,
      subtotal || 0,
      impuestos || 0,
      descuento || 0,
      interes_tarjeta || 0,
      total,
      metodoPagoNorm,
      pagosJSON,
      monto_pagado || 0,
      observaciones || null,
      notas_internas || null,
      created_by || null,
    ]);

    await descontarStock(
      items,
      empresaId,
      connection
    );

    if (metodoPagoNorm && Number(total) > 0) {
      if (pagosNormalizados) {
        for (const pago of pagosNormalizados) {
          await cajaController.registrarMovimientoVenta(
            result.insertId,
            pago.metodo,
            pago.monto,
            created_by || 'Sistema',
            connection,
            pago.pos_seleccionado || null,
            pago.banco_id || null,
            pago.referencia || null,
            empresaId
          );
        }
      } else {
        await cajaController.registrarMovimientoVenta(
          result.insertId,
          metodoPagoNorm,
          total,
          created_by || 'Sistema',
          connection,
          null,
          null,
          null,
          empresaId
        );
      }
    }

    const [newVenta] = await connection.query(
      `SELECT *
       FROM ventas
       WHERE id = ?
         AND empresa_id = ?
       LIMIT 1`,
      [result.insertId, empresaId]
    );

    const venta = parseVentaJSON(newVenta[0]);

    await connection.commit();

    await auditoriaService.registrar({
      req,
      empresaId,
      accion: 'CREAR',
      entidad: 'VENTA',
      entidadId: result.insertId,
      descripcion: `Venta ${result.insertId} creada para ${cliente_nombre}`,
      datosNuevos: { ...req.body, id: result.insertId },
    });
    return res.status(201).json(venta);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Error al revertir creación de venta:',
          rollbackError
        );
      }
    }

    console.error('Error al crear venta:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
      });
    }

    if (
      error.code === 'ER_WARN_DATA_TRUNCATED' ||
      error.code === 'ER_BAD_NULL_ERROR' ||
      error.errno === 1292 ||
      error.errno === 1265
    ) {
      return res.status(400).json({
        error: 'Valor inválido para la base de datos. Puede que el ENUM de metodo_pago necesite migración.',
        details: error.message,
        migration_hint: 'Ejecute: ALTER TABLE ventas MODIFY COLUMN metodo_pago ENUM(\'EFECTIVO\',\'TARJETA\',\'TARJETA_BAC\',\'TARJETA_NEONET\',\'TARJETA_OTRA\',\'TRANSFERENCIA\',\'MIXTO\') DEFAULT NULL;',
      });
    }

    return res.status(500).json({
      error: 'Error al crear la venta',
      details: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};


/**
 * Convertir cotización a venta
 * POST /api/ventas/from-quote/:cotizacionId
 */
exports.createVentaFromQuote = async (req, res) => {
  let connection;

  try {
    const cotizacionId = req.params.cotizacionId || req.params.id;
    const { pagos, metodo_pago, observaciones, created_by } = req.body || {};
    const empresaId = requireTenantEmpresaId(req);

    const metodoPagoNorm = normalizeMetodoPago(metodo_pago);
    if (metodo_pago && !metodoPagoNorm) {
      return res.status(400).json({
        error: 'Metodo de pago invalido: "' + metodo_pago + '". Valores permitidos: ' + VALID_METODOS_PAGO.join(', ')
      });
    }

    if (pagos && Array.isArray(pagos)) {
      for (const pago of pagos) {
        if (!normalizeMetodoPago(pago.metodo)) {
          return res.status(400).json({
            error: 'Metodo de pago invalido en pago: "' + pago.metodo + '"'
          });
        }
      }
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const cotizacionTenant = ventaTenantClause(req, 'c');
    const [cotizaciones] = await connection.query(
      'SELECT c.* FROM cotizaciones c WHERE c.id = ?' + cotizacionTenant.sql + ' FOR UPDATE',
      [cotizacionId, ...cotizacionTenant.params]
    );

    if (cotizaciones.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Cotizacion no encontrada' });
    }

    const cotizacion = cotizaciones[0];

    if (cotizacion.tipo !== 'VENTA') {
      await connection.rollback();
      return res.status(400).json({ error: 'Solo se pueden convertir cotizaciones de tipo VENTA' });
    }

    if (['CONVERTIDA', 'RECHAZADA', 'VENCIDA'].includes(cotizacion.estado)) {
      await connection.rollback();
      return res.status(400).json({ error: 'La cotizacion no esta disponible para convertir a venta' });
    }

    if (Number(cotizacion.convertida || 0) === 1 || cotizacion.referencia_venta_id) {
      await connection.rollback();
      return res.status(400).json({ error: 'Esta cotizacion ya fue convertida a venta' });
    }

    const ventaTenant = ventaTenantClause(req, 'v');
    const [ventasExistentes] = await connection.query(
      "SELECT v.id FROM ventas v WHERE v.cotizacion_id = ? AND v.estado <> 'ANULADA'" + ventaTenant.sql + ' LIMIT 1',
      [cotizacionId, ...ventaTenant.params]
    );

    if (ventasExistentes.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Esta cotizacion ya tiene una venta asociada' });
    }

    if (cotizacion.cliente_id && !isSuperadminTenant(req)) {
      const [clientes] = await connection.query(
        'SELECT id FROM clientes WHERE id = ? AND empresa_id = ? AND activo = true LIMIT 1',
        [cotizacion.cliente_id, empresaId]
      );

      if (clientes.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
    }

    const rawItems = typeof cotizacion.items === 'string'
      ? JSON.parse(cotizacion.items)
      : cotizacion.items;
    const items = Array.isArray(rawItems) ? rawItems : [];

    if (items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'La cotizacion no tiene items para convertir' });
    }

    const itemsParaVenta = items.map((item) => {
      const precioUnit = Number(item.precioUnit ?? item.precio_unitario ?? item.precioUnitario ?? item.precio ?? 0);
      const subtotal = Number(item.subtotal ?? (Number(item.cantidad || 0) * precioUnit));
      return {
        id: item.id,
        source: item.source,
        refId: item.refId ?? item.ref_id,
        nombre: item.nombre,
        cantidad: Number(item.cantidad || 0),
        precioUnit: Math.round(precioUnit * 100),
        subtotal: Math.round(subtotal * 100),
        notas: item.notas,
        aplicarImpuestos: item.aplicarImpuestos,
      };
    });

    const hasProductos = itemsParaVenta.some(item => item.source === 'PRODUCTO');
    const hasRepuestos = itemsParaVenta.some(item => item.source === 'REPUESTO');

    let tipo_venta = 'PRODUCTOS';
    if (hasProductos && hasRepuestos) {
      tipo_venta = 'MIXTA';
    } else if (hasRepuestos && !hasProductos) {
      tipo_venta = 'REPUESTOS';
    }

    const subtotalCentavos = Math.round(Number(cotizacion.subtotal || 0) * 100);
    const impuestosCentavos = Math.round(Number(cotizacion.impuestos || 0) * 100);
    const totalCentavos = Math.round(Number(cotizacion.total || 0) * 100);
    const pagosJSON = pagos ? JSON.stringify(pagos) : null;
    const itemsJSON = JSON.stringify(itemsParaVenta);
    const montoPagadoCentavos = pagos && Array.isArray(pagos)
      ? pagos.reduce((sum, pago) => sum + Number(pago.monto || 0), 0)
      : 0;

    const query = `
      INSERT INTO ventas (
        empresa_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email,
        cliente_nit, cliente_direccion, cotizacion_id, numero_cotizacion,
        tipo_venta, items, subtotal, impuestos, descuento, total,
        metodo_pago, pagos, monto_pagado, observaciones, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.query(query, [
      empresaId,
      cotizacion.cliente_id,
      cotizacion.cliente_nombre,
      cotizacion.cliente_telefono,
      cotizacion.cliente_email,
      cotizacion.cliente_nit,
      cotizacion.cliente_direccion,
      cotizacionId,
      cotizacion.numero_cotizacion,
      tipo_venta,
      itemsJSON,
      subtotalCentavos,
      impuestosCentavos,
      0,
      totalCentavos,
      metodoPagoNorm || null,
      pagosJSON,
      montoPagadoCentavos,
      observaciones || cotizacion.observaciones,
      created_by || req.user?.id || null
    ]);

    await connection.query(
      "UPDATE cotizaciones c SET estado = 'CONVERTIDA', convertida = 1, convertida_a = 'VENTA', referencia_venta_id = ?, fecha_conversion = NOW() WHERE c.id = ?" + cotizacionTenant.sql,
      [result.insertId, cotizacionId, ...cotizacionTenant.params]
    );

    await descontarStock(itemsParaVenta, empresaId, connection);

    if (metodo_pago && totalCentavos > 0) {
      if (pagos && Array.isArray(pagos)) {
        for (const pago of pagos) {
          await cajaController.registrarMovimientoVenta(
            result.insertId,
            pago.metodo,
            pago.monto,
            created_by || req.user?.username || req.user?.name || 'Sistema',
            connection,
            pago.pos_seleccionado || null,
            pago.banco_id || null,
            pago.referencia || null,
            empresaId
          );
        }
      } else {
        await cajaController.registrarMovimientoVenta(
          result.insertId,
          metodo_pago,
          totalCentavos,
          created_by || req.user?.username || req.user?.name || 'Sistema',
          connection,
          null,
          null,
          null,
          empresaId
        );
      }
    }

    const [newVenta] = await connection.query(
      'SELECT * FROM ventas WHERE id = ? AND empresa_id = ? LIMIT 1',
      [result.insertId, empresaId]
    );
    const venta = parseVentaJSON(newVenta[0]);

    await connection.commit();
    await auditoriaService.registrar({
      req,
      empresaId,
      accion: 'CREAR',
      entidad: 'VENTA',
      entidadId: venta.id,
      descripcion: `Venta ${venta.id} creada desde cotización ${cotizacionId}`,
      datosNuevos: venta,
    });
    res.status(201).json(venta);
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackErr) { console.error('Error al revertir conversion de cotizacion:', rollbackErr); }
    }

    console.error('Error al convertir cotizacion a venta:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.code === 'ER_WARN_DATA_TRUNCATED' || error.errno === 1292 || error.errno === 1265) {
      return res.status(400).json({
        error: 'Valor invalido para la DB. El ENUM de metodo_pago necesita migracion.',
        details: error.message,
        migration_hint: "ALTER TABLE ventas MODIFY COLUMN metodo_pago ENUM('EFECTIVO','TARJETA','TARJETA_BAC','TARJETA_NEONET','TARJETA_OTRA','TRANSFERENCIA','MIXTO') DEFAULT NULL;"
      });
    }
    res.status(500).json({
      error: 'Error al convertir cotizacion a venta',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Obtener todas las ventas con filtros
 * GET /api/ventas
 */
exports.getAllVentas = async (req, res) => {
  try {
    const {
      estado, tipo_venta, cliente_id, metodo_pago, search,
      fecha_desde, fecha_hasta,
      page = 1, limit = 1000
    } = req.query;

    let query = `SELECT v.*, u.name as vendedor_nombre
      FROM ventas v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE 1=1`;
    const tenant = ventaTenantClause(req, 'v');
    const params = [...tenant.params];
    query += tenant.sql;

    // Filtros
    if (estado) {
      query += ' AND v.estado = ?';
      params.push(estado);
    }

    if (tipo_venta) {
      query += ' AND v.tipo_venta = ?';
      params.push(tipo_venta);
    }

    if (cliente_id) {
      query += ' AND v.cliente_id = ?';
      params.push(cliente_id);
    }

    if (metodo_pago) {
      query += ' AND v.metodo_pago = ?';
      params.push(metodo_pago);
    }

    if (search) {
      query += ' AND (v.cliente_nombre LIKE ? OR v.numero_venta LIKE ? OR v.cliente_telefono LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (fecha_desde) {
      query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) >= ?';
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) <= ?';
      params.push(fecha_hasta);
    }

    // Ordenar por fecha más reciente
    query += ' ORDER BY COALESCE(v.fecha_venta, v.created_at) DESC';

    // Paginación segura
    const { limit: limitNum, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    query += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [ventas] = await db.query(query, params);
    const ventasParsed = ventas.map(parseVentaJSON);

    res.json(ventasParsed);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ 
      error: 'Error al obtener ventas',
      details: error.message 
    });
  }
};

/**
 * Obtener una venta por ID
 * GET /api/ventas/:id
 */
exports.getVentaById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = ventaTenantClause(req);

    const [ventas] = await db.query(
      `SELECT * FROM ventas v WHERE v.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const venta = parseVentaJSON(ventas[0]);
    res.json(venta);
  } catch (error) {
    console.error('Error al obtener venta:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ 
      error: 'Error al obtener venta',
      details: error.message 
    });
  }
};

/**
 * Registrar pago en una venta
 * POST /api/ventas/:id/pagos
 */
exports.registrarPago = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, metodo, referencia, comprobanteUrl, usuario_id } = req.body;
    const tenant = ventaTenantClause(req);
    const empresaId = requireTenantEmpresaId(req);

    const metodoNormalizado = String(metodo || '').trim().toUpperCase();
    const comprobanteNormalizado =
      typeof comprobanteUrl === 'string'
        ? comprobanteUrl.trim()
        : '';

    if (
      metodoNormalizado === 'TRANSFERENCIA' &&
      !comprobanteNormalizado
    ) {
      return res.status(400).json({
        error: 'Debes adjuntar la imagen de la boleta de transferencia',
      });
    }

    if (
      comprobanteNormalizado &&
      !comprobanteNormalizado.startsWith(
        `/uploads/ventas/${empresaId}/comprobantes/`
      )
    ) {
      return res.status(400).json({
        error: 'La ruta del comprobante no es válida',
      });
    }

    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    if (!metodo) {
      return res.status(400).json({ error: 'El método de pago es requerido' });
    }

    // Obtener venta actual
    const [ventasRows] = await db.query(
      `SELECT * FROM ventas v WHERE v.id = ? AND v.estado != "ANULADA"${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (ventasRows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada o ya está anulada' });
    }
    const ventaActual = ventasRows[0];

    // Convertir monto a centavos (si viene en quetzales)
    const montoCentavos = Math.round(parseFloat(monto) * 100);

    // Validar que no exceda el saldo
    const saldoPendiente = ventaActual.total - ventaActual.monto_pagado;
    if (montoCentavos > saldoPendiente) {
      return res.status(400).json({ 
        error: `El monto (Q${(montoCentavos/100).toFixed(2)}) excede el saldo pendiente (Q${(saldoPendiente/100).toFixed(2)})` 
      });
    }

    // Agregar pago al array
    const pagosActuales = ventaActual.pagos
      ? (typeof ventaActual.pagos === 'string' ? JSON.parse(ventaActual.pagos) : ventaActual.pagos)
      : [];

    pagosActuales.push({
      metodo: metodoNormalizado,
      monto: montoCentavos,
      referencia: referencia || null,
      comprobanteUrl: comprobanteNormalizado || null,
      fecha: new Date().toISOString(),
      usuario_id: usuario_id || null
    });

    const nuevoMontoPagado = ventaActual.monto_pagado + montoCentavos;
    const metodoFinal =
      pagosActuales.length > 1
        ? 'MIXTO'
        : metodoNormalizado;

    await db.query(
      `UPDATE ventas SET pagos = ?, monto_pagado = ?, metodo_pago = ?, updated_by = ? WHERE id = ?${ventaTenantClause(req, 'ventas').sql}`,
      [JSON.stringify(pagosActuales), nuevoMontoPagado, metodoFinal, usuario_id || null, id, ...ventaTenantClause(req, 'ventas').params]
    );

    // Registrar en caja/bancos
    try {
      await cajaController.registrarMovimientoVenta(
        Number(id),
        metodoNormalizado,
        montoCentavos,
        usuario_id || 'Sistema',
        null,
        null,
        null,
        referencia || null,
        empresaId
      );
    } catch (cajaErr) {
      console.error('Error al registrar en caja (no crítico):', cajaErr);
    }

    // Obtener venta actualizada
    const [ventasUpdated] = await db.query(
      `SELECT * FROM ventas v WHERE v.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );
    const venta = parseVentaJSON(ventasUpdated[0]);

    await auditoriaService.registrar({
      req,
      empresaId,
      accion: 'REGISTRAR_PAGO',
      entidad: 'VENTA',
      entidadId: id,
      descripcion: `Pago registrado en venta ${id}`,
      datosAnteriores: { monto_pagado: ventaActual.monto_pagado },
      datosNuevos: { monto, metodo: metodoNormalizado, referencia, comprobanteUrl },
    });
    res.json(venta);
  } catch (error) {
    console.error('Error al registrar pago:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ 
      error: 'Error al registrar pago',
      details: error.message 
    });
  }
};

/**
 * Anular una venta
 * POST /api/ventas/:id/anular
 */
exports.anularVenta = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;
    const { motivo, usuario_id } = req.body;
    const tenant = ventaTenantClause(req);
    const empresaId = requireTenantEmpresaId(req);

    if (!motivo) {
      return res.status(400).json({
        error: 'El motivo de anulación es requerido',
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Verificar que la venta existe y no está ya anulada
    const [ventasRows] = await connection.query(
      `SELECT * FROM ventas v WHERE v.id = ?${tenant.sql} LIMIT 1`,
      [id, ...tenant.params]
    );

    if (ventasRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        error: 'Venta no encontrada',
      });
    }

    const ventaActual = ventasRows[0];

    if (ventaActual.estado === 'ANULADA') {
      await connection.rollback();

      return res.status(400).json({
        error: 'La venta ya está anulada',
      });
    }

    // Agregar nota de anulación
    const fechaAnulacion = new Date().toISOString();
    const notasActuales = ventaActual.notas_internas || '';

    const nuevasNotas = notasActuales
      ? `${notasActuales}\nANULADA: ${motivo} - ${fechaAnulacion}`
      : `ANULADA: ${motivo} - ${fechaAnulacion}`;

    await connection.query(
      `UPDATE ventas 
       SET estado = 'ANULADA',
           notas_internas = ?,
           updated_by = ?
       WHERE id = ?${ventaTenantClause(req, 'ventas').sql}`,
      [nuevasNotas, usuario_id || null, id, ...ventaTenantClause(req, 'ventas').params]
    );

    // Revertir cotización si existía
    if (ventaActual.cotizacion_id) {
      const cotizacionTenant = ventaTenantClause(req, 'cotizaciones');
      await connection.query(
        `UPDATE cotizaciones 
         SET estado = 'ENVIADA',
             convertida_a = NULL,
             referencia_venta_id = NULL,
             fecha_conversion = NULL
         WHERE id = ?${cotizacionTenant.sql}`,
        [ventaActual.cotizacion_id, ...cotizacionTenant.params]
      );
    }

    /*
      Reversa financiera:
      - Si la venta fue efectivo, crea EGRESO en caja_chica.
      - Si la venta fue tarjeta/transferencia, crea EGRESO en movimientos_bancarios.
      - No borra el movimiento original.
      - Evita duplicar reversas si ya existe una.
    */
    const usuarioNombre =
      req.user?.username ||
      req.user?.name ||
      req.user?.nombre ||
      req.body?.usuario_nombre ||
      req.body?.usuario ||
      usuario_id ||
      'Sistema';

    await cajaController.registrarReversaMovimientoVenta(
      ventaActual,
      usuarioNombre,
      connection,
      empresaId
    );

    // Obtener venta actualizada
    const [ventasUpdated] = await connection.query(
      `SELECT * FROM ventas v WHERE v.id = ?${tenant.sql} LIMIT 1`,
      [id, ...tenant.params]
    );

    await connection.commit();

    const venta = parseVentaJSON(ventasUpdated[0]);

    await auditoriaService.registrar({
      req,
      empresaId,
      accion: 'ANULAR',
      entidad: 'VENTA',
      entidadId: id,
      descripcion: `Venta ${id} anulada`,
      datosAnteriores: ventaActual,
      datosNuevos: { estado: 'ANULADA', motivo },
    });
    res.json(venta);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error haciendo rollback al anular venta:', rollbackError);
      }
    }

    console.error('Error al anular venta:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error al anular venta',
      details: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
/**
 * Obtener estadísticas de ventas
 * GET /api/ventas/estadisticas
 */
exports.getEstadisticas = async (req, res) => {
  try {
    const tenant = ventaTenantClause(req, 'v');
    const [stats] = await db.query(
      `SELECT
        COUNT(*) as total_ventas,
        SUM(CASE WHEN v.estado = 'PAGADA' THEN 1 ELSE 0 END) as ventas_pagadas,
        SUM(CASE WHEN v.estado = 'PENDIENTE' THEN 1 ELSE 0 END) as ventas_pendientes,
        SUM(CASE WHEN v.estado = 'PARCIAL' THEN 1 ELSE 0 END) as ventas_parciales,
        SUM(CASE WHEN v.estado = 'ANULADA' THEN 1 ELSE 0 END) as ventas_anuladas,
        COALESCE(SUM(CASE WHEN v.estado != 'ANULADA' THEN v.total ELSE 0 END), 0) as total_ingresos,
        COALESCE(AVG(CASE WHEN v.estado != 'ANULADA' THEN v.total END), 0) as promedio_venta,
        SUM(CASE WHEN DATE(v.fecha_venta) = CURDATE() THEN 1 ELSE 0 END) as ventas_hoy,
        COALESCE(SUM(CASE WHEN DATE(v.fecha_venta) = CURDATE() AND v.estado != 'ANULADA' THEN v.total ELSE 0 END), 0) as ingresos_hoy,
        SUM(CASE WHEN MONTH(v.fecha_venta) = MONTH(CURDATE()) AND YEAR(v.fecha_venta) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as ventas_mes_actual,
        COALESCE(SUM(CASE WHEN MONTH(v.fecha_venta) = MONTH(CURDATE()) AND YEAR(v.fecha_venta) = YEAR(CURDATE()) AND v.estado != 'ANULADA' THEN v.total ELSE 0 END), 0) as ingresos_mes_actual
       FROM ventas v
       WHERE 1=1${tenant.sql}`,
      tenant.params
    );
    res.json(stats[0] || {});
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ 
      error: 'Error al obtener estadísticas',
      details: error.message 
    });
  }
};

/**
 * Helper: Descontar stock del inventario
 */
async function descontarStock(items, empresaId, client = db) {
  for (const item of items) {
    const itemId = item.refId || item.ref_id || item.id;
    const cantidad = Number(item.cantidad);
    const source = String(item.source || item.tipo || '').toUpperCase();

    if (!itemId) {
      const error = new Error('Uno de los artículos no tiene identificador de inventario');
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      const error = new Error('La cantidad de cada artículo debe ser un número entero mayor a cero');
      error.statusCode = 400;
      throw error;
    }

    if (source === 'PRODUCTO' || source === 'PRODUCTOS') {
      const [result] = await client.query(
        `UPDATE productos
         SET stock = stock - ?
         WHERE id = ?
           AND empresa_id = ?
           AND stock >= ?`,
        [cantidad, itemId, empresaId, cantidad]
      );

      if (result.affectedRows === 0) {
        const [productos] = await client.query(
          'SELECT id, nombre, stock FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1',
          [itemId, empresaId]
        );

        if (productos.length === 0) {
          const error = new Error(`Producto ${itemId} no encontrado para esta empresa`);
          error.statusCode = 404;
          throw error;
        }

        const producto = productos[0];
        const error = new Error(
          `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}, solicitado: ${cantidad}`
        );
        error.statusCode = 409;
        throw error;
      }

      console.log(`Stock descontado: Producto ${itemId}, cantidad: ${cantidad}`);
      continue;
    }

    if (source === 'REPUESTO' || source === 'REPUESTOS') {
      const [result] = await client.query(
        `UPDATE repuestos
         SET stock = stock - ?
         WHERE id = ?
           AND empresa_id = ?
           AND stock >= ?`,
        [cantidad, itemId, empresaId, cantidad]
      );

      if (result.affectedRows === 0) {
        const [repuestos] = await client.query(
          'SELECT id, nombre, stock FROM repuestos WHERE id = ? AND empresa_id = ? LIMIT 1',
          [itemId, empresaId]
        );

        if (repuestos.length === 0) {
          const error = new Error(`Repuesto ${itemId} no encontrado para esta empresa`);
          error.statusCode = 404;
          throw error;
        }

        const repuesto = repuestos[0];
        const error = new Error(
          `Stock insuficiente para "${repuesto.nombre}". Disponible: ${repuesto.stock}, solicitado: ${cantidad}`
        );
        error.statusCode = 409;
        throw error;
      }

      console.log(`Stock descontado: Repuesto ${itemId}, cantidad: ${cantidad}`);
      continue;
    }

    const error = new Error(`Tipo de artículo inválido: "${source || 'SIN TIPO'}"`);
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Helper: Parsear campos JSON de una venta
 */
function parseVentaJSON(venta) {
  if (!venta) return null;

  // Parsear items y normalizar estructura
  let items = [];
  if (venta.items) {
    const parsedItems = typeof venta.items === 'string' ? JSON.parse(venta.items) : venta.items;
    items = parsedItems.map(item => {
      // Normalizar nombres de campos (soportar variaciones)
      const precioUnit = item.precioUnit || item.precio || item.precioUnitario || 0;
      const subtotal = item.subtotal || (item.cantidad * precioUnit) || 0;
      
      return {
        id: item.id,
        source: item.source,
        refId: item.refId,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnit: precioUnit,
        subtotal: subtotal,
        notas: item.notas
      };
    });
  }

  // Parsear pagos y normalizar nombres históricos del comprobante
  let pagos = [];
  if (venta.pagos) {
    const pagosRaw =
      typeof venta.pagos === 'string'
        ? JSON.parse(venta.pagos)
        : venta.pagos;

    pagos = Array.isArray(pagosRaw)
      ? pagosRaw.map(pago => ({
          ...pago,
          comprobanteUrl:
            pago.comprobanteUrl ||
            pago.comprobante_url ||
            null,
        }))
      : [];
  }

  return {
    ...venta,
    items: items,
    pagos: pagos
  };
}

module.exports = exports;
