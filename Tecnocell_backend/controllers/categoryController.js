const db = require('../config/database');

// Obtener todas las categorías con sus subcategorías
exports.getAllCategories = async (req, res) => {
  try {
    // Obtener categorías
    const [categories] = await db.query(
      'SELECT * FROM categorias WHERE activo = true ORDER BY orden, nombre'
    );

    // Obtener subcategorías
    const [subcategories] = await db.query(
      'SELECT * FROM subcategorias WHERE activo = true ORDER BY orden, nombre'
    );

    // Estructurar las categorías con sus subcategorías
    const categoryStructure = {};
    categories.forEach(cat => {
      categoryStructure[cat.nombre] = subcategories
        .filter(sub => sub.categoria_id === cat.id)
        .map(sub => sub.nombre);
    });

    res.json({
      success: true,
      data: {
        categories: categories,
        subcategories: subcategories,
        categoryStructure: categoryStructure
      }
    });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener categorías',
      error: error.message 
    });
  }
};

// Crear nueva categoría
exports.createCategory = async (req, res) => {
  try {
    const { nombre, icono, orden } = req.body;

    if (!nombre) {
      return res.status(400).json({ 
        success: false, 
        message: 'El nombre de la categoría es requerido' 
      });
    }

    const [result] = await db.query(
      'INSERT INTO categorias (nombre, icono, orden) VALUES (?, ?, ?)',
      [nombre, icono || null, orden || 0]
    );

    res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: {
        id: result.insertId,
        nombre,
        icono,
        orden
      }
    });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false, 
        message: 'Ya existe una categoría con ese nombre' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Error al crear categoría',
      error: error.message 
    });
  }
};

// Crear nueva subcategoría
exports.createSubcategory = async (req, res) => {
  try {
    const { categoria_id, nombre, orden } = req.body;

    if (!categoria_id || !nombre) {
      return res.status(400).json({ 
        success: false, 
        message: 'El ID de categoría y nombre son requeridos' 
      });
    }

    const [result] = await db.query(
      'INSERT INTO subcategorias (categoria_id, nombre, orden) VALUES (?, ?, ?)',
      [categoria_id, nombre, orden || 0]
    );

    res.status(201).json({
      success: true,
      message: 'Subcategoría creada exitosamente',
      data: {
        id: result.insertId,
        categoria_id,
        nombre,
        orden
      }
    });
  } catch (error) {
    console.error('Error al crear subcategoría:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false, 
        message: 'Ya existe una subcategoría con ese nombre en esta categoría' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Error al crear subcategoría',
      error: error.message 
    });
  }
};

// Obtener subcategorías de una categoría
exports.getSubcategories = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const [subcategories] = await db.query(
      'SELECT * FROM subcategorias WHERE categoria_id = ? AND activo = true ORDER BY orden, nombre',
      [categoryId]
    );

    res.json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error('Error al obtener subcategorías:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener subcategorías',
      error: error.message 
    });
  }
};

// Actualizar categoría
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, icono, orden, activo } = req.body;

    const updates = [];
    const values = [];

    if (nombre !== undefined) {
      updates.push('nombre = ?');
      values.push(nombre);
    }
    if (icono !== undefined) {
      updates.push('icono = ?');
      values.push(icono);
    }
    if (orden !== undefined) {
      updates.push('orden = ?');
      values.push(orden);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      values.push(activo);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No hay datos para actualizar' 
      });
    }

    values.push(id);

    await db.query(
      `UPDATE categorias SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar categoría',
      error: error.message 
    });
  }
};

// Actualizar subcategoría
exports.updateSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, orden, activo } = req.body;

    const updates = [];
    const values = [];

    if (nombre !== undefined) {
      updates.push('nombre = ?');
      values.push(nombre);
    }
    if (orden !== undefined) {
      updates.push('orden = ?');
      values.push(orden);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      values.push(activo);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No hay datos para actualizar' 
      });
    }

    values.push(id);

    await db.query(
      `UPDATE subcategorias SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Subcategoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar subcategoría:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar subcategoría',
      error: error.message 
    });
  }
};

// Eliminar categoría (soft delete)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'UPDATE categorias SET activo = false WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Categoría desactivada exitosamente'
    });
  } catch (error) {
    console.error('Error al desactivar categoría:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al desactivar categoría',
      error: error.message 
    });
  }
};

// Eliminar subcategoría (soft delete)
exports.deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'UPDATE subcategorias SET activo = false WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Subcategoría desactivada exitosamente'
    });
  } catch (error) {
    console.error('Error al desactivar subcategoría:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al desactivar subcategoría',
      error: error.message 
    });
  }
};
