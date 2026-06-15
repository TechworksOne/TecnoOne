const db = require('../config/database');
const { parsePagination, parseLimit } = require('../utils/pagination');
const fs = require('fs');
const path = require('path');

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

function productTenantClause(req, alias = 'p') {
  return isSuperadminTenant(req)
    ? { sql: '', params: [] }
    : { sql: ` AND ${alias}.empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

// Guarda una imagen base64 como archivo físico y retorna la URL relativa
const saveBase64Image = (base64String, productoId, index) => {
  try {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return base64String; // ya es una URL normal
    const mimeType = matches[1];
    const data = matches[2];
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const uploadDir = path.join(__dirname, '..', 'uploads', 'productos', String(productoId));
    fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `img_${index}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), data, 'base64');
    return `/uploads/productos/${productoId}/${filename}`;
  } catch (e) {
    console.error('Error guardando imagen base64:', e);
    return null;
  }
};

// Obtener todos los productos con sus imágenes y paginación
exports.getAllProducts = async (req, res) => {
  try {
    const { categoria, activo, conStock, search } = req.query;
    const { page: pageNum, limit: limitNum, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    
    let query = `
      SELECT 
        p.*,
        GROUP_CONCAT(
          JSON_OBJECT(
            'id', pi.id,
            'url', pi.url,
            'orden', pi.orden,
            'descripcion', pi.descripcion
          )
          ORDER BY pi.orden
        ) as imagenes
      FROM productos p
      LEFT JOIN producto_imagenes pi ON p.id = pi.producto_id
      WHERE 1=1
    `;
    
    let countQuery = 'SELECT COUNT(*) as total FROM productos p WHERE 1=1';
    
    const params = [];
    const countParams = [];
    const tenant = productTenantClause(req, 'p');

    query += tenant.sql;
    countQuery += tenant.sql;
    params.push(...tenant.params);
    countParams.push(...tenant.params);
    
    if (activo !== undefined) {
      query += ' AND p.activo = ?';
      countQuery += ' AND p.activo = ?';
      const activoValue = activo === 'true' || activo === true;
      params.push(activoValue);
      countParams.push(activoValue);
    }
    
    if (categoria) {
      query += ' AND p.categoria = ?';
      countQuery += ' AND p.categoria = ?';
      params.push(categoria);
      countParams.push(categoria);
    }
    
    if (conStock === 'true') {
      query += ' AND p.stock > 0';
      countQuery += ' AND p.stock > 0';
    }
    
    if (search) {
      query += ' AND (p.nombre LIKE ? OR p.sku LIKE ? OR p.descripcion LIKE ?)';
      countQuery += ' AND (p.nombre LIKE ? OR p.sku LIKE ? OR p.descripcion LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    // Obtener total de registros
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;
    
    // Agregar orden, límite y offset
    query += ' GROUP BY p.id ORDER BY p.nombre LIMIT ? OFFSET ?';
    params.push(limitNum, offset);
    
    const [products] = await db.query(query, params);
    
    // Parsear las imágenes de JSON string a array
    const isAdmin = req.user?.roles?.includes('ADMINISTRADOR') || req.user?.role === 'admin';
    const productsWithImages = products.map(p => {
      const product = { ...p, imagenes: p.imagenes ? JSON.parse(`[${p.imagenes}]`) : [] };
      if (!isAdmin) {
        delete product.precio_compra;
        delete product.precioProducto;
        delete product.costo_unitario;
        delete product.margen_ganancia;
        delete product.total_invertido;
      }
      return product;
    });
    
    res.json({
      success: true,
      data: productsWithImages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(error.statusCode || 500).json({ 
      success: false, 
      message: 'Error al obtener productos',
      error: error.message 
    });
  }
};

// Obtener producto por ID con imágenes
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = productTenantClause(req, 'p');

    const [products] = await db.query(
      `SELECT 
        p.*,
        GROUP_CONCAT(
          JSON_OBJECT(
            'id', pi.id,
            'url', pi.url,
            'orden', pi.orden,
            'descripcion', pi.descripcion
          )
          ORDER BY pi.orden
        ) as imagenes
      FROM productos p
      LEFT JOIN producto_imagenes pi ON p.id = pi.producto_id
      WHERE p.id = ?${tenant.sql}
      GROUP BY p.id`,
      [id, ...tenant.params]
    );
    
    if (products.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Producto no encontrado' 
      });
    }
    
    const product = {
      ...products[0],
      imagenes: products[0].imagenes ? JSON.parse(`[${products[0].imagenes}]`) : []
    };

    const isAdmin = req.user?.roles?.includes('ADMINISTRADOR') || req.user?.role === 'admin';
    if (!isAdmin) {
      delete product.precio_compra;
      delete product.precioProducto;
      delete product.costo_unitario;
      delete product.margen_ganancia;
      delete product.total_invertido;
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(error.statusCode || 500).json({ 
      success: false, 
      message: 'Error al obtener producto',
      error: error.message 
    });
  }
};

// Crear nuevo producto con imágenes

const campoProductoVacio = (value) => {
  return value === undefined || value === null || String(value).trim() === '';
};

exports.createProduct = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const {
      sku,
      nombre,
      descripcion,
      categoria,
      subcategoria,
      precio_costo,
      precio_venta,
      stock_minimo = 0,
      aplica_serie = false,
      imagenes = []
    } = req.body;
    const empresaId = requireTenantEmpresaId(req);
    
    // Convertir booleanos a 1 o 0 para la BD
    const aplicaSerieValue = aplica_serie ? 1 : 0;
    const stockMinimoValue = parseInt(stock_minimo) || 0;
    
    // Log para debugging - ANTES de convertir
    console.log('📦 Backend recibió (RAW):', { 
      stock_minimo_raw: stock_minimo,
      stock_minimo_type: typeof stock_minimo,
      aplica_serie_raw: aplica_serie,
      aplica_serie_type: typeof aplica_serie
    });
    
    // Log para debugging - DESPUÉS de convertir
    console.log('📦 Backend convertido:', { 
      categoria, 
      subcategoria, 
      nombre,
      aplica_serie: aplicaSerieValue,
      stock_minimo: stockMinimoValue,
      precio_costo,
      precio_venta
    });
    
    // Validaciones
    if (campoProductoVacio(nombre) || campoProductoVacio(categoria) || campoProductoVacio(precio_costo) || campoProductoVacio(precio_venta)) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan campos requeridos: nombre, categoria, precio_costo, precio_venta' 
      });
    }
    
    if (imagenes.length > 3) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Máximo 3 imágenes permitidas por producto' 
      });
    }
    
    // Generar SKU automático si no se proporciona
    let skuFinal = sku;
    let skuGenerado = false;
    
    if (!sku || sku.trim() === '') {
      // Obtener el último producto para generar SKU único
      const tenant = productTenantClause(req, 'p');
      const [lastProduct] = await connection.query(
        `SELECT id FROM productos p WHERE 1=1${tenant.sql} ORDER BY id DESC LIMIT 1`,
        tenant.params
      );
      
      const nextId = lastProduct.length > 0 ? lastProduct[0].id + 1 : 1;
      
      // Generar SKU: TEC_PROD_{ID}_{TIMESTAMP_CORTO}
      const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos del timestamp
      skuFinal = `TEC_PROD${nextId}_${timestamp}`;
      skuGenerado = true;
      
      console.log('✅ SKU generado automáticamente:', skuFinal);
    }
    
    // Insertar producto con stock = 0 (se cargará desde otra pestaña)
    const [result] = await connection.query(
      `INSERT INTO productos
        (empresa_id, sku, nombre, descripcion, categoria, subcategoria, precio_costo, precio_venta, stock, stock_minimo, aplica_serie, sku_generado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [empresaId, skuFinal, nombre, descripcion, categoria, subcategoria, precio_costo, precio_venta, stockMinimoValue, aplicaSerieValue, skuGenerado]
    );
    
    const productoId = result.insertId;
    
    // Insertar imágenes si existen
    if (imagenes && imagenes.length > 0) {
      for (let i = 0; i < imagenes.length; i++) {
        const imagen = imagenes[i];
        let urlFinal = imagen.url || imagen;
        if (typeof urlFinal === 'string' && urlFinal.startsWith('data:')) {
          urlFinal = saveBase64Image(urlFinal, productoId, i);
        }
        if (urlFinal) {
          await connection.query(
            'INSERT INTO producto_imagenes (producto_id, url, orden, descripcion) VALUES (?, ?, ?, ?)',
            [productoId, urlFinal, i, imagen.descripcion || `Imagen ${i + 1}`]
          );
        }
      }
    }
    
    await connection.commit();
    
    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente con stock inicial de 0',
      data: {
        id: productoId,
        sku: skuFinal,
        sku_generado: skuGenerado,
        nombre,
        stock: 0,
        stock_minimo: stockMinimoValue,
        aplica_serie: aplicaSerieValue
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear producto:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false, 
        message: 'Ya existe un producto con ese SKU' 
      });
    }
    
    res.status(error.statusCode || 500).json({ 
      success: false, 
      message: 'Error al crear producto',
      error: error.message 
    });
  } finally {
    connection.release();
  }
};

// Actualizar producto
exports.updateProduct = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      sku,
      nombre,
      descripcion,
      categoria,
      subcategoria,
      precio_costo,
      precio_venta,
      stock,
      stock_minimo,
      aplica_serie,
      activo,
    } = req.body;

    console.log('🔄 Actualizando producto ID:', id);
    console.log('📦 Body:', req.body);
    console.log('📎 Archivos:', req.files?.length || 0);

    // ── Normalizar imagenes ───────────────────────────────────────────────
    // Puede llegar como:
    //   - undefined          → no tocar imágenes actuales
    //   - array JS           → usar directamente (JSON body con base64)
    //   - string JSON        → parsear (FormData con JSON serializado)
    //   - string simple      → base64 o URL sin wrapper de objeto
    // Los archivos multer (req.files) tienen prioridad si están presentes.
    const tenant = productTenantClause(req, 'p');
    const [existingProducts] = await connection.query(
      `SELECT id FROM productos p WHERE p.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (existingProducts.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado',
      });
    }

    let imagenesArr;

    if (req.files && req.files.length > 0) {
      // FormData con archivos reales: construir rutas relativas
      imagenesArr = req.files.map((f, i) => ({
        url: `/uploads/productos/${id}/${f.filename}`,
        orden: i,
        descripcion: `Imagen ${i + 1}`,
      }));
    } else if (req.body.imagenes !== undefined) {
      if (Array.isArray(req.body.imagenes)) {
        imagenesArr = req.body.imagenes;
      } else if (typeof req.body.imagenes === 'string') {
        try {
          const parsed = JSON.parse(req.body.imagenes);
          imagenesArr = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          // String simple (base64 o URL)
          imagenesArr = [{ url: req.body.imagenes }];
        }
      }
    }
    // Si imagenesArr sigue undefined → no se tocan las imágenes actuales

    const updates = [];
    const values = [];

    if (sku !== undefined) { updates.push('sku = ?'); values.push(sku); }
    if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
    if (descripcion !== undefined) { updates.push('descripcion = ?'); values.push(descripcion); }
    if (categoria !== undefined) { updates.push('categoria = ?'); values.push(categoria); }
    if (subcategoria !== undefined) { updates.push('subcategoria = ?'); values.push(subcategoria); }
    if (precio_costo !== undefined) { updates.push('precio_costo = ?'); values.push(precio_costo); }
    if (precio_venta !== undefined) { updates.push('precio_venta = ?'); values.push(precio_venta); }
    if (stock !== undefined) { updates.push('stock = ?'); values.push(stock); }
    if (stock_minimo !== undefined) { updates.push('stock_minimo = ?'); values.push(stock_minimo); }
    if (aplica_serie !== undefined) {
      updates.push('aplica_serie = ?');
      values.push(aplica_serie ? 1 : 0);
    }
    if (activo !== undefined) { updates.push('activo = ?'); values.push(activo); }

    if (updates.length === 0 && !imagenesArr) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar',
      });
    }

    // Actualizar campos del producto
    if (updates.length > 0) {
      const updateTenant = productTenantClause(req, 'productos');
      values.push(id);
      values.push(...updateTenant.params);
      await connection.query(
        `UPDATE productos SET ${updates.join(', ')} WHERE id = ?${updateTenant.sql}`,
        values
      );
    }

    // Actualizar imágenes solo si se enviaron nuevas
    if (imagenesArr !== undefined) {
      if (imagenesArr.length > 3) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Máximo 3 imágenes permitidas por producto',
        });
      }

      // Borrar registros e imágenes físicas anteriores
      const [oldImages] = await connection.query(
        'SELECT url FROM producto_imagenes WHERE producto_id = ?',
        [id]
      );
      for (const old of oldImages) {
        if (old.url && old.url.startsWith('/uploads/')) {
          const filePath = path.join(__dirname, '..', old.url);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }
      await connection.query('DELETE FROM producto_imagenes WHERE producto_id = ?', [id]);

      // Insertar nuevas imágenes
      for (let i = 0; i < imagenesArr.length; i++) {
        const imagen = imagenesArr[i];
        let urlFinal = imagen.url || imagen;
        if (typeof urlFinal === 'string' && urlFinal.startsWith('data:')) {
          urlFinal = saveBase64Image(urlFinal, id, i);
        }
        if (urlFinal) {
          await connection.query(
            'INSERT INTO producto_imagenes (producto_id, url, orden, descripcion) VALUES (?, ?, ?, ?)',
            [id, urlFinal, i, imagen.descripcion || `Imagen ${i + 1}`]
          );
        }
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar producto:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al actualizar producto',
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// Eliminar producto (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = productTenantClause(req, 'productos');

    const [result] = await db.query(
      `UPDATE productos SET activo = false WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Producto desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error al desactivar producto:', error);
    res.status(error.statusCode || 500).json({ 
      success: false, 
      message: 'Error al desactivar producto',
      error: error.message 
    });
  }
};

// Ajustar stock con registro en kardex
exports.adjustStock = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { cantidad, tipo = 'ajuste', nota, usuario_id } = req.body;
    
    if (cantidad === undefined) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'La cantidad es requerida' 
      });
    }
    
    // Obtener stock actual
    const tenant = productTenantClause(req, 'p');
    const [products] = await connection.query(
      `SELECT stock FROM productos p WHERE p.id = ?${tenant.sql} FOR UPDATE`,
      [id, ...tenant.params]
    );
    
    if (products.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Producto no encontrado' 
      });
    }
    
    const stockAnterior = products[0].stock;
    const stockNuevo = stockAnterior + cantidad;
    
    if (stockNuevo < 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Stock insuficiente' 
      });
    }
    
    // Actualizar stock
    const updateTenant = productTenantClause(req, 'productos');
    await connection.query(
      `UPDATE productos SET stock = ? WHERE id = ?${updateTenant.sql}`,
      [stockNuevo, id, ...updateTenant.params]
    );
    
    // Registrar en kardex
    await connection.query(
      `INSERT INTO kardex 
        (producto_id, tipo, cantidad, cantidad_anterior, cantidad_nueva, nota, usuario_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tipo, cantidad, stockAnterior, stockNuevo, nota, usuario_id]
    );
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Stock ajustado exitosamente',
      data: {
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        diferencia: cantidad
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al ajustar stock:', error);
    res.status(error.statusCode || 500).json({ 
      success: false, 
      message: 'Error al ajustar stock',
      error: error.message 
    });
  } finally {
    connection.release();
  }
};

// Obtener kardex de un producto
exports.getProductKardex = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    const tenant = productTenantClause(req, 'p');

    const [products] = await db.query(
      `SELECT p.id FROM productos p WHERE p.id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const [tables] = await db.query(
      `SELECT COUNT(*) as total
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'kardex'`
    );

    if (!tables[0]?.total) {
      return res.json({
        success: true,
        data: [],
        message: 'Kardex no configurado'
      });
    }

    const safeLimit = parseLimit(limit, { defaultLimit: 50, maxLimit: 100 });

    const [kardex] = await db.query(
      `SELECT
        k.*,
        u.username as usuario_nombre
      FROM kardex k
      INNER JOIN productos p ON p.id = k.producto_id
      LEFT JOIN users u ON k.usuario_id = u.id
      WHERE k.producto_id = ?${tenant.sql}
      ORDER BY k.created_at DESC
      LIMIT ?`,
      [id, ...tenant.params, safeLimit]
    );
    
    res.json({
      success: true,
      data: kardex
    });
  } catch (error) {
    console.error('Error al obtener kardex:', error);
    res.status(error.statusCode || 500).json({ 
      success: false, 
      message: 'Error al obtener kardex',
      error: error.message 
    });
  }
};

// Buscar productos
exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'El término de búsqueda debe tener al menos 2 caracteres' 
      });
    }
    const tenant = productTenantClause(req, 'p');

    const [products] = await db.query(
      `SELECT 
        p.*,
        GROUP_CONCAT(
          JSON_OBJECT(
            'id', pi.id,
            'url', pi.url,
            'orden', pi.orden,
            'descripcion', pi.descripcion
          )
          ORDER BY pi.orden
        ) as imagenes
      FROM productos p
      LEFT JOIN producto_imagenes pi ON p.id = pi.producto_id
      WHERE p.activo = true
      ${tenant.sql}
      AND (p.nombre LIKE ? OR p.sku LIKE ? OR p.descripcion LIKE ?)
      GROUP BY p.id
      LIMIT 20`,
      [...tenant.params, `%${q}%`, `%${q}%`, `%${q}%`]
    );
    
    const productsWithImages = products.map(p => ({
      ...p,
      imagenes: p.imagenes ? JSON.parse(`[${p.imagenes}]`) : []
    }));
    
    res.json({
      success: true,
      data: productsWithImages
    });
  } catch (error) {
    console.error('Error al buscar productos:', error);
    res.status(error.statusCode || 500).json({ 
      success: false, 
      message: 'Error al buscar productos',
      error: error.message 
    });
  }
};

// Obtener productos con stock crítico (stock <= stock_minimo)
exports.getCriticalStockProducts = async (req, res) => {
  try {
    const tenant = productTenantClause(req, 'p');
    const [products] = await db.query(
      `SELECT
        p.*,
        GROUP_CONCAT(
          JSON_OBJECT(
            'id', pi.id,
            'url', pi.url,
            'orden', pi.orden,
            'descripcion', pi.descripcion
          )
          ORDER BY pi.orden
        ) as imagenes,
        (p.stock_minimo - p.stock) as faltante
      FROM productos p
      LEFT JOIN producto_imagenes pi ON p.id = pi.producto_id
      WHERE p.activo = true${tenant.sql} AND p.stock <= p.stock_minimo
      GROUP BY p.id
      ORDER BY faltante DESC, p.stock ASC`,
      tenant.params
    );
    
    const productsWithImages = products.map(p => ({
      ...p,
      imagenes: p.imagenes ? JSON.parse(`[${p.imagenes}]`) : [],
      faltante: p.faltante
    }));
    
    res.json({
      success: true,
      data: productsWithImages,
      total: productsWithImages.length
    });
  } catch (error) {
    console.error('Error al obtener productos con stock crítico:', error);
    res.status(error.statusCode || 500).json({ 
      success: false, 
      message: 'Error al obtener productos con stock crítico',
      error: error.message 
    });
  }
};
