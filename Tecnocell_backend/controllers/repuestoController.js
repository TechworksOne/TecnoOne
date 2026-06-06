const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');
const REPUESTOS_UPLOAD_DIR = path.join(UPLOADS_BASE, 'repuestos');

if (!fs.existsSync(REPUESTOS_UPLOAD_DIR)) {
  fs.mkdirSync(REPUESTOS_UPLOAD_DIR, { recursive: true });
}

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? 1;
}

function repuestoTenantClause(req, alias = 'r') {
  return isSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [getTenantEmpresaId(req)] };
}

const storageRepuestos = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, REPUESTOS_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
    const safeExt = allowedExt.includes(ext) ? ext : '.jpg';

    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 40);

    const filename = `repuesto_${Date.now()}_${Math.round(Math.random() * 1e9)}_${baseName}${safeExt}`;

    cb(null, filename);
  },
});

const fileFilterRepuestos = (_req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'), false);
  }

  cb(null, true);
};

const uploadRepuestos = multer({
  storage: storageRepuestos,
  fileFilter: fileFilterRepuestos,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
});

exports.uploadRepuestos = uploadRepuestos.array('imagenes', 10);

function safeJsonArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return [];

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function safeJsonStringArray(value) {
  return JSON.stringify(safeJsonArray(value));
}

function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;

  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') return value === 1;

  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'sí') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }

  return defaultValue;
}

function toNumber(value, defaultValue = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function obtenerImagenesRepuesto(req) {
  const imagenesExistentes = safeJsonArray(req.body.imagenes);

  const imagenesSubidas = (req.files || []).map((file) => {
    return `/uploads/repuestos/${file.filename}`;
  });

  return [...imagenesExistentes, ...imagenesSubidas];
}

/**
 * Crear un nuevo repuesto
 * POST /api/repuestos
 */
exports.createRepuesto = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      codigo,
      nombre,
      tipo,
      marca,
      linea,
      modelo,
      compatibilidad,
      condicion,
      color,
      notas,
      precio_publico,
      precio_costo,
      proveedor,
      stock,
      stock_minimo,
      tags,
      activo,
    } = req.body;
    const empresaId = getTenantEmpresaId(req);

    if (!nombre || !tipo || !marca) {
      await connection.rollback();

      return res.status(400).json({
        error: 'Nombre, tipo y marca son requeridos',
      });
    }

    const tipoAbrev = String(tipo).substring(0, 3).toUpperCase();
    const marcaAbrev = String(marca).substring(0, 4).toUpperCase();
    const modeloAbrev = modelo
      ? String(modelo).substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')
      : 'GEN';

    const timestamp = Date.now().toString().slice(-6);

    const skuFinal = `${tipoAbrev}_${marcaAbrev}_${modeloAbrev}_${timestamp}`;
    const skuGenerado = true;

    console.log('✅ SKU de repuesto generado automáticamente:', skuFinal);

    const compatibilidadJSON = safeJsonStringArray(compatibilidad);
    const imagenesFinales = obtenerImagenesRepuesto(req);
    const imagenesJSON = JSON.stringify(imagenesFinales);
    const tagsJSON = safeJsonStringArray(tags);

    const query = `
      INSERT INTO repuestos (
        empresa_id, sku, codigo, nombre, tipo, marca, linea, modelo, compatibilidad, condicion,
        color, notas, precio_publico, precio_costo, proveedor,
        stock, stock_minimo, imagenes, tags, activo, sku_generado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.query(query, [
      empresaId,
      skuFinal,
      codigo || null,
      nombre,
      tipo,
      marca,
      linea || null,
      modelo || null,
      compatibilidadJSON,
      condicion || 'Original',
      color || null,
      notas || null,
      toNumber(precio_publico, 0),
      toNumber(precio_costo, 0),
      proveedor || null,
      toNumber(stock, 0),
      toNumber(stock_minimo, 1),
      imagenesJSON,
      tagsJSON,
      parseBoolean(activo, true) ? 1 : 0,
      skuGenerado,
    ]);

    const [newRepuesto] = await connection.query(
      'SELECT * FROM repuestos WHERE id = ? AND empresa_id = ?',
      [result.insertId, empresaId]
    );

    await connection.commit();

    const repuesto = parseRepuestoJSON(newRepuesto[0]);

    res.status(201).json(repuesto);
  } catch (error) {
    await connection.rollback();

    console.error('Error al crear repuesto:', error);

    res.status(500).json({
      error: 'Error al crear el repuesto',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtener todos los repuestos con filtros opcionales
 * GET /api/repuestos
 */
exports.getAllRepuestos = async (req, res) => {
  try {
    const {
      tipo,
      marca,
      linea,
      activo,
      soloConStock,
      precioMin,
      precioMax,
      searchTerm,
      page = 1,
      limit = 100,
    } = req.query;

    let query = 'SELECT * FROM repuestos r WHERE 1=1';
    const params = [];
    const tenant = repuestoTenantClause(req, 'r');

    query += tenant.sql;
    params.push(...tenant.params);

    if (tipo) {
      query += ' AND tipo = ?';
      params.push(tipo);
    }

    if (marca) {
      query += ' AND marca = ?';
      params.push(marca);
    }

    if (linea) {
      query += ' AND linea = ?';
      params.push(linea);
    }

    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo === 'true' || activo === true ? 1 : 0);
    }

    if (soloConStock === 'true') {
      query += ' AND stock > 0';
    }

    if (precioMin) {
      query += ' AND precio_publico >= ?';
      params.push(parseInt(precioMin));
    }

    if (precioMax) {
      query += ' AND precio_publico <= ?';
      params.push(parseInt(precioMax));
    }

    if (searchTerm) {
      query += ' AND (nombre LIKE ? OR modelo LIKE ? OR linea LIKE ? OR sku LIKE ? OR codigo LIKE ?)';
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY created_at DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [repuestos] = await db.query(query, params);

    const repuestosParsed = repuestos.map((r) => {
      const parsed = parseRepuestoJSON(r);
      return parsed;
    });

    res.json(repuestosParsed);
  } catch (error) {
    console.error('Error al obtener repuestos:', error);

    res.status(500).json({
      error: 'Error al obtener repuestos',
      details: error.message,
    });
  }
};

/**
 * Obtener un repuesto por ID
 * GET /api/repuestos/:id
 */
exports.getRepuestoById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = repuestoTenantClause(req, 'r');

    const [repuestos] = await db.query(
      `SELECT * FROM repuestos r WHERE r.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (repuestos.length === 0) {
      return res.status(404).json({ error: 'Repuesto no encontrado' });
    }

    const repuesto = parseRepuestoJSON(repuestos[0]);

    res.json(repuesto);
  } catch (error) {
    console.error('Error al obtener repuesto:', error);

    res.status(500).json({
      error: 'Error al obtener el repuesto',
      details: error.message,
    });
  }
};

