const db = require('../config/database');

// Obtener todos los clientes
const getAllCustomers = async (req, res) => {
  try {
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
           COUNT(*) AS total_ventas,
           SUM(total) AS total_gastado
         FROM ventas
         WHERE estado != 'ANULADA'
         GROUP BY cliente_id
       ) v ON v.cliente_id = c.id
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
           COUNT(*) AS total_cotizaciones
         FROM cotizaciones
         GROUP BY cliente_id
       ) cot ON cot.cliente_id = c.id
       WHERE c.activo = true
       ORDER BY c.created_at DESC`
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

    const [customers] = await db.query(
      `SELECT *,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(nombre), ''), NULLIF(TRIM(apellido), ''))) AS nombre_completo,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(nombre), ''), NULLIF(TRIM(apellido), ''))) AS name
       FROM clientes 
       WHERE activo = true 
       AND (nombre LIKE ? OR apellido LIKE ? OR email LIKE ? OR telefono LIKE ? OR nit LIKE ?)
       ORDER BY nombre ASC`,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
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
    const [customers] = await db.query(
      `SELECT *,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(nombre), ''), NULLIF(TRIM(apellido), ''))) AS nombre_completo,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(nombre), ''), NULLIF(TRIM(apellido), ''))) AS name
       FROM clientes WHERE id = ? AND activo = true`,
      [id]
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
    const { nombre, apellido, telefono, nit, email, direccion, metodo_pago_preferido, notas } = req.body;

    console.log('📋 nombre extraído:', nombre, 'tipo:', typeof nombre);

    // Validar datos requeridos
    if (!nombre || nombre.trim() === '') {
      console.log('❌ Validación falló: nombre vacío o undefined');
      return res.status(400).json({ 
        success: false,
        message: 'El nombre es requerido' 
      });
    }

    // Insertar cliente
    const [result] = await db.query(
      `INSERT INTO clientes (nombre, apellido, telefono, nit, email, direccion, metodo_pago_preferido, notas) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
    const [customers] = await db.query('SELECT id FROM clientes WHERE id = ? AND activo = true', [id]);
    if (customers.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Cliente no encontrado' 
      });
    }

    // Actualizar cliente
    await db.query(
      `UPDATE clientes 
       SET nombre = ?, apellido = ?, telefono = ?, nit = ?, email = ?, direccion = ?, metodo_pago_preferido = ?, notas = ?
       WHERE id = ?`,
      [
        nombre, 
        apellido || null, 
        telefono || null, 
        nit || null, 
        email || null, 
        direccion || null,
        metodo_pago_preferido || 'efectivo',
        notas || null,
        id
      ]
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

    const [result] = await db.query('UPDATE clientes SET activo = false WHERE id = ?', [id]);

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
       WHERE v.cliente_id = ?
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
      [id, id]
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
