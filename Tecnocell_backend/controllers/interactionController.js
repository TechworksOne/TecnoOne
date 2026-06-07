const db = require('../config/database');

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true;
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? null;
}

function clienteTenantClause(req, alias = 'c') {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };

  return {
    sql: ` AND ${alias}.empresa_id = ?`,
    params: [getTenantEmpresaId(req)]
  };
}

async function validateClienteForTenant(connectionOrDb, clienteId, req) {
  const tenant = clienteTenantClause(req, 'c');
  const [clientes] = await connectionOrDb.query(
    `SELECT c.id, c.empresa_id
     FROM clientes c
     WHERE c.id = ? AND c.activo = true${tenant.sql}
     LIMIT 1`,
    [clienteId, ...tenant.params]
  );

  return clientes[0] || null;
}

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

    const cliente = await validateClienteForTenant(db, cliente_id, req);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
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

    const cliente = await validateClienteForTenant(db, cliente_id, req);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const tenant = clienteTenantClause(req, 'c');
    let query = `
      SELECT i.*, c.nombre, c.apellido 
      FROM interacciones_clientes i
      JOIN clientes c ON i.cliente_id = c.id
      WHERE i.cliente_id = ?${tenant.sql}
    `;
    const params = [cliente_id, ...tenant.params];

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

// Obtener resumen de cliente
const getCustomerSummary = async (req, res) => {
  try {
    const { cliente_id } = req.params;

    const cliente = await validateClienteForTenant(db, cliente_id, req);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const tenant = clienteTenantClause(req, 'c');
    const [summary] = await db.query(
      `SELECT
        c.id AS cliente_id,
        c.nombre,
        c.apellido,
        COUNT(i.id) AS total_interacciones,
        SUM(CASE WHEN i.tipo = 'cotizacion' THEN 1 ELSE 0 END) AS total_cotizaciones,
        SUM(CASE WHEN i.tipo = 'venta' THEN 1 ELSE 0 END) AS total_ventas,
        SUM(CASE WHEN i.tipo = 'reparacion' THEN 1 ELSE 0 END) AS total_reparaciones,
        SUM(CASE WHEN i.tipo = 'visita' THEN 1 ELSE 0 END) AS total_visitas,
        COALESCE(SUM(CASE WHEN i.tipo = 'venta' THEN i.monto ELSE 0 END), 0) AS total_gastado,
        MAX(i.created_at) AS ultima_interaccion
       FROM clientes c
       LEFT JOIN interacciones_clientes i ON c.id = i.cliente_id
       WHERE c.id = ? AND c.activo = true${tenant.sql}
       GROUP BY c.id, c.nombre, c.apellido`,
      [cliente_id, ...tenant.params]
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

    const tenant = clienteTenantClause(req, 'c');
    const conditions = [];
    const params = [];

    if (!isSuperadminTenant(req)) {
      conditions.push('c.empresa_id = ?');
      params.push(...tenant.params);
    }

    if (desde && hasta) {
      conditions.push('i.created_at BETWEEN ? AND ?');
      params.push(desde, hasta);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [stats] = await db.query(`
      SELECT 
        i.tipo,
        COUNT(*) as total,
        COALESCE(SUM(i.monto), 0) as monto_total,
        DATE(i.created_at) as fecha
      FROM interacciones_clientes i
      JOIN clientes c ON c.id = i.cliente_id
      ${whereClause}
      GROUP BY i.tipo, DATE(i.created_at)
      ORDER BY fecha DESC, i.tipo
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
