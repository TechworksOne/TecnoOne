const db = require('../config/database');

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

// Obtener todas las categorías con sus subcategorías
exports.getAllCategories = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);

    const [categories] = await db.query(
      'SELECT * FROM categorias WHERE empresa_id = ? AND activo = true ORDER BY orden, nombre',
      [empresaId]
    );

    const [subcategories] = await db.query(
      'SELECT * FROM subcategorias WHERE empresa_id = ? AND activo = true ORDER BY orden, nombre',
      [empresaId]
    );

    const categoryStructure = {};
    categories.forEach(cat => {
      categoryStructure[cat.nombre] = subcategories
        .filter(sub => Number(sub.categoria_id) === Number(cat.id))
        .map(sub => sub.nombre);
    });

    res.json({
      success: true,
      data: {
        categories,
        subcategories,
        categoryStructure,
      },
    });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al obtener categorías',
      error: error.message,
    });
  }
};

// Crear nueva categoría
exports.createCategory = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { nombre, icono, orden } = req.body;

    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría es requerido',
      });
    }

    const [result] = await db.query(
      'INSERT INTO categorias (empresa_id, nombre, icono, orden) VALUES (?, ?, ?, ?)',
      [empresaId, nombre, icono || null, orden || 0]
    );

    const [[created]] = await db.query(
      'SELECT * FROM categorias WHERE id = ? AND empresa_id = ?',
      [result.insertId, empresaId]
    );

    res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: created,
    });
  } catch (error) {
    console.error('Error al crear categoría:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una categoría con ese nombre en esta empresa',
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al crear categoría',
      error: error.message,
    });
  }
};

// Crear nueva subcategoría
exports.createSubcategory = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { categoria_id, nombre, orden } = req.body;

    if (!categoria_id || !nombre) {
      return res.status(400).json({
        success: false,
        message: 'El ID de categoría y nombre son requeridos',
      });
    }

    const [[categoria]] = await db.query(
      'SELECT id FROM categorias WHERE id = ? AND empresa_id = ? AND activo = true',
      [categoria_id, empresaId]
    );

    if (!categoria) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada para esta empresa',
      });
    }

    const [result] = await db.query(
      'INSERT INTO subcategorias (empresa_id, categoria_id, nombre, orden) VALUES (?, ?, ?, ?)',
      [empresaId, categoria_id, nombre, orden || 0]
    );

    const [[created]] = await db.query(
      'SELECT * FROM subcategorias WHERE id = ? AND empresa_id = ?',
      [result.insertId, empresaId]
    );

    res.status(201).json({
      success: true,
      message: 'Subcategoría creada exitosamente',
      data: created,
    });
  } catch (error) {
    console.error('Error al crear subcategoría:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una subcategoría con ese nombre en esta categoría',
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al crear subcategoría',
      error: error.message,
    });
  }
};

// Obtener subcategorías de una categoría
exports.getSubcategories = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { categoryId } = req.params;

    const [subcategories] = await db.query(
      `SELECT s.*
       FROM subcategorias s
       INNER JOIN categorias c ON c.id = s.categoria_id AND c.empresa_id = s.empresa_id
       WHERE s.categoria_id = ?
         AND s.empresa_id = ?
         AND s.activo = true
         AND c.activo = true
       ORDER BY s.orden, s.nombre`,
      [categoryId, empresaId]
    );

    res.json({
      success: true,
      data: subcategories,
    });
  } catch (error) {
    console.error('Error al obtener subcategorías:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al obtener subcategorías',
      error: error.message,
    });
  }
};

// Actualizar categoría
exports.updateCategory = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
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
        message: 'No hay datos para actualizar',
      });
    }

    values.push(id, empresaId);

    const [result] = await db.query(
      `UPDATE categorias SET ${updates.join(', ')} WHERE id = ? AND empresa_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada para esta empresa',
      });
    }

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
    });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al actualizar categoría',
      error: error.message,
    });
  }
};

// Actualizar subcategoría
exports.updateSubcategory = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
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
        message: 'No hay datos para actualizar',
      });
    }

    values.push(id, empresaId);

    const [result] = await db.query(
      `UPDATE subcategorias SET ${updates.join(', ')} WHERE id = ? AND empresa_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subcategoría no encontrada para esta empresa',
      });
    }

    res.json({
      success: true,
      message: 'Subcategoría actualizada exitosamente',
    });
  } catch (error) {
    console.error('Error al actualizar subcategoría:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al actualizar subcategoría',
      error: error.message,
    });
  }
};

// Eliminar categoría (soft delete)
exports.deleteCategory = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;

    const [result] = await db.query(
      'UPDATE categorias SET activo = false WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada para esta empresa',
      });
    }

    res.json({
      success: true,
      message: 'Categoría desactivada exitosamente',
    });
  } catch (error) {
    console.error('Error al desactivar categoría:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al desactivar categoría',
      error: error.message,
    });
  }
};

// Eliminar subcategoría (soft delete)
exports.deleteSubcategory = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;

    const [result] = await db.query(
      'UPDATE subcategorias SET activo = false WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subcategoría no encontrada para esta empresa',
      });
    }

    res.json({
      success: true,
      message: 'Subcategoría desactivada exitosamente',
    });
  } catch (error) {
    console.error('Error al desactivar subcategoría:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al desactivar subcategoría',
      error: error.message,
    });
  }
};
