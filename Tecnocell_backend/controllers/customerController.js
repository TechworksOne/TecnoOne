const db = require('../config/database');

function addTenantCondition(req, conditions, params, alias = 'c') {
  if (!req.tenant?.isSuperadmin) {
    conditions.push(`${alias}.empresa_id = ?`);
    params.push(req.tenant.empresa_id);
  }
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? 1;
}

// Obtener todos los clientes
const getAllCustomers = async (req, res) => {
  try {
    const conditions = ['c.activo = true'];
    const params = [];
    addTenantCondition(req, conditions, params);

    const [customers] = await db.query(
      `SELECT 
        c.*,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(c.apellido), ''))) AS nombre_completo,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(c.apellido), ''))) AS name,
        COALESCE(v.total_ventas, 0) + COALESCE(rep.total_reparaciones, 0) AS total_ventas,
        COALESCE(v.total_gastado, 0) + COALESCE(rep.total_gastado_rep, 0) AS total_gastado,
        COALESCE(cot.total_cotizaciones, 0) AS total_cotizaciones
       FROM clientes c
       LEFT JOIN (
         SELECT cliente_id,
           empresa_id,
           COUNT(*) AS total_ventas,
           SUM(total) AS total_gastado
         FROM ventas
         WHERE estado != 'ANULADA'
         GROUP BY cliente_id, empresa_id
       ) v ON v.cliente_id = c.id AND v.empresa_id = c.empresa_id
       LEFT JOIN (
         SELECT cliente_id,
           COUNT(*) AS total_reparaciones,
           SUM(total) AS total_gastado_rep
         FROM reparaciones
         WHERE cliente_id IS NOT NULL AND estado != 'CANCELADA'
         GROUP BY cliente_id
       ) rep ON rep.cliente_id = c.id
       LEFT JOIN (
         SELECT cliente_id,
           empresa_id,
           COUNT(*) AS total_cotizaciones
         FROM cotizaciones
         GROUP BY cliente_id, empresa_id
       ) cot ON cot.cliente_id = c.id AND cot.empresa_id = c.empresa_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.created_at DESC`,
      params
    );
    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener clientes' 
    });
  }
};

// Buscar clientes
const searchCustomers = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false,
        message: 'Se requiere un término de búsqueda' 
      });
    }

    const conditions = [
      'c.activo = true',
      '(c.nombre LIKE ? OR c.apellido LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? OR c.nit LIKE ?)'
    ];
    const like = `%${query}%`;
    const params = [like, like, like, like, like];
    addTenantCondition(req, conditions, params);

    const [customers] = await db.query(
      `SELECT c.*,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(c.apellido), ''))) AS nombre_completo,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(c.apellido), ''))) AS name
       FROM clientes c
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.nombre ASC`,
      params
    );

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error al buscar clientes:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al buscar clientes' 
    });
  }
};

// Obtener cliente por ID
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = getTenantEmpresaId(req);
    const conditions = ['c.id = ?', 'c.activo = true'];
    const params = [id];
    addTenantCondition(req, conditions, params);

    const [customers] = await db.query(
      `SELECT c.*,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(c.apellido), ''))) AS nombre_completo,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(c.apellido), ''))) AS name
       FROM clientes c WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (customers.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Cliente no encontrado' 
      });
    }

    res.json({
      success: true,
      data: customers[0]
    });
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener cliente' 
    });
  }
};

// Crear nuevo cliente
const createCustomer = async (req, res) => {
  try {
    console.log('📥 Datos recibidos en backend:', req.body);
    const { nombre, apellido, telefono, nit, email, direccion, metodo_pago_preferido, notas, empresa_id } = req.body;

    console.log('📋 nombre extraído:', nombre, 'tipo:', typeof nombre);

    // Validar datos requeridos
    if (!nombre || nombre.trim() === '') {
      console.log('❌ Validación falló: nombre vacío o undefined');
      return res.status(400).json({ 
        success: false,
        message: 'El nombre es requerido' 
      });
    }

    const empresaId = req.tenant?.isSuperadmin
      ? (empresa_id !== undefined && empresa_id !== '' ? empresa_id : getTenantEmpresaId(req))
      : getTenantEmpresaId(req);

    // Insertar cliente
    const [result] = await db.query(
      `INSERT INTO clientes (empresa_id, nombre, apellido, telefono, nit, email, direccion, metodo_pago_preferido, notas) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        nombre, 
        apellido || null, 
        telefono || null, 
        nit || null, 
        email || null, 
        direccion || null,
        metodo_pago_preferido || 'efectivo',
        notas || null
      ]
    );

    console.log('✅ Cliente creado con ID:', result.insertId);

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('❌ Error al crear cliente:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al crear cliente',
      error: error.message
    });
  }
};

