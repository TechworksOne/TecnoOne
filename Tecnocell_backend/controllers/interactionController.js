const db = require('../config/database');

// Registrar nueva interacción
const createInteraction = async (req, res) => {
  try {
    const { cliente_id, tipo, referencia_id, monto, notas } = req.body;
    const created_by = req.user?.id || null;

    if (!cliente_id || !tipo) {
      return res.status(400).json({
        success: false,
        message: 'cliente_id y tipo son requeridos'
      });
    }

    const [result] = await db.query(
      `INSERT INTO interacciones_clientes (cliente_id, tipo, referencia_id, monto, notas, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cliente_id, tipo, referencia_id || null, monto || null, notas || null, created_by]
    );

    res.status(201).json({
      success: true,
      message: 'Interacción registrada exitosamente',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Error al crear interacción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear interacción',
      error: error.message
    });
  }
};

// Obtener interacciones de un cliente
const getCustomerInteractions = async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const { tipo } = req.query;

    let query = `
      SELECT i.*, c.nombre, c.apellido 
      FROM interacciones_clientes i
      JOIN clientes c ON i.cliente_id = c.id
      WHERE i.cliente_id = ?
    `;
    const params = [cliente_id];

    if (tipo) {
      query += ' AND i.tipo = ?';
      params.push(tipo);
    }

    query += ' ORDER BY i.created_at DESC';

    const [interactions] = await db.query(query, params);

    res.json({
      success: true,
      data: interactions
    });
  } catch (error) {
    console.error('Error al obtener interacciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener interacciones'
    });
  }
};

// Obtener resumen de cliente (usando la vista)
const getCustomerSummary = async (req, res) => {
  try {
    const { cliente_id } = req.params;

    const [summary] = await db.query(
      'SELECT * FROM v_resumen_clientes WHERE cliente_id = ?',
      [cliente_id]
    );

    if (summary.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    res.json({
      success: true,
      data: summary[0]
    });
  } catch (error) {
    console.error('Error al obtener resumen:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen del cliente'
    });
  }
};

// Obtener estadísticas generales de interacciones
const getInteractionStats = async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    let dateFilter = '';
    const params = [];

    if (desde && hasta) {
      dateFilter = 'WHERE created_at BETWEEN ? AND ?';
      params.push(desde, hasta);
    }

    const [stats] = await db.query(`
      SELECT 
        tipo,
        COUNT(*) as total,
        COALESCE(SUM(monto), 0) as monto_total,
        DATE(created_at) as fecha
      FROM interacciones_clientes
      ${dateFilter}
      GROUP BY tipo, DATE(created_at)
      ORDER BY fecha DESC, tipo
    `, params);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};

module.exports = {
  createInteraction,
  getCustomerInteractions,
  getCustomerSummary,
  getInteractionStats
};
