// Controller para gestionar marcas y modelos de equipos
const db = require('../config/database');

// ========== MARCAS ==========

// Obtener todas las marcas activas
exports.getAllMarcas = async (req, res) => {
  try {
    const { tipo_equipo } = req.query;
    
    let query = 'SELECT * FROM equipos_marcas WHERE activo = 1';
    const params = [];
    
    if (tipo_equipo) {
      query += ' AND tipo_equipo = ?';
      params.push(tipo_equipo);
    }
    
    query += ' ORDER BY nombre ASC';
    
    const [marcas] = await db.query(query, params);
    
    res.json({
      success: true,
      data: marcas
    });
  } catch (error) {
    console.error('Error al obtener marcas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las marcas',
      error: error.message
    });
  }
};

// Crear nueva marca
exports.createMarca = async (req, res) => {
  try {
    const { nombre, tipo_equipo } = req.body;
    
    if (!nombre || !tipo_equipo) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y tipo de equipo son requeridos'
      });
    }
    
    const [result] = await db.query(
      'INSERT INTO equipos_marcas (nombre, tipo_equipo) VALUES (?, ?)',
      [nombre, tipo_equipo]
    );
    
    const [newMarca] = await db.query(
      'SELECT * FROM equipos_marcas WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Marca creada exitosamente',
      data: newMarca[0]
    });
  } catch (error) {
    console.error('Error al crear marca:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: `Ya existe la marca "${nombre}" para el tipo de equipo "${tipo_equipo}"`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al crear la marca',
      error: error.message
    });
  }
};

// Actualizar marca
exports.updateMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo_equipo, activo } = req.body;
    
    const updates = [];
    const params = [];
    
    if (nombre !== undefined) {
      updates.push('nombre = ?');
      params.push(nombre);
    }
    if (tipo_equipo !== undefined) {
      updates.push('tipo_equipo = ?');
      params.push(tipo_equipo);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      params.push(activo);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }
    
    params.push(id);
    
    await db.query(
      `UPDATE equipos_marcas SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    const [updatedMarca] = await db.query(
      'SELECT * FROM equipos_marcas WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Marca actualizada exitosamente',
      data: updatedMarca[0]
    });
  } catch (error) {
    console.error('Error al actualizar marca:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la marca',
      error: error.message
    });
  }
};

// Eliminar marca (soft delete)
exports.deleteMarca = async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query(
      'UPDATE equipos_marcas SET activo = 0 WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Marca desactivada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar marca:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la marca',
      error: error.message
    });
  }
};

// ========== MODELOS ==========

// Obtener modelos por marca
exports.getModelosByMarca = async (req, res) => {
  try {
    const { marca_id } = req.params;
    
    const [modelos] = await db.query(
      `SELECT m.*, mar.nombre as marca_nombre 
       FROM equipos_modelos m
       INNER JOIN equipos_marcas mar ON m.marca_id = mar.id
       WHERE m.marca_id = ? AND m.activo = 1
       ORDER BY m.nombre ASC`,
      [marca_id]
    );
    
    res.json({
      success: true,
      data: modelos
    });
  } catch (error) {
    console.error('Error al obtener modelos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los modelos',
      error: error.message
    });
  }
};

// Obtener todos los modelos
exports.getAllModelos = async (req, res) => {
  try {
    const [modelos] = await db.query(
      `SELECT m.*, mar.nombre as marca_nombre, mar.tipo_equipo
       FROM equipos_modelos m
       INNER JOIN equipos_marcas mar ON m.marca_id = mar.id
       WHERE m.activo = 1
       ORDER BY mar.nombre, m.nombre ASC`
    );
    
    res.json({
      success: true,
      data: modelos
    });
  } catch (error) {
    console.error('Error al obtener modelos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los modelos',
      error: error.message
    });
  }
};

// Crear nuevo modelo
exports.createModelo = async (req, res) => {
  try {
    const { marca_id, nombre } = req.body;
    
    if (!marca_id || !nombre) {
      return res.status(400).json({
        success: false,
        message: 'Marca y nombre del modelo son requeridos'
      });
    }
    
    const [result] = await db.query(
      'INSERT INTO equipos_modelos (marca_id, nombre) VALUES (?, ?)',
      [marca_id, nombre]
    );
    
    const [newModelo] = await db.query(
      `SELECT m.*, mar.nombre as marca_nombre 
       FROM equipos_modelos m
       INNER JOIN equipos_marcas mar ON m.marca_id = mar.id
       WHERE m.id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Modelo creado exitosamente',
      data: newModelo[0]
    });
  } catch (error) {
    console.error('Error al crear modelo:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un modelo con ese nombre para esta marca'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al crear el modelo',
      error: error.message
    });
  }
};

// Actualizar modelo
exports.updateModelo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, activo } = req.body;
    
    const updates = [];
    const params = [];
    
    if (nombre !== undefined) {
      updates.push('nombre = ?');
      params.push(nombre);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      params.push(activo);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }
    
    params.push(id);
    
    await db.query(
      `UPDATE equipos_modelos SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    const [updatedModelo] = await db.query(
      `SELECT m.*, mar.nombre as marca_nombre 
       FROM equipos_modelos m
       INNER JOIN equipos_marcas mar ON m.marca_id = mar.id
       WHERE m.id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Modelo actualizado exitosamente',
      data: updatedModelo[0]
    });
  } catch (error) {
    console.error('Error al actualizar modelo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el modelo',
      error: error.message
    });
  }
};

// Eliminar modelo (soft delete)
exports.deleteModelo = async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query(
      'UPDATE equipos_modelos SET activo = 0 WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Modelo desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar modelo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el modelo',
      error: error.message
    });
  }
};