// Actualizar cliente
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, telefono, nit, email, direccion, metodo_pago_preferido, notas } = req.body;

    // Verificar que el cliente existe
    const conditions = ['c.id = ?', 'c.activo = true'];
    const params = [id];
    addTenantCondition(req, conditions, params);
    const [customers] = await db.query(`SELECT c.id FROM clientes c WHERE ${conditions.join(' AND ')}`, params);
    if (customers.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Cliente no encontrado' 
      });
    }

    // Actualizar cliente
    const updateConditions = ['id = ?'];
    const updateParams = [
        nombre, 
        apellido || null, 
        telefono || null, 
        nit || null, 
        email || null, 
        direccion || null,
        metodo_pago_preferido || 'efectivo',
        notas || null,
        id
      ];
    if (!req.tenant?.isSuperadmin) {
      updateConditions.push('empresa_id = ?');
      updateParams.push(req.tenant.empresa_id);
    }

    await db.query(
      `UPDATE clientes 
       SET nombre = ?, apellido = ?, telefono = ?, nit = ?, email = ?, direccion = ?, metodo_pago_preferido = ?, notas = ?
       WHERE ${updateConditions.join(' AND ')}`,
      updateParams
    );

    res.json({ 
      success: true,
      message: 'Cliente actualizado exitosamente' 
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al actualizar cliente' 
    });
  }
};

// Eliminar cliente (soft delete)
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const conditions = ['id = ?'];
    const params = [id];
    if (!req.tenant?.isSuperadmin) {
      conditions.push('empresa_id = ?');
      params.push(req.tenant.empresa_id);
    }

    const [result] = await db.query(`UPDATE clientes SET activo = false WHERE ${conditions.join(' AND ')}`, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Cliente no encontrado' 
      });
    }

    res.json({ 
      success: true,
      message: 'Cliente desactivado exitosamente' 
    });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al eliminar cliente' 
    });
  }
};

// Obtener compras/ventas de un cliente
const getCustomerPurchases = async (req, res) => {
  try {
    const { id } = req.params;
    const conditions = ['c.id = ?', 'c.activo = true'];
    const params = [id];
    addTenantCondition(req, conditions, params);
    const ventasTenantSql = req.tenant?.isSuperadmin ? '' : ' AND v.empresa_id = ?';
    const ventasTenantParams = req.tenant?.isSuperadmin ? [] : [getTenantEmpresaId(req)];

    const [customers] = await db.query(`SELECT c.id FROM clientes c WHERE ${conditions.join(' AND ')}`, params);
    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }
    
    const [purchases] = await db.query(
      `SELECT 
        v.id,
        v.numero_venta as reference,
        v.fecha_venta as date,
        v.total,
        v.estado as status,
        v.metodo_pago as paymentMethod,
        v.items,
        v.observaciones as notes,
       'sale' as type
       FROM ventas v
       WHERE v.cliente_id = ?${ventasTenantSql}
       UNION ALL
       SELECT
        r.id,
        r.id as reference,
        r.fecha_ingreso as date,
        r.total,
        r.estado as status,
        NULL as paymentMethod,
        NULL as items,
        r.observaciones as notes,
        'repair' as type
       FROM reparaciones r
       WHERE r.cliente_id = ? AND r.estado != 'CANCELADA'
       ORDER BY date DESC`,
      [id, ...ventasTenantParams, id]
    );
    
    // Parsear items JSON y formatear datos
    const formattedPurchases = purchases.map(purchase => {
      let products = [];
      let itemCount = 0;
      
      try {
        if (purchase.items) {
          const itemsArray = JSON.parse(purchase.items);
          products = itemsArray.map(item => ({
            name: item.nombre || item.name || 'Producto',
            quantity: item.cantidad || item.quantity || 1,
            price: item.precio || item.price || 0,
            subtotal: item.subtotal || (item.cantidad * item.precio) || 0
          }));
          itemCount = products.length;
        }
      } catch (e) {
        console.error('Error parsing items JSON:', e);
      }
      
      return {
        id: purchase.id,
        reference: purchase.reference,
        date: purchase.date,
        total: purchase.total / 100, // Convertir de centavos a quetzales
        status: purchase.status,
        paymentMethod: purchase.paymentMethod,
        notes: purchase.notes,
        type: purchase.type || 'sale',
        items: itemCount,
        products: products
      };
    });

    res.json({
      success: true,
      data: formattedPurchases
    });
  } catch (error) {
    console.error('Error al obtener compras del cliente:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener compras del cliente',
      error: error.message
    });
  }
};

module.exports = {
  getAllCustomers,
  searchCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerPurchases
};
