const db = require('../config/database');

// ============================================
// CONTROLADOR DE MARCAS
// ============================================

/**
 * Obtener todas las marcas
 * GET /api/marcas
 */
exports.getAllMarcas = async (req, res) => {
  try {
    const { activo } = req.query;
    
    let query = 'SELECT * FROM marcas WHERE 1=1';
    const params = [];
    
    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY nombre ASC';
    
    const [marcas] = await db.query(query, params);
    res.json(marcas);
  } catch (error) {
    console.error('Error al obtener marcas:', error);
    res.status(500).json({ error: 'Error al obtener marcas' });
  }
};

/**
 * Obtener una marca por ID
 * GET /api/marcas/:id
 */
exports.getMarcaById = async (req, res) => {
  try {
    const { id } = req.params;
    const [marcas] = await db.query('SELECT * FROM marcas WHERE id = ?', [id]);
    
    if (marcas.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    
    res.json(marcas[0]);
  } catch (error) {
    console.error('Error al obtener marca:', error);
    res.status(500).json({ error: 'Error al obtener marca' });
  }
};

/**
 * Crear una nueva marca
 * POST /api/marcas
 */
exports.createMarca = async (req, res) => {
  try {
    const { nombre, descripcion, logo_url } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    
    const query = 'INSERT INTO marcas (nombre, descripcion, logo_url) VALUES (?, ?, ?)';
    const [result] = await db.query(query, [nombre, descripcion || null, logo_url || null]);
    
    const [newMarca] = await db.query('SELECT * FROM marcas WHERE id = ?', [result.insertId]);
    res.status(201).json(newMarca[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe una marca con ese nombre' });
    }
    console.error('Error al crear marca:', error);
    res.status(500).json({ error: 'Error al crear marca' });
  }
};

/**
 * Actualizar una marca
 * PUT /api/marcas/:id
 */
exports.updateMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, logo_url, activo } = req.body;
    
    const query = `
      UPDATE marcas 
      SET nombre = ?, descripcion = ?, logo_url = ?, activo = ?
      WHERE id = ?
    `;
    
    await db.query(query, [
      nombre, 
      descripcion || null, 
      logo_url || null, 
      activo !== false, 
      id
    ]);
    
    const [updated] = await db.query('SELECT * FROM marcas WHERE id = ?', [id]);
    
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    
    res.json(updated[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe una marca con ese nombre' });
    }
    console.error('Error al actualizar marca:', error);
    res.status(500).json({ error: 'Error al actualizar marca' });
  }
};

/**
 * Eliminar una marca
 * DELETE /api/marcas/:id
 */
exports.deleteMarca = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si tiene líneas asociadas
    const [lineas] = await db.query('SELECT COUNT(*) as total FROM lineas WHERE marca_id = ?', [id]);
    
    if (lineas[0].total > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la marca porque tiene líneas asociadas',
        total_lineas: lineas[0].total
      });
    }
    
    const [result] = await db.query('DELETE FROM marcas WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    
    res.json({ message: 'Marca eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar marca:', error);
    res.status(500).json({ error: 'Error al eliminar marca' });
  }
};

// ============================================
// CONTROLADOR DE LÍNEAS
// ============================================

/**
 * Obtener todas las líneas
 * GET /api/lineas
 */
exports.getAllLineas = async (req, res) => {
  try {
    const { marca_id, activo } = req.query;
    
    let query = 'SELECT * FROM lineas WHERE 1=1';
    const params = [];
    
    if (marca_id) {
      query += ' AND marca_id = ?';
      params.push(marca_id);
    }
    
    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY nombre ASC';
    
    const [lineas] = await db.query(query, params);
    res.json(lineas);
  } catch (error) {
    console.error('Error al obtener líneas:', error);
    res.status(500).json({ error: 'Error al obtener líneas' });
  }
};

/**
 * Obtener líneas con información de marca
 * GET /api/lineas/con-marca
 */
exports.getLineasConMarca = async (req, res) => {
  try {
    const [lineas] = await db.query('SELECT * FROM v_lineas_con_marca');
    res.json(lineas);
  } catch (error) {
    console.error('Error al obtener líneas con marca:', error);
    res.status(500).json({ error: 'Error al obtener líneas con marca' });
  }
};

/**
 * Obtener líneas por marca
 * GET /api/marcas/:id/lineas
 */
exports.getLineasByMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.query;
    
    let query = 'SELECT * FROM lineas WHERE marca_id = ?';
    const params = [id];
    
    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY nombre ASC';
    
    const [lineas] = await db.query(query, params);
    res.json(lineas);
  } catch (error) {
    console.error('Error al obtener líneas por marca:', error);
    res.status(500).json({ error: 'Error al obtener líneas por marca' });
  }
};

/**
 * Crear una nueva línea
 * POST /api/lineas
 */
exports.createLinea = async (req, res) => {
  try {
    const { marca_id, nombre, descripcion } = req.body;
    
    if (!marca_id || !nombre) {
      return res.status(400).json({ error: 'marca_id y nombre son requeridos' });
    }
    
    // Verificar que la marca existe
    const [marcas] = await db.query('SELECT id FROM marcas WHERE id = ?', [marca_id]);
    if (marcas.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    
    const query = 'INSERT INTO lineas (marca_id, nombre, descripcion) VALUES (?, ?, ?)';
    const [result] = await db.query(query, [marca_id, nombre, descripcion || null]);
    
    const [newLinea] = await db.query('SELECT * FROM lineas WHERE id = ?', [result.insertId]);
    res.status(201).json(newLinea[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe una línea con ese nombre para esta marca' });
    }
    console.error('Error al crear línea:', error);
    res.status(500).json({ error: 'Error al crear línea' });
  }
};

/**
 * Actualizar una línea
 * PUT /api/lineas/:id
 */
exports.updateLinea = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;
    
    const query = `
      UPDATE lineas 
      SET nombre = ?, descripcion = ?, activo = ?
      WHERE id = ?
    `;
    
    await db.query(query, [nombre, descripcion || null, activo !== false, id]);
    
    const [updated] = await db.query('SELECT * FROM lineas WHERE id = ?', [id]);
    
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Línea no encontrada' });
    }
    
    res.json(updated[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe una línea con ese nombre para esta marca' });
    }
    console.error('Error al actualizar línea:', error);
    res.status(500).json({ error: 'Error al actualizar línea' });
  }
};

/**
 * Eliminar una línea
 * DELETE /api/lineas/:id
 */
exports.deleteLinea = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await db.query('DELETE FROM lineas WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Línea no encontrada' });
    }
    
    res.json({ message: 'Línea eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar línea:', error);
    res.status(500).json({ error: 'Error al eliminar línea' });
  }
};

/**
 * Obtener marcas con conteo de líneas
 * GET /api/marcas/con-lineas
 */
exports.getMarcasConLineas = async (req, res) => {
  try {
    const [marcas] = await db.query('SELECT * FROM v_marcas_con_lineas');
    res.json(marcas);
  } catch (error) {
    console.error('Error al obtener marcas con líneas:', error);
    res.status(500).json({ error: 'Error al obtener marcas con líneas' });
  }
};
