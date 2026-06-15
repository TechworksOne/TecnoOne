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

function handleError(res, error, message) {
  console.error(message + ':', error);

  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ error: 'Ya existe un registro con esos datos en esta empresa' });
  }

  return res.status(error.statusCode || 500).json({
    error: error.statusCode === 403 ? error.message : message,
  });
}

// ============================================
// CONTROLADOR DE MARCAS
// ============================================

exports.getAllMarcas = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { activo } = req.query;

    let query = 'SELECT * FROM marcas WHERE empresa_id = ?';
    const params = [empresaId];

    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    }

    query += ' ORDER BY nombre ASC';

    const [marcas] = await db.query(query, params);
    res.json(marcas);
  } catch (error) {
    return handleError(res, error, 'Error al obtener marcas');
  }
};

exports.getMarcaById = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;

    const [marcas] = await db.query(
      'SELECT * FROM marcas WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (marcas.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }

    res.json(marcas[0]);
  } catch (error) {
    return handleError(res, error, 'Error al obtener marca');
  }
};

exports.createMarca = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { nombre, descripcion, logo_url } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const [result] = await db.query(
      'INSERT INTO marcas (empresa_id, nombre, descripcion, logo_url) VALUES (?, ?, ?, ?)',
      [empresaId, nombre, descripcion || null, logo_url || null]
    );

    const [newMarca] = await db.query(
      'SELECT * FROM marcas WHERE id = ? AND empresa_id = ?',
      [result.insertId, empresaId]
    );

    res.status(201).json(newMarca[0]);
  } catch (error) {
    return handleError(res, error, 'Error al crear marca');
  }
};

exports.updateMarca = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;
    const { nombre, descripcion, logo_url, activo } = req.body;

    const updates = [];
    const params = [];

    if (nombre !== undefined) {
      updates.push('nombre = ?');
      params.push(nombre);
    }
    if (descripcion !== undefined) {
      updates.push('descripcion = ?');
      params.push(descripcion || null);
    }
    if (logo_url !== undefined) {
      updates.push('logo_url = ?');
      params.push(logo_url || null);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      params.push(activo !== false && activo !== 0 ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    params.push(id, empresaId);

    const [result] = await db.query(
      `UPDATE marcas SET ${updates.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }

    const [updated] = await db.query(
      'SELECT * FROM marcas WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    res.json(updated[0]);
  } catch (error) {
    return handleError(res, error, 'Error al actualizar marca');
  }
};

exports.deleteMarca = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;

    const [lineas] = await db.query(
      'SELECT COUNT(*) AS total FROM lineas WHERE marca_id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (lineas[0].total > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar la marca porque tiene líneas asociadas',
        total_lineas: lineas[0].total,
      });
    }

    const [result] = await db.query(
      'DELETE FROM marcas WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }

    res.json({ message: 'Marca eliminada exitosamente' });
  } catch (error) {
    return handleError(res, error, 'Error al eliminar marca');
  }
};

// ============================================
// CONTROLADOR DE LÍNEAS
// ============================================

exports.getAllLineas = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { marca_id, activo } = req.query;

    let query = 'SELECT * FROM lineas WHERE empresa_id = ?';
    const params = [empresaId];

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
    return handleError(res, error, 'Error al obtener líneas');
  }
};

exports.getLineasConMarca = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);

    const [lineas] = await db.query(
      `SELECT l.*, m.nombre AS marca_nombre
       FROM lineas l
       INNER JOIN marcas m
         ON m.id = l.marca_id
        AND m.empresa_id = l.empresa_id
       WHERE l.empresa_id = ?
       ORDER BY m.nombre ASC, l.nombre ASC`,
      [empresaId]
    );

    res.json(lineas);
  } catch (error) {
    return handleError(res, error, 'Error al obtener líneas con marca');
  }
};

exports.getLineasByMarca = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;
    const { activo } = req.query;

    let query = 'SELECT * FROM lineas WHERE marca_id = ? AND empresa_id = ?';
    const params = [id, empresaId];

    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    }

    query += ' ORDER BY nombre ASC';

    const [lineas] = await db.query(query, params);
    res.json(lineas);
  } catch (error) {
    return handleError(res, error, 'Error al obtener líneas por marca');
  }
};

exports.createLinea = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { marca_id, nombre, descripcion } = req.body;

    if (!marca_id || !nombre) {
      return res.status(400).json({ error: 'marca_id y nombre son requeridos' });
    }

    const [marcas] = await db.query(
      'SELECT id FROM marcas WHERE id = ? AND empresa_id = ?',
      [marca_id, empresaId]
    );

    if (marcas.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }

    const [result] = await db.query(
      'INSERT INTO lineas (empresa_id, marca_id, nombre, descripcion) VALUES (?, ?, ?, ?)',
      [empresaId, marca_id, nombre, descripcion || null]
    );

    const [newLinea] = await db.query(
      'SELECT * FROM lineas WHERE id = ? AND empresa_id = ?',
      [result.insertId, empresaId]
    );

    res.status(201).json(newLinea[0]);
  } catch (error) {
    return handleError(res, error, 'Error al crear línea');
  }
};

exports.updateLinea = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const updates = [];
    const params = [];

    if (nombre !== undefined) {
      updates.push('nombre = ?');
      params.push(nombre);
    }
    if (descripcion !== undefined) {
      updates.push('descripcion = ?');
      params.push(descripcion || null);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      params.push(activo !== false && activo !== 0 ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    params.push(id, empresaId);

    const [result] = await db.query(
      `UPDATE lineas SET ${updates.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Línea no encontrada' });
    }

    const [updated] = await db.query(
      'SELECT * FROM lineas WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    res.json(updated[0]);
  } catch (error) {
    return handleError(res, error, 'Error al actualizar línea');
  }
};

exports.deleteLinea = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);
    const { id } = req.params;

    const [result] = await db.query(
      'DELETE FROM lineas WHERE id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Línea no encontrada' });
    }

    res.json({ message: 'Línea eliminada exitosamente' });
  } catch (error) {
    return handleError(res, error, 'Error al eliminar línea');
  }
};

exports.getMarcasConLineas = async (req, res) => {
  try {
    const empresaId = requireTenantEmpresaId(req);

    const [marcas] = await db.query(
      `SELECT
         m.id,
         m.empresa_id,
         m.nombre,
         m.descripcion,
         m.logo_url,
         m.activo,
         m.created_at,
         m.updated_at,
         COUNT(l.id) AS total_lineas
       FROM marcas m
       LEFT JOIN lineas l
         ON l.marca_id = m.id
        AND l.empresa_id = m.empresa_id
       WHERE m.empresa_id = ?
       GROUP BY
         m.id,
         m.empresa_id,
         m.nombre,
         m.descripcion,
         m.logo_url,
         m.activo,
         m.created_at,
         m.updated_at
       ORDER BY m.nombre ASC`,
      [empresaId]
    );

    res.json(marcas);
  } catch (error) {
    return handleError(res, error, 'Error al obtener marcas con líneas');
  }
};