/**
 * Actualizar un repuesto
 * PUT /api/repuestos/:id
 */
exports.updateRepuesto = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const updateData = req.body;
    const tenant = repuestoTenantClause(req, 'r');

    console.log('=== UPDATE REPUESTO ===');
    console.log('ID:', id);
    console.log('Body recibido:', JSON.stringify(updateData, null, 2));
    console.log('Archivos recibidos:', req.files?.length || 0);

    const [existing] = await connection.query(
      `SELECT * FROM repuestos r WHERE r.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (existing.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        error: 'Repuesto no encontrado',
      });
    }

    console.log('Repuesto existente encontrado:', existing[0].nombre);

    const updates = [];
    const values = [];

    if (updateData.nombre !== undefined) {
      updates.push('nombre = ?');
      values.push(updateData.nombre);
    }

    if (updateData.tipo !== undefined) {
      updates.push('tipo = ?');
      values.push(updateData.tipo);
    }

    if (updateData.marca !== undefined) {
      updates.push('marca = ?');
      values.push(updateData.marca);
    }

    if (updateData.linea !== undefined) {
      updates.push('linea = ?');
      values.push(updateData.linea || null);
    }

    if (updateData.modelo !== undefined) {
      updates.push('modelo = ?');
      values.push(updateData.modelo || null);
    }

    if (updateData.compatibilidad !== undefined) {
      updates.push('compatibilidad = ?');
      values.push(safeJsonStringArray(updateData.compatibilidad));
    }

    if (updateData.condicion !== undefined) {
      updates.push('condicion = ?');
      values.push(updateData.condicion || 'Original');
    }

    if (updateData.color !== undefined) {
      updates.push('color = ?');
      values.push(updateData.color || null);
    }

    if (updateData.notas !== undefined) {
      updates.push('notas = ?');
      values.push(updateData.notas || null);
    }

    if (updateData.precio_publico !== undefined) {
      updates.push('precio_publico = ?');
      values.push(toNumber(updateData.precio_publico, 0));
    }

    if (updateData.precio_costo !== undefined) {
      updates.push('precio_costo = ?');
      values.push(toNumber(updateData.precio_costo, 0));
    }

    if (updateData.proveedor !== undefined) {
      updates.push('proveedor = ?');
      values.push(updateData.proveedor || null);
    }

    if (updateData.stock !== undefined) {
      updates.push('stock = ?');
      values.push(toNumber(updateData.stock, 0));
    }

    if (updateData.stock_minimo !== undefined) {
      updates.push('stock_minimo = ?');
      values.push(toNumber(updateData.stock_minimo, 1));
    }

    const hayImagenesEnBody = updateData.imagenes !== undefined;
    const hayArchivos = Array.isArray(req.files) && req.files.length > 0;

    if (hayImagenesEnBody || hayArchivos) {
      const imagenesFinales = obtenerImagenesRepuesto(req);

      updates.push('imagenes = ?');
      values.push(JSON.stringify(imagenesFinales));
    }

    if (updateData.tags !== undefined) {
      updates.push('tags = ?');
      values.push(safeJsonStringArray(updateData.tags));
    }

    if (updateData.activo !== undefined) {
      updates.push('activo = ?');
      values.push(parseBoolean(updateData.activo, true) ? 1 : 0);
    }

    if (updates.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        error: 'No hay campos para actualizar',
      });
    }

    const updateTenant = repuestoTenantClause(req, 'repuestos');
    values.push(id, ...updateTenant.params);

    const query = `UPDATE repuestos SET ${updates.join(', ')} WHERE id = ?${updateTenant.sql}`;

    console.log('Query a ejecutar:', query);
    console.log('Número de campos a actualizar:', updates.length);

    await connection.query(query, values);

    const [updated] = await connection.query(
      `SELECT * FROM repuestos r WHERE r.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    await connection.commit();

    const repuesto = parseRepuestoJSON(updated[0]);

    console.log('Repuesto actualizado exitosamente');
    console.log('======================\n');

    res.json(repuesto);
  } catch (error) {
    await connection.rollback();

    console.error('Error al actualizar repuesto:', error);

    res.status(500).json({
      error: 'Error al actualizar el repuesto',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

/**
 * Eliminar un repuesto
 * DELETE /api/repuestos/:id
 */
exports.deleteRepuesto = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = repuestoTenantClause(req, 'repuestos');

    const [result] = await db.query(
      `DELETE FROM repuestos WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Repuesto no encontrado',
      });
    }

    res.json({
      message: 'Repuesto eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar repuesto:', error);

    res.status(500).json({
      error: 'Error al eliminar el repuesto',
      details: error.message,
    });
  }
};

/**
 * Obtener repuestos con stock bajo
 * GET /api/repuestos/stock-bajo
 */
exports.getStockBajo = async (req, res) => {
  try {
    const tenant = repuestoTenantClause(req, 'r');
    const [repuestos] = await db.query(
      `SELECT *
       FROM repuestos r
       WHERE r.activo = 1${tenant.sql}
         AND r.stock < r.stock_minimo
       ORDER BY (r.stock_minimo - r.stock) DESC, r.stock ASC, r.nombre ASC`,
      tenant.params
    );

    res.json(repuestos);
  } catch (error) {
    console.error('Error al obtener repuestos con stock bajo:', error);

    res.status(500).json({
      error: 'Error al obtener repuestos con stock bajo',
      details: error.message,
    });
  }
};

/**
 * Obtener estadísticas de repuestos
 * GET /api/repuestos/estadisticas
 */
exports.getEstadisticas = async (req, res) => {
  try {
    const tenant = repuestoTenantClause(req, 'r');
    const [estadisticas] = await db.query(`
      SELECT
        r.tipo,
        r.marca,
        COUNT(*) as total_repuestos,
        SUM(r.stock) as stock_total,
        SUM(r.precio_costo * r.stock) / 100 as valor_total_costo,
        SUM(r.precio_publico * r.stock) / 100 as valor_total_publico
      FROM repuestos r
      WHERE r.activo = TRUE${tenant.sql}
      GROUP BY r.tipo, r.marca
      ORDER BY r.tipo ASC, r.marca ASC
    `, tenant.params);

    const totalTenant = repuestoTenantClause(req, 'r');
    const [totales] = await db.query(`
      SELECT
        COUNT(*) as total_repuestos,
        SUM(r.stock) as stock_total,
        SUM(r.precio_costo * r.stock) / 100 as valor_total_costo,
        SUM(r.precio_publico * r.stock) / 100 as valor_total_publico
      FROM repuestos r
      WHERE r.activo = TRUE${totalTenant.sql}
    `, totalTenant.params);

    res.json({
      por_tipo_marca: estadisticas,
      totales: totales[0],
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);

    res.status(500).json({
      error: 'Error al obtener estadísticas',
      details: error.message,
    });
  }
};

/**
 * Registrar movimiento de stock
 * POST /api/repuestos/:id/movimiento
 */
exports.registrarMovimiento = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    const {
      tipo_movimiento,
      cantidad,
      precio_unitario,
      referencia_tipo,
      referencia_id,
      usuario_id,
      notas,
    } = req.body;

    if (!tipo_movimiento || !cantidad) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Tipo de movimiento y cantidad son requeridos',
      });
    }

    const cantidadNumerica = toNumber(cantidad, 0);

    if (cantidadNumerica === 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'La cantidad debe ser diferente de cero',
      });
    }

    const tenant = repuestoTenantClause(req, 'r');
    const [repuestos] = await connection.query(
      `SELECT id, stock FROM repuestos r WHERE r.id = ?${tenant.sql} FOR UPDATE`,
      [id, ...tenant.params]
    );

    if (repuestos.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: 'Repuesto no encontrado',
      });
    }

    const stockAnterior = toNumber(repuestos[0].stock, 0);
    const tipoMovimiento = String(tipo_movimiento).toUpperCase();
    let stockNuevo;

    if (['ENTRADA', 'DEVOLUCION'].includes(tipoMovimiento)) {
      stockNuevo = stockAnterior + Math.abs(cantidadNumerica);
    } else if (['SALIDA', 'VENTA', 'REPARACION'].includes(tipoMovimiento)) {
      stockNuevo = stockAnterior - Math.abs(cantidadNumerica);
    } else if (tipoMovimiento === 'AJUSTE') {
      stockNuevo = stockAnterior + cantidadNumerica;
    } else {
      await connection.rollback();
      return res.status(400).json({
        error: 'Tipo de movimiento no soportado',
      });
    }

    if (stockNuevo < 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Stock insuficiente',
      });
    }

    const updateTenant = repuestoTenantClause(req, 'repuestos');
    await connection.query(
      `UPDATE repuestos SET stock = ? WHERE id = ?${updateTenant.sql}`,
      [stockNuevo, id, ...updateTenant.params]
    );

    await connection.query(
      `INSERT INTO repuestos_movimientos (
        repuesto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
        precio_unitario, referencia_tipo, referencia_id, usuario_id, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tipoMovimiento,
        cantidadNumerica,
        stockAnterior,
        stockNuevo,
        precio_unitario || 0,
        referencia_tipo || 'AJUSTE_MANUAL',
        referencia_id || null,
        usuario_id || req.user?.id || null,
        notas || null,
      ]
    );

    await connection.commit();

    res.json({
      message: 'Movimiento registrado exitosamente',
      resultado: {
        repuesto_id: Number(id),
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al registrar movimiento:', error);

    res.status(500).json({
      error: 'Error al registrar movimiento',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

// ============================================================================
// CATÁLOGOS JERÁRQUICOS DE REPUESTOS
// Tablas: repuesto_tipos → repuesto_marcas → repuesto_modelos
// ============================================================================

/**
 * GET /api/repuestos/tipos
 */
exports.getTiposRepuesto = async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM repuesto_tipos WHERE activo = 1 ORDER BY nombre ASC',
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener tipos de repuesto:', error);
    res.status(500).json({ error: 'Error al obtener tipos de repuesto' });
  }
};

/**
 * POST /api/repuestos/tipos
 */
exports.createTipoRepuesto = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.toString().trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO repuesto_tipos (nombre) VALUES (?)',
      [nombre.toString().trim()],
    );
    const [rows] = await db.query('SELECT * FROM repuesto_tipos WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe un tipo con ese nombre' });
    }
    console.error('Error al crear tipo de repuesto:', error);
    res.status(500).json({ error: 'Error al crear tipo de repuesto' });
  }
};

/**
 * GET /api/repuestos/marcas?tipo_id=ID
 */
exports.getMarcasRepuesto = async (req, res) => {
  const { tipo_id } = req.query;
  if (!tipo_id) {
    return res.status(400).json({ error: 'tipo_id es requerido' });
  }
  try {
    const [rows] = await db.query(
      'SELECT * FROM repuesto_marcas WHERE tipo_id = ? AND activo = 1 ORDER BY nombre ASC',
      [tipo_id],
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener marcas de repuesto:', error);
    res.status(500).json({ error: 'Error al obtener marcas de repuesto' });
  }
};

/**
 * POST /api/repuestos/marcas
 */
exports.createMarcaRepuesto = async (req, res) => {
  const { tipo_id, nombre } = req.body;
  if (!tipo_id || !nombre || !nombre.toString().trim()) {
    return res.status(400).json({ error: 'tipo_id y nombre son requeridos' });
  }
  // Validar que el tipo existe
  const [tipos] = await db.query('SELECT id FROM repuesto_tipos WHERE id = ?', [tipo_id]);
  if (!tipos.length) {
    return res.status(404).json({ error: 'Tipo no encontrado' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO repuesto_marcas (tipo_id, nombre) VALUES (?, ?)',
      [tipo_id, nombre.toString().trim()],
    );
    const [rows] = await db.query('SELECT * FROM repuesto_marcas WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe esa marca para este tipo' });
    }
    console.error('Error al crear marca de repuesto:', error);
    res.status(500).json({ error: 'Error al crear marca de repuesto' });
  }
};

/**
 * GET /api/repuestos/modelos?tipo_id=ID&marca_id=ID
 */
exports.getModelosRepuesto = async (req, res) => {
  const { tipo_id, marca_id } = req.query;
  if (!tipo_id || !marca_id) {
    return res.status(400).json({ error: 'tipo_id y marca_id son requeridos' });
  }
  try {
    const [rows] = await db.query(
      'SELECT * FROM repuesto_modelos WHERE tipo_id = ? AND marca_id = ? AND activo = 1 ORDER BY nombre ASC',
      [tipo_id, marca_id],
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener modelos de repuesto:', error);
    res.status(500).json({ error: 'Error al obtener modelos de repuesto' });
  }
};

/**
 * POST /api/repuestos/modelos
 */
exports.createModeloRepuesto = async (req, res) => {
  const { tipo_id, marca_id, nombre } = req.body;
  if (!tipo_id || !marca_id || !nombre || !nombre.toString().trim()) {
    return res.status(400).json({ error: 'tipo_id, marca_id y nombre son requeridos' });
  }
  // Validar que la marca pertenece al tipo
  const [marcas] = await db.query(
    'SELECT id FROM repuesto_marcas WHERE id = ? AND tipo_id = ?',
    [marca_id, tipo_id],
  );
  if (!marcas.length) {
    return res.status(400).json({ error: 'La marca no pertenece al tipo seleccionado' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO repuesto_modelos (tipo_id, marca_id, nombre) VALUES (?, ?, ?)',
      [tipo_id, marca_id, nombre.toString().trim()],
    );
    const [rows] = await db.query('SELECT * FROM repuesto_modelos WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe ese modelo para este tipo y marca' });
    }
    console.error('Error al crear modelo de repuesto:', error);
    res.status(500).json({ error: 'Error al crear modelo de repuesto' });
  }
};

// Aliases de compatibilidad
exports.getLineasRepuesto = exports.getModelosRepuesto;
exports.createLineaRepuesto = exports.createModeloRepuesto;

/**
 * GET /api/repuestos/:id/movimientos
 * Obtener historial de movimientos de un repuesto
 */
exports.getMovimientosRepuesto = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = repuestoTenantClause(req, 'r');
    const [rows] = await db.query(
      `SELECT rm.*, u.username AS usuario_nombre
       FROM repuestos_movimientos rm
       INNER JOIN repuestos r ON r.id = rm.repuesto_id
       LEFT JOIN users u ON u.id = rm.usuario_id
       WHERE rm.repuesto_id = ?${tenant.sql}
       ORDER BY rm.created_at DESC
       LIMIT 200`,
      [id, ...tenant.params]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener movimientos de repuesto:', error);
    res.status(500).json({ error: 'Error al obtener movimientos', details: error.message });
  }
};

// ============================================================================

/**
 * Helper: Parsear campos JSON de un repuesto
 */
function parseRepuestoJSON(repuesto) {
  if (!repuesto) return null;

  let compatibilidad = [];
  let imagenes = [];
  let tags = [];

  try {
    compatibilidad = repuesto.compatibilidad
      ? typeof repuesto.compatibilidad === 'string'
        ? JSON.parse(repuesto.compatibilidad)
        : repuesto.compatibilidad
      : [];
  } catch {
    compatibilidad = [];
  }

  try {
    imagenes = repuesto.imagenes
      ? typeof repuesto.imagenes === 'string'
        ? JSON.parse(repuesto.imagenes)
        : repuesto.imagenes
      : [];
  } catch {
    imagenes = [];
  }

  try {
    tags = repuesto.tags
      ? typeof repuesto.tags === 'string'
        ? JSON.parse(repuesto.tags)
        : repuesto.tags
      : [];
  } catch {
    tags = [];
  }

  return {
    ...repuesto,
    compatibilidad,
    imagenes,
    tags,
    activo: repuesto.activo === 1 || repuesto.activo === true,
  };
}
