// Controller para gestionar compras de productos y repuestos
const db = require('../config/database');
const tarjetaCtrl = require('./tarjetaCreditoController');

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getCompraEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? null;
}

function requireCompraEmpresaId(req) {
  const empresaId = getCompraEmpresaId(req);
  if (empresaId === null || empresaId === undefined || empresaId === '') {
    const error = new Error('empresaId requerido');
    error.statusCode = 403;
    throw error;
  }
  return empresaId;
}

function compraTenantClause(req, alias = null) {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { sql: ` AND ${prefix}empresa_id = ?`, params: [requireCompraEmpresaId(req)] };
}

function resolveCompraEmpresaId(options = {}) {
  const { req, empresaId } = options;
  if (empresaId !== undefined && empresaId !== null && empresaId !== '') return empresaId;
  if (req) return requireCompraEmpresaId(req);
  throw new Error('empresaId requerido');
}

async function validateProveedorForCompra(connection, proveedorId, empresaId) {
  if (proveedorId === undefined || proveedorId === null || proveedorId === '') return true;

  const [proveedores] = await connection.query(
    'SELECT id FROM proveedores WHERE id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [proveedorId, empresaId]
  );

  return proveedores.length > 0;
}

// ========== CREAR COMPRA DE PRODUCTOS ==========
exports.createCompraProductos = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      fecha_compra,
      proveedor_id,
      proveedor_nombre,
      proveedor_telefono,
      proveedor_nit,
      proveedor_direccion,
      items,
      notas,
      estado = 'CONFIRMADA',
      metodo_pago,
      tarjeta_id
    } = req.body;

    if (!fecha_compra || !proveedor_nombre || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }
    const empresaId = requireCompraEmpresaId(req);

    const proveedorValido = await validateProveedorForCompra(connection, proveedor_id, empresaId);
    if (!proveedorValido) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Proveedor no encontrado para la empresa' });
    }

    // Calcular totales
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.cantidad * item.precio_unitario;
    });
    const total = subtotal;

    // Generar número de compra
    const fecha = new Date(fecha_compra);
    const year = fecha.getFullYear();
    const [lastCompra] = await connection.query(
      'SELECT id FROM compras ORDER BY id DESC LIMIT 1'
    );
    const nextId = lastCompra.length > 0 ? lastCompra[0].id + 1 : 1;
    const numero_compra = `COMP-${year}-${nextId}`;

    // Insertar compra
    const [compraResult] = await connection.query(
      `INSERT INTO compras
        (empresa_id, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedor_telefono,
         proveedor_nit, proveedor_direccion, subtotal, impuestos, total, estado, notas, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'PRODUCTO')`,
      [empresaId, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedor_telefono,
       proveedor_nit, proveedor_direccion, subtotal, total, estado, notas]
    );

    const compraId = compraResult.insertId;

    // Si el pago es con tarjeta de crédito, validar tarjeta y registrar movimiento
    if (metodo_pago === 'tarjeta_credito') {
      if (!tarjeta_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Debes seleccionar una tarjeta de crédito' });
      }
      const [tarjetas] = await connection.query(
        'SELECT * FROM tarjetas_credito WHERE id = ? AND empresa_id = ? AND activo = 1',
        [tarjeta_id, empresaId]
      );
      if (!tarjetas.length) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Tarjeta no encontrada o inactiva' });
      }
      const t = tarjetas[0];
      const montoCentavos = Math.round(total * 100);
      await tarjetaCtrl.registrarCompra(
        connection, tarjeta_id, montoCentavos, compraId,
        `Compra ${numero_compra} con tarjeta ${t.banco} ****${t.ultimos4}`,
        req.user?.id,
        empresaId
      );
    }

    // Procesar items
    for (const item of items) {
      const [productos] = await connection.query(
        'SELECT id FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1',
        [item.producto_id, empresaId]
      );
      if (!productos.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: `Producto ${item.producto_id} no encontrado para la empresa` });
      }

      // Insertar item
      const [itemResult] = await connection.query(
        `INSERT INTO compra_items
          (empresa_id, compra_id, producto_id, sku, nombre_producto, cantidad, precio_unitario, subtotal, aplica_serie)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, compraId, item.producto_id, item.sku, item.nombre_producto, item.cantidad,
         item.precio_unitario, item.cantidad * item.precio_unitario, item.aplica_serie || false]
      );

      const compraItemId = itemResult.insertId;

      // Insertar series si aplica
      if (item.aplica_serie && item.series && item.series.length > 0) {
        for (const numeroSerie of item.series) {
          await connection.query(
            `INSERT INTO producto_series
              (empresa_id, producto_id, sku, numero_serie, compra_id, compra_item_id, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'DISPONIBLE')`,
            [empresaId, item.producto_id, item.sku, numeroSerie, compraId, compraItemId]
          );
        }
      }

      // Actualizar inventario si está confirmada
      if (estado === 'CONFIRMADA' || estado === 'RECIBIDA') {
        const margen = 1.30; // 30% de ganancia
        const precioVentaCalculado = item.precio_unitario * margen;

        await connection.query(
          'UPDATE productos SET stock = stock + ?, precio_costo = ?, precio_venta = ? WHERE id = ? AND empresa_id = ?',
          [item.cantidad, item.precio_unitario, precioVentaCalculado, item.producto_id, empresaId]
        );

        console.log(`✅ Producto ${item.producto_id}: +${item.cantidad} stock, Costo: Q${item.precio_unitario}, Venta: Q${precioVentaCalculado.toFixed(2)}`);
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Compra de productos registrada exitosamente',
      data: {
        id: compraId,
        numero_compra,
        total,
        items_count: items.length
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear compra de productos:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al registrar la compra de productos',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ========== CREAR COMPRA DE REPUESTOS ==========
exports.createCompraRepuestos = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      fecha_compra,
      proveedor_id,
      proveedor_nombre,
      proveedor_telefono,
      proveedor_nit,
      proveedor_direccion,
      items,
      notas,
      estado = 'CONFIRMADA',
      metodo_pago,
      tarjeta_id
    } = req.body;

    if (!fecha_compra || !proveedor_nombre || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }
    const empresaId = requireCompraEmpresaId(req);

    const proveedorValido = await validateProveedorForCompra(connection, proveedor_id, empresaId);
    if (!proveedorValido) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Proveedor no encontrado para la empresa' });
    }

    // Calcular totales
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.cantidad * item.precio_unitario;
    });
    const total = subtotal;

    // Generar número de compra
    const fecha = new Date(fecha_compra);
    const year = fecha.getFullYear();
    const [lastCompra] = await connection.query(
      'SELECT id FROM compras ORDER BY id DESC LIMIT 1'
    );
    const nextId = lastCompra.length > 0 ? lastCompra[0].id + 1 : 1;
    const numero_compra = `COMR-${year}-${nextId}`;

    // Insertar compra
    const [compraResult] = await connection.query(
      `INSERT INTO compras
        (empresa_id, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedor_telefono,
         proveedor_nit, proveedor_direccion, subtotal, impuestos, total, estado, notas, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'REPUESTO')`,
      [empresaId, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedor_telefono,
       proveedor_nit, proveedor_direccion, subtotal, total, estado, notas]
    );

    const compraId = compraResult.insertId;

    // Si el pago es con tarjeta de crédito
    if (metodo_pago === 'tarjeta_credito') {
      if (!tarjeta_id) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Debes seleccionar una tarjeta de crédito' });
      }
      const [tarjetas] = await connection.query(
        'SELECT * FROM tarjetas_credito WHERE id = ? AND empresa_id = ? AND activo = 1',
        [tarjeta_id, empresaId]
      );
      if (!tarjetas.length) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Tarjeta no encontrada o inactiva' });
      }
      const t = tarjetas[0];
      const montoCentavos = Math.round(total * 100);
      await tarjetaCtrl.registrarCompra(
        connection, tarjeta_id, montoCentavos, compraId,
        `Compra ${numero_compra} con tarjeta ${t.banco} ****${t.ultimos4}`,
        req.user?.id,
        empresaId
      );
    }

    // Procesar items
    for (const item of items) {
      const [repuestos] = await connection.query(
        'SELECT id FROM repuestos WHERE id = ? AND empresa_id = ? LIMIT 1',
        [item.producto_id, empresaId]
      );
      if (!repuestos.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: `Repuesto ${item.producto_id} no encontrado para la empresa` });
      }

      // Insertar item
      const [itemResult] = await connection.query(
        `INSERT INTO compra_items
          (empresa_id, compra_id, producto_id, sku, nombre_producto, cantidad, precio_unitario, subtotal, aplica_serie)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, false)`,
        [empresaId, compraId, item.producto_id, item.sku, item.nombre_producto, item.cantidad,
         item.precio_unitario, item.cantidad * item.precio_unitario]
      );

      // Actualizar inventario si está confirmada
      if (estado === 'CONFIRMADA' || estado === 'RECIBIDA') {
        const margen = 1.30; // 30% de ganancia
        // precio_unitario viene en quetzales del frontend; la tabla repuestos almacena en centavos
        const costoCentavos = Math.round(item.precio_unitario * 100);
        const publicoCentavos = Math.round(item.precio_unitario * margen * 100);

        await connection.query(
          'UPDATE repuestos SET stock = stock + ?, precio_costo = ?, precio_publico = ? WHERE id = ? AND empresa_id = ?',
          [item.cantidad, costoCentavos, publicoCentavos, item.producto_id, empresaId]
        );

        console.log(`✅ Repuesto ${item.producto_id}: +${item.cantidad} stock, Costo: Q${item.precio_unitario}, Público: Q${(item.precio_unitario * margen).toFixed(2)}`);
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Compra de repuestos registrada exitosamente',
      data: {
        id: compraId,
        numero_compra,
        total,
        items_count: items.length
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear compra de repuestos:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al registrar la compra de repuestos',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ========== CREAR COMPRA (DEPRECADO - MANTENER POR COMPATIBILIDAD) ==========
exports.createCompra = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      fecha_compra,
      proveedor_id, // ID del proveedor (puede ser null si se ingresa manualmente)
      proveedor_nombre,
      proveedor_telefono,
      proveedor_nit,
      proveedor_direccion,
      items, // [{ producto_id, sku, nombre_producto, cantidad, precio_unitario, aplica_serie, series: [], tipo_item: 'producto'|'repuesto' }]
      notas,
      estado = 'CONFIRMADA'
    } = req.body;

    // Validaciones
    if (!fecha_compra || !proveedor_nombre || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: fecha_compra, proveedor_nombre, items'
      });
    }
    const empresaId = requireCompraEmpresaId(req);

    const proveedorValido = await validateProveedorForCompra(connection, proveedor_id, empresaId);
    if (!proveedorValido) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Proveedor no encontrado para la empresa' });
    }

    // Calcular totales
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.cantidad * item.precio_unitario;
    });
    const impuestos = 0; // Por ahora sin impuestos
    const total = subtotal + impuestos;

    // Generar número de compra único
    const fecha = new Date(fecha_compra);
    const year = fecha.getFullYear();
    const [lastCompra] = await connection.query(
      'SELECT id FROM compras ORDER BY id DESC LIMIT 1'
    );
    const nextId = lastCompra.length > 0 ? lastCompra[0].id + 1 : 1;
    const numero_compra = `COM-${year}-${nextId}`;

    // Insertar compra (con proveedor_id si existe)
    const [compraResult] = await connection.query(
      `INSERT INTO compras
        (empresa_id, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedor_telefono, proveedor_nit,
         proveedor_direccion, subtotal, impuestos, total, notas, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedor_telefono, proveedor_nit,
       proveedor_direccion, subtotal, impuestos, total, notas, estado]
    );

    const compraId = compraResult.insertId;

    // Insertar items y actualizar stock
    for (const item of items) {
      const subtotalItem = item.cantidad * item.precio_unitario;
      const tipoItem = item.tipo_item || 'producto'; // Default a producto si no se especifica

      if (tipoItem === 'producto') {
        const [productos] = await connection.query(
          'SELECT id FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1',
          [item.producto_id, empresaId]
        );
        if (!productos.length) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: `Producto ${item.producto_id} no encontrado para la empresa` });
        }
      } else if (tipoItem === 'repuesto') {
        const [repuestos] = await connection.query(
          'SELECT id FROM repuestos WHERE id = ? AND empresa_id = ? LIMIT 1',
          [item.producto_id, empresaId]
        );
        if (!repuestos.length) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: `Repuesto ${item.producto_id} no encontrado para la empresa` });
        }
      }

      // Insertar item
      const [itemResult] = await connection.query(
        `INSERT INTO compra_items
          (empresa_id, compra_id, producto_id, sku, nombre_producto, cantidad, precio_unitario, subtotal, aplica_serie)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, compraId, item.producto_id, item.sku, item.nombre_producto,
         item.cantidad, item.precio_unitario, subtotalItem, item.aplica_serie]
      );

      const compraItemId = itemResult.insertId;

      // Si aplica serie, insertar número de serie (ahora es uno solo para todas las unidades)
      if (item.aplica_serie && item.series && item.series.length > 0) {
        // Obtener la serie (todas son iguales ahora)
        const numeroSerie = item.series[0];

        if (!numeroSerie || numeroSerie.trim() === '') {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `El número de serie es requerido para "${item.nombre_producto}"`
          });
        }

        // NO validar duplicados - permitir la misma serie en diferentes compras
        // Esto es útil para modelos genéricos o lotes del mismo producto

        // Insertar UNA sola serie que representa el modelo/serie de este lote de productos
        // con una nota indicando la cantidad
        await connection.query(
          `INSERT INTO producto_series
            (empresa_id, producto_id, sku, numero_serie, compra_id, compra_item_id, estado, notas)
          VALUES (?, ?, ?, ?, ?, ?, 'DISPONIBLE', ?)`,
          [empresaId, item.producto_id, item.sku, numeroSerie, compraId, compraItemId,
           `Lote de ${item.cantidad} unidades - Compra ${numero_compra}`]
        );
      }

      // Actualizar stock y precio según el tipo de item (producto o repuesto)
      if (estado === 'CONFIRMADA' || estado === 'RECIBIDA') {
        if (tipoItem === 'producto') {
          // Calcular precio de venta con margen (ejemplo: 30% de ganancia)
          const margen = 1.30; // 30% de ganancia
          const precioVentaCalculado = item.precio_unitario * margen;

          // Actualizar stock, precio_costo y precio_venta del producto
          await connection.query(
            'UPDATE productos SET stock = stock + ?, precio_costo = ?, precio_venta = ? WHERE id = ? AND empresa_id = ?',
            [item.cantidad, item.precio_unitario, precioVentaCalculado, item.producto_id, empresaId]
          );
          console.log(`✅ Stock actualizado: Producto ${item.producto_id}, +${item.cantidad}, Costo: Q${item.precio_unitario}, Venta: Q${precioVentaCalculado}`);

        } else if (tipoItem === 'repuesto') {
          // Calcular precio público con margen (ejemplo: 30% de ganancia)
          const margen = 1.30; // 30% de ganancia
          const precioPublicoCalculado = Math.round(item.precio_unitario * margen);

          // Actualizar stock, precio_costo y precio_publico del repuesto
          await connection.query(
            'UPDATE repuestos SET stock = stock + ?, precio_costo = ?, precio_publico = ? WHERE id = ? AND empresa_id = ?',
            [item.cantidad, item.precio_unitario, precioPublicoCalculado, item.producto_id, empresaId]
          );
          console.log(`✅ Stock actualizado: Repuesto ${item.producto_id}, +${item.cantidad}, Costo: Q${item.precio_unitario}, Público: Q${precioPublicoCalculado}`);
        }
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Compra registrada exitosamente',
      data: {
        id: compraId,
        numero_compra,
        total,
        items_count: items.length
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear compra:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al crear compra',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ========== OBTENER TODAS LAS COMPRAS ==========
exports.getAllCompras = async (req, res) => {
  try {
    const { estado, fecha_desde, fecha_hasta, proveedor, page = 1, limit = 20 } = req.query;
    const tenant = compraTenantClause(req);

    let query = 'SELECT * FROM compras WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM compras WHERE 1=1';
    const params = [...tenant.params];
    const countParams = [...tenant.params];
    query += tenant.sql;
    countQuery += tenant.sql;

    if (estado) {
      query += ' AND estado = ?';
      countQuery += ' AND estado = ?';
      params.push(estado);
      countParams.push(estado);
    }

    if (fecha_desde) {
      query += ' AND fecha_compra >= ?';
      countQuery += ' AND fecha_compra >= ?';
      params.push(fecha_desde);
      countParams.push(fecha_desde);
    }

    if (fecha_hasta) {
      query += ' AND fecha_compra <= ?';
      countQuery += ' AND fecha_compra <= ?';
      params.push(fecha_hasta);
      countParams.push(fecha_hasta);
    }

    if (proveedor) {
      query += ' AND proveedor_nombre LIKE ?';
      countQuery += ' AND proveedor_nombre LIKE ?';
      const searchPattern = `%${proveedor}%`;
      params.push(searchPattern);
      countParams.push(searchPattern);
    }

    // Paginación
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    query += ' ORDER BY fecha_compra DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [compras] = await db.query(query, params);

    res.json({
      success: true,
      data: compras,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('❌ Error al obtener compras:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al obtener compras',
      error: error.message
    });
  }
};

// ========== OBTENER COMPRA POR ID CON ITEMS ==========
exports.getCompraById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = compraTenantClause(req);

    // Obtener compra
    const [compras] = await db.query(`SELECT * FROM compras WHERE id = ?${tenant.sql}`, [id, ...tenant.params]);

    if (compras.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    const compra = compras[0];
    const empresaId = compra.empresa_id ?? requireCompraEmpresaId(req);

    // Obtener items de la compra
    const [items] = await db.query(
      `SELECT ci.*,
        (SELECT COUNT(*) FROM producto_series ps WHERE ps.compra_item_id = ci.id AND ps.empresa_id = ci.empresa_id) as series_count
      FROM compra_items ci
      WHERE ci.compra_id = ? AND ci.empresa_id = ?`,
      [id, empresaId]
    );

    // Para cada item que aplica serie, obtener las series
    for (const item of items) {
      if (item.aplica_serie) {
        const [series] = await db.query(
          'SELECT * FROM producto_series WHERE compra_item_id = ? AND empresa_id = ?',
          [item.id, empresaId]
        );
        item.series = series;
      }
    }

    compra.items = items;

    res.json({
      success: true,
      data: compra
    });
  } catch (error) {
    console.error('❌ Error al obtener compra:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al obtener compra',
      error: error.message
    });
  }
};

// ========== OBTENER SERIES DE UN PRODUCTO ==========
exports.getSeriesByProducto = async (req, res) => {
  try {
    const { productoId } = req.params;
    const { estado } = req.query;
    const empresaId = requireCompraEmpresaId(req);

    const [productos] = await db.query(
      'SELECT id FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1',
      [productoId, empresaId]
    );
    if (!productos.length) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    let query = 'SELECT * FROM producto_series WHERE producto_id = ? AND empresa_id = ?';
    const params = [productoId, empresaId];

    if (estado) {
      query += ' AND estado = ?';
      params.push(estado);
    }

    query += ' ORDER BY fecha_ingreso DESC';

    const [series] = await db.query(query, params);

    res.json({
      success: true,
      data: series
    });
  } catch (error) {
    console.error('❌ Error al obtener series:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al obtener series',
      error: error.message
    });
  }
};

// ========== ANULAR COMPRA ==========
exports.anularCompra = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { motivo = '' } = req.body;
    const tenant = compraTenantClause(req);

    // Obtener la compra
    const [compras] = await connection.query(`SELECT * FROM compras WHERE id = ?${tenant.sql}`, [id, ...tenant.params]);
    if (compras.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Compra no encontrada' });
    }

    const compra = compras[0];
    const empresaId = compra.empresa_id ?? requireCompraEmpresaId(req);

    if (compra.estado === 'CANCELADA') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'La compra ya está anulada' });
    }

    // Obtener los items de la compra
    const [items] = await connection.query('SELECT * FROM compra_items WHERE compra_id = ? AND empresa_id = ?', [id, empresaId]);

    // Revertir stock solo si la compra estaba confirmada/recibida
    if (compra.estado === 'CONFIRMADA' || compra.estado === 'RECIBIDA') {
      for (const item of items) {
        if (compra.tipo === 'PRODUCTO') {
          await connection.query(
            'UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE id = ? AND empresa_id = ?',
            [item.cantidad, item.producto_id, empresaId]
          );
        } else if (compra.tipo === 'REPUESTO') {
          await connection.query(
            'UPDATE repuestos SET stock = GREATEST(0, stock - ?) WHERE id = ? AND empresa_id = ?',
            [item.cantidad, item.producto_id, empresaId]
          );
        }
      }
    }

    // Marcar como cancelada
    await connection.query(
      "UPDATE compras SET estado = 'CANCELADA', notas = CONCAT(COALESCE(notas,''), IF(notas IS NULL OR notas = '', '', ' | '), 'ANULADA: ', ?) WHERE id = ? AND empresa_id = ?",
      [motivo || 'Sin motivo', id, empresaId]
    );

    await connection.commit();
    res.json({ success: true, message: 'Compra anulada y stock revertido correctamente' });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al anular compra:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error al anular la compra', error: error.message });
  } finally {
    connection.release();
  }
};

module.exports = exports;
