const db = require('../config/database');

/**
 * CONTROLADOR DE COTIZACIONES
 * Maneja todas las operaciones CRUD para cotizaciones de ventas y reparaciones
 */

// ============================================
// CREAR COTIZACIÓN
// ============================================
const createCotizacion = async (req, res) => {
  try {
    console.log('📥 Datos recibidos para crear cotización:', JSON.stringify(req.body, null, 2));
    
    const {
      cliente_id,
      cliente_nombre,
      cliente_telefono,
      cliente_email,
      cliente_nit,
      cliente_direccion,
      tipo,
      fecha_emision,
      vigencia_dias,
      items, // Array de objetos
      subtotal,
      impuestos,
      mano_de_obra,
      total,
      aplicar_impuestos,
      estado,
      observaciones,
      notas_internas
    } = req.body;

    // Validaciones
    if (!cliente_id || !cliente_nombre) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cliente es requerido' 
      });
    }

    if (!tipo || !['VENTA', 'REPARACION'].includes(tipo)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tipo de cotización inválido' 
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Debe incluir al menos un item' 
      });
    }

    // Convertir items a JSON string
    const itemsJson = JSON.stringify(items);

    // Insertar cotización
    const query = `
      INSERT INTO cotizaciones (
        cliente_id, cliente_nombre, cliente_telefono, cliente_email, 
        cliente_nit, cliente_direccion, tipo, fecha_emision, vigencia_dias,
        items, subtotal, impuestos, mano_de_obra, total, aplicar_impuestos,
        estado, observaciones, notas_internas, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      cliente_id,
      cliente_nombre,
      cliente_telefono || null,
      cliente_email || null,
      cliente_nit || null,
      cliente_direccion || null,
      tipo,
      fecha_emision || new Date().toISOString().split('T')[0],
      vigencia_dias || 15,
      itemsJson,
      subtotal || 0,
      impuestos || 0,
      mano_de_obra || 0,
      total || 0,
      aplicar_impuestos || false,
      estado || 'BORRADOR',
      observaciones || null,
      notas_internas || null,
      req.user ? req.user.id : null
    ];

    const [result] = await db.execute(query, values);

    // Obtener cotización creada con el número generado
    const [cotizacion] = await db.execute(
      'SELECT * FROM cotizaciones WHERE id = ?',
      [result.insertId]
    );

    console.log('✅ Cotización creada:', cotizacion[0]);

    res.status(201).json({
      success: true,
      message: 'Cotización creada exitosamente',
      data: cotizacion[0]
    });
  } catch (error) {
    console.error('❌ Error al crear cotización:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear cotización',
      error: error.message
    });
  }
};

// ============================================
// OBTENER TODAS LAS COTIZACIONES
// ============================================
const getAllCotizaciones = async (req, res) => {
  try {
    const { tipo, estado, cliente_id, desde, hasta, page = 1, limit = 20 } = req.query;
    
    let query = 'SELECT * FROM cotizaciones WHERE 1=1';
    const values = [];

    // Filtros opcionales
    if (tipo) {
      query += ' AND tipo = ?';
      values.push(tipo);
    }

    if (estado) {
      query += ' AND estado = ?';
      values.push(estado);
    }

    if (cliente_id) {
      query += ' AND cliente_id = ?';
      values.push(cliente_id);
    }

    if (desde) {
      query += ' AND fecha_emision >= ?';
      values.push(desde);
    }

    if (hasta) {
      query += ' AND fecha_emision <= ?';
      values.push(hasta);
    }

    query += ' ORDER BY created_at DESC';

    // Paginación
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    values.push(parseInt(limit), parseInt(offset));

    const [cotizaciones] = await db.execute(query, values);

    // Contar total para paginación
    let countQuery = 'SELECT COUNT(*) as total FROM cotizaciones WHERE 1=1';
    const countValues = values.slice(0, -2); // Remover LIMIT y OFFSET

    if (tipo) countQuery += ' AND tipo = ?';
    if (estado) countQuery += ' AND estado = ?';
    if (cliente_id) countQuery += ' AND cliente_id = ?';
    if (desde) countQuery += ' AND fecha_emision >= ?';
    if (hasta) countQuery += ' AND fecha_emision <= ?';

    const [countResult] = await db.execute(countQuery, countValues);

    res.json({
      success: true,
      data: cotizaciones,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Error al obtener cotizaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cotizaciones',
      error: error.message
    });
  }
};

// ============================================
// OBTENER COTIZACIÓN POR ID
// ============================================
const getCotizacionById = async (req, res) => {
  try {
    const { id } = req.params;

    const [cotizaciones] = await db.execute(
      'SELECT * FROM cotizaciones WHERE id = ?',
      [id]
    );

    if (cotizaciones.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cotización no encontrada'
      });
    }

    res.json({
      success: true,
      data: cotizaciones[0]
    });
  } catch (error) {
    console.error('❌ Error al obtener cotización:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cotización',
      error: error.message
    });
  }
};

// ============================================
// ACTUALIZAR COTIZACIÓN
// ============================================
const updateCotizacion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cliente_nombre,
      cliente_telefono,
      cliente_email,
      cliente_nit,
      cliente_direccion,
      tipo,
      fecha_emision,
      vigencia_dias,
      items,
      subtotal,
      impuestos,
      mano_de_obra,
      total,
      aplicar_impuestos,
      estado,
      observaciones,
      notas_internas
    } = req.body;

    console.log('📝 Actualizando cotización:', id);

    // Verificar que la cotización existe
    const [existing] = await db.execute(
      'SELECT * FROM cotizaciones WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cotización no encontrada'
      });
    }

    // Validar que no se pueda editar una cotización convertida
    if (existing[0].estado === 'CONVERTIDA') {
      return res.status(400).json({
        success: false,
        message: 'No se puede editar una cotización ya convertida'
      });
    }

    const itemsJson = items ? JSON.stringify(items) : existing[0].items;

    const query = `
      UPDATE cotizaciones SET
        cliente_nombre = ?,
        cliente_telefono = ?,
        cliente_email = ?,
        cliente_nit = ?,
        cliente_direccion = ?,
        tipo = ?,
        fecha_emision = ?,
        vigencia_dias = ?,
        items = ?,
        subtotal = ?,
        impuestos = ?,
        mano_de_obra = ?,
        total = ?,
        aplicar_impuestos = ?,
        estado = ?,
        observaciones = ?,
        notas_internas = ?,
        updated_by = ?
      WHERE id = ?
    `;

    const values = [
      cliente_nombre || existing[0].cliente_nombre,
      cliente_telefono !== undefined ? cliente_telefono : existing[0].cliente_telefono,
      cliente_email !== undefined ? cliente_email : existing[0].cliente_email,
      cliente_nit !== undefined ? cliente_nit : existing[0].cliente_nit,
      cliente_direccion !== undefined ? cliente_direccion : existing[0].cliente_direccion,
      tipo || existing[0].tipo,
      fecha_emision || existing[0].fecha_emision,
      vigencia_dias !== undefined ? vigencia_dias : existing[0].vigencia_dias,
      itemsJson,
      subtotal !== undefined ? subtotal : existing[0].subtotal,
      impuestos !== undefined ? impuestos : existing[0].impuestos,
      mano_de_obra !== undefined ? mano_de_obra : existing[0].mano_de_obra,
      total !== undefined ? total : existing[0].total,
      aplicar_impuestos !== undefined ? aplicar_impuestos : existing[0].aplicar_impuestos,
      estado || existing[0].estado,
      observaciones !== undefined ? observaciones : existing[0].observaciones,
      notas_internas !== undefined ? notas_internas : existing[0].notas_internas,
      req.user ? req.user.id : null,
      id
    ];

    await db.execute(query, values);

    // Obtener cotización actualizada
    const [updated] = await db.execute(
      'SELECT * FROM cotizaciones WHERE id = ?',
      [id]
    );

    console.log('✅ Cotización actualizada');

    res.json({
      success: true,
      message: 'Cotización actualizada exitosamente',
      data: updated[0]
    });
  } catch (error) {
    console.error('❌ Error al actualizar cotización:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cotización',
      error: error.message
    });
  }
};

// ============================================
// ELIMINAR COTIZACIÓN (SOFT DELETE)
// ============================================
const deleteCotizacion = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const [existing] = await db.execute(
      'SELECT * FROM cotizaciones WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cotización no encontrada'
      });
    }

    // No permitir eliminar cotizaciones convertidas
    if (existing[0].estado === 'CONVERTIDA') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar una cotización convertida'
      });
    }

    // Eliminar físicamente (o podrías hacer soft delete agregando campo 'activo')
    await db.execute('DELETE FROM cotizaciones WHERE id = ?', [id]);

    console.log('🗑️ Cotización eliminada:', id);

    res.json({
      success: true,
      message: 'Cotización eliminada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al eliminar cotización:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar cotización',
      error: error.message
    });
  }
};

// ============================================
// CAMBIAR ESTADO DE COTIZACIÓN
// ============================================
const cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'VENCIDA', 'CONVERTIDA'];
    
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    await db.execute(
      'UPDATE cotizaciones SET estado = ?, updated_by = ? WHERE id = ?',
      [estado, req.user ? req.user.id : null, id]
    );

    console.log(`🔄 Estado de cotización ${id} cambiado a: ${estado}`);

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al cambiar estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado',
      error: error.message
    });
  }
};

// ============================================
// OBTENER COTIZACIONES PRÓXIMAS A VENCER
// ============================================
const getCotizacionesProximasVencer = async (req, res) => {
  try {
    const { dias = 7 } = req.query;

    const [cotizaciones] = await db.execute(
      'CALL sp_cotizaciones_proximas_vencer(?)',
      [parseInt(dias)]
    );

    res.json({
      success: true,
      data: cotizaciones[0]
    });
  } catch (error) {
    console.error('❌ Error al obtener cotizaciones próximas a vencer:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cotizaciones',
      error: error.message
    });
  }
};

// ============================================
// OBTENER ESTADÍSTICAS DE COTIZACIONES
// ============================================
const getEstadisticas = async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'BORRADOR' THEN 1 ELSE 0 END) as borradores,
        SUM(CASE WHEN estado = 'ENVIADA' THEN 1 ELSE 0 END) as enviadas,
        SUM(CASE WHEN estado = 'APROBADA' THEN 1 ELSE 0 END) as aprobadas,
        SUM(CASE WHEN estado = 'RECHAZADA' THEN 1 ELSE 0 END) as rechazadas,
        SUM(CASE WHEN estado = 'VENCIDA' THEN 1 ELSE 0 END) as vencidas,
        SUM(CASE WHEN estado = 'CONVERTIDA' THEN 1 ELSE 0 END) as convertidas,
        SUM(total) as monto_total,
        SUM(CASE WHEN estado = 'CONVERTIDA' THEN total ELSE 0 END) as monto_convertido,
        ROUND(SUM(CASE WHEN estado = 'CONVERTIDA' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as tasa_conversion
      FROM cotizaciones
      WHERE 1=1
    `;

    const values = [];

    if (desde) {
      query += ' AND fecha_emision >= ?';
      values.push(desde);
    }

    if (hasta) {
      query += ' AND fecha_emision <= ?';
      values.push(hasta);
    }

    const [stats] = await db.execute(query, values);

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

module.exports = {
  createCotizacion,
  getAllCotizaciones,
  getCotizacionById,
  updateCotizacion,
  deleteCotizacion,
  cambiarEstado,
  getCotizacionesProximasVencer,
  getEstadisticas
};
