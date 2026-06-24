// Controller para gestionar marcas y modelos de equipos
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

// ========== MARCAS ==========

// Obtener todas las marcas activas por empresa
exports.getAllMarcas = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { tipo_equipo } = req.query;

    let query = 'SELECT * FROM equipos_marcas WHERE empresa_id = ? AND activo = 1';
    const params = [empresaId];

    if (tipo_equipo) {
      query += ' AND tipo_equipo = ?';
      params.push(tipo_equipo);
    }

    query += ' ORDER BY nombre ASC';

    const [marcas] = await db.query(query, params);

    res.json({
      success: true,
      data: marcas,
    });
  } catch (error) {
    console.error('Error al obtener marcas:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al obtener las marcas',
      error: error.message,
    });
  }
};

// Crear nueva marca
exports.createMarca = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { nombre, tipo_equipo } = req.body;

    if (!nombre || !tipo_equipo) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y tipo de equipo son requeridos',
      });
    }

    const [result] = await db.query(
      'INSERT INTO equipos_marcas (empresa_id, nombre, tipo_equipo) VALUES (?, ?, ?)',
      [empresaId, nombre, tipo_equipo]
    );

    const [[newMarca]] = await db.query(
      'SELECT * FROM equipos_marcas WHERE id = ? AND empresa_id = ?',
      [result.insertId, empresaId]
    );

    res.status(201).json({
      success: true,
      message: 'Marca creada exitosamente',
      data: newMarca,
    });
  } catch (error) {
    console.error('Error al crear marca:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe esa marca para ese tipo de equipo en esta empresa',
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al crear la marca',
      error: error.message,
    });
  }
};

// Actualizar marca
exports.updateMarca = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
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
        message: 'No hay campos para actualizar',
      });
    }

    params.push(id, empresaId);

    const [result] = await db.query(
      `UPDATE equipos_marcas SET ${updates.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Marca no encontrada para esta empresa',
      });
    }

    const [[updatedMarca]] = await db.query(
      'SELECT * FROM equipos_marcas WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    res.json({
      success: true,
      message: 'Marca actualizada exitosamente',
      data: updatedMarca,
    });
  } catch (error) {
    console.error('Error al actualizar marca:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe esa marca para ese tipo de equipo en esta empresa',
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al actualizar la marca',
      error: error.message,
    });
  }
};

// Eliminar marca (soft delete)
exports.deleteMarca = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;

    const [result] = await db.query(
      'UPDATE equipos_marcas SET activo = 0 WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Marca no encontrada para esta empresa',
      });
    }

    res.json({
      success: true,
      message: 'Marca desactivada exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar marca:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al eliminar la marca',
      error: error.message,
    });
  }
};

// ========== MODELOS ==========

// Obtener modelos por marca
exports.getModelosByMarca = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { marca_id } = req.params;

    const [modelos] = await db.query(
      `SELECT m.*, mar.nombre AS marca_nombre
       FROM equipos_modelos m
       INNER JOIN equipos_marcas mar
         ON m.marca_id = mar.id
        AND m.empresa_id = mar.empresa_id
       WHERE m.marca_id = ?
         AND m.empresa_id = ?
         AND mar.empresa_id = ?
         AND m.activo = 1
       ORDER BY m.nombre ASC`,
      [marca_id, empresaId, empresaId]
    );

    res.json({
      success: true,
      data: modelos,
    });
  } catch (error) {
    console.error('Error al obtener modelos:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al obtener los modelos',
      error: error.message,
    });
  }
};

// Obtener todos los modelos
exports.getAllModelos = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);

    const [modelos] = await db.query(
      `SELECT m.*, mar.nombre AS marca_nombre, mar.tipo_equipo
       FROM equipos_modelos m
       INNER JOIN equipos_marcas mar
         ON m.marca_id = mar.id
        AND m.empresa_id = mar.empresa_id
       WHERE m.empresa_id = ?
         AND mar.empresa_id = ?
         AND m.activo = 1
       ORDER BY mar.nombre, m.nombre ASC`,
      [empresaId, empresaId]
    );

    res.json({
      success: true,
      data: modelos,
    });
  } catch (error) {
    console.error('Error al obtener modelos:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al obtener los modelos',
      error: error.message,
    });
  }
};

// Crear nuevo modelo
exports.createModelo = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { marca_id, nombre } = req.body;

    if (!marca_id || !nombre) {
      return res.status(400).json({
        success: false,
        message: 'Marca y nombre del modelo son requeridos',
      });
    }

    const [[marca]] = await db.query(
      'SELECT id FROM equipos_marcas WHERE id = ? AND empresa_id = ? AND activo = 1',
      [marca_id, empresaId]
    );

    if (!marca) {
      return res.status(404).json({
        success: false,
        message: 'Marca no encontrada para esta empresa',
      });
    }

    const [result] = await db.query(
      'INSERT INTO equipos_modelos (empresa_id, marca_id, nombre) VALUES (?, ?, ?)',
      [empresaId, marca_id, nombre]
    );

    const [[newModelo]] = await db.query(
      `SELECT m.*, mar.nombre AS marca_nombre
       FROM equipos_modelos m
       INNER JOIN equipos_marcas mar
         ON m.marca_id = mar.id
        AND m.empresa_id = mar.empresa_id
       WHERE m.id = ?
         AND m.empresa_id = ?`,
      [result.insertId, empresaId]
    );

    res.status(201).json({
      success: true,
      message: 'Modelo creado exitosamente',
      data: newModelo,
    });
  } catch (error) {
    console.error('Error al crear modelo:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un modelo con ese nombre para esta marca en esta empresa',
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al crear el modelo',
      error: error.message,
    });
  }
};

// Actualizar modelo
exports.updateModelo = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
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
        message: 'No hay campos para actualizar',
      });
    }

    params.push(id, empresaId);

    const [result] = await db.query(
      `UPDATE equipos_modelos SET ${updates.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Modelo no encontrado para esta empresa',
      });
    }

    const [[updatedModelo]] = await db.query(
      `SELECT m.*, mar.nombre AS marca_nombre
       FROM equipos_modelos m
       INNER JOIN equipos_marcas mar
         ON m.marca_id = mar.id
        AND m.empresa_id = mar.empresa_id
       WHERE m.id = ?
         AND m.empresa_id = ?`,
      [id, empresaId]
    );

    res.json({
      success: true,
      message: 'Modelo actualizado exitosamente',
      data: updatedModelo,
    });
  } catch (error) {
    console.error('Error al actualizar modelo:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un modelo con ese nombre para esta marca en esta empresa',
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al actualizar el modelo',
      error: error.message,
    });
  }
};

// Eliminar modelo (soft delete)
exports.deleteModelo = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;

    const [result] = await db.query(
      'UPDATE equipos_modelos SET activo = 0 WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Modelo no encontrado para esta empresa',
      });
    }

    res.json({
      success: true,
      message: 'Modelo desactivado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar modelo:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 403 ? error.message : 'Error al eliminar el modelo',
      error: error.message,
    });
  }
};
