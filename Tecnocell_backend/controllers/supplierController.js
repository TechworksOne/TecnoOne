const db = require('../config/database');

// Obtener todos los proveedores
exports.getAllSuppliers = async (req, res) => {
  try {
    const { search, activo, limit = 100 } = req.query;
    
    let query = `
      SELECT 
        p.*,
        COUNT(DISTINCT c.id) as total_compras,
        MAX(c.fecha_compra) as ultima_compra
      FROM proveedores p
      LEFT JOIN compras c ON p.id = c.proveedor_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (activo !== undefined) {
      query += ' AND p.activo = ?';
      const activoValue = activo === 'true' || activo === true;
      params.push(activoValue);
    }
    
    if (search) {
      query += ' AND (p.nombre LIKE ? OR p.nit LIKE ? OR p.telefono LIKE ? OR p.email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    query += ' GROUP BY p.id ORDER BY p.nombre LIMIT ?';
    params.push(parseInt(limit));
    
    const [suppliers] = await db.query(query, params);
    
    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener proveedores',
      error: error.message 
    });
  }
};

// Buscar proveedores
exports.searchSuppliers = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere un término de búsqueda' 
      });
    }
    
    const searchPattern = `%${query}%`;
    const [suppliers] = await db.query(
      `SELECT * FROM proveedores 
       WHERE activo = true 
       AND (nombre LIKE ? OR nit LIKE ? OR telefono LIKE ? OR email LIKE ?)
       ORDER BY nombre
       LIMIT 20`,
      [searchPattern, searchPattern, searchPattern, searchPattern]
    );
    
    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('Error al buscar proveedores:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al buscar proveedores',
      error: error.message 
    });
  }
};

// Obtener proveedor por ID
exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [suppliers] = await db.query(
      `SELECT 
        p.*,
        COUNT(DISTINCT c.id) as total_compras,
        MAX(c.fecha_compra) as ultima_compra,
        SUM(c.total) as monto_total_compras
      FROM proveedores p
      LEFT JOIN compras c ON p.id = c.proveedor_id
      WHERE p.id = ?
      GROUP BY p.id`,
      [id]
    );
    
    if (suppliers.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Proveedor no encontrado' 
      });
    }
    
    res.json({
      success: true,
      data: suppliers[0]
    });
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener proveedor',
      error: error.message 
    });
  }
};

// Obtener compras de un proveedor
exports.getSupplierPurchases = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [purchases] = await db.query(
      `SELECT 
        c.id,
        c.numero_compra,
        c.fecha_compra,
        c.subtotal,
        c.impuestos,
        c.total,
        c.estado,
        c.notas,
        c.created_at,
        u.name as usuario_nombre,
        COUNT(ci.id) as total_items
      FROM compras c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN compra_items ci ON c.id = ci.compra_id
      WHERE c.proveedor_id = ?
      GROUP BY c.id
      ORDER BY c.fecha_compra DESC
      LIMIT 50`,
      [id]
    );
    
    res.json({
      success: true,
      data: purchases
    });
  } catch (error) {
    console.error('Error al obtener compras del proveedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener compras del proveedor',
      error: error.message 
    });
  }
};

// Crear proveedor
exports.createSupplier = async (req, res) => {
  try {
    const {
      nombre,
      contacto,
      telefono,
      email,
      direccion,
      nit,
      empresa,
      sitio_web,
      notas
    } = req.body;
    
    // Validar campos requeridos
    if (!nombre) {
      return res.status(400).json({ 
        success: false, 
        message: 'El nombre del proveedor es requerido' 
      });
    }
    
    const [result] = await db.query(
      `INSERT INTO proveedores 
        (nombre, contacto, telefono, email, direccion, nit, empresa, sitio_web, notas, activo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [nombre, contacto, telefono, email, direccion, nit, empresa, sitio_web, notas]
    );
    
    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear proveedor',
      error: error.message 
    });
  }
};

// Actualizar proveedor
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      contacto,
      telefono,
      email,
      direccion,
      nit,
      empresa,
      sitio_web,
      notas,
      activo
    } = req.body;
    
    const updates = [];
    const values = [];
    
    if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
    if (contacto !== undefined) { updates.push('contacto = ?'); values.push(contacto); }
    if (telefono !== undefined) { updates.push('telefono = ?'); values.push(telefono); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (direccion !== undefined) { updates.push('direccion = ?'); values.push(direccion); }
    if (nit !== undefined) { updates.push('nit = ?'); values.push(nit); }
    if (empresa !== undefined) { updates.push('empresa = ?'); values.push(empresa); }
    if (sitio_web !== undefined) { updates.push('sitio_web = ?'); values.push(sitio_web); }
    if (notas !== undefined) { updates.push('notas = ?'); values.push(notas); }
    if (activo !== undefined) { updates.push('activo = ?'); values.push(activo); }
    
    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No hay datos para actualizar' 
      });
    }
    
    values.push(id);
    await db.query(
      `UPDATE proveedores SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    res.json({
      success: true,
      message: 'Proveedor actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar proveedor',
      error: error.message 
    });
  }
};

// Eliminar proveedor (soft delete)
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('UPDATE proveedores SET activo = false WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Proveedor desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar proveedor',
      error: error.message 
    });
  }
};
