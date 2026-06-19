const db = require('../config/database');
const { parsePagination } = require('../utils/pagination');
const { validatePhone } = require('../utils/phoneValidation');

/**
 * CONTROLADOR DE COTIZACIONES
 * Maneja operaciones CRUD para cotizaciones de ventas y reparaciones.
 */

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? null;
}

function requireTenantEmpresaId(req) {
  const empresaId = getTenantEmpresaId(req);
  if (empresaId === null || empresaId === undefined) {
    const error = new Error('Empresa no asignada al usuario');
    error.statusCode = 403;
    throw error;
  }
  return empresaId;
}

function cotizacionTenantClause(req, alias = null) {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { sql: ` AND ${prefix}empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

async function validateClienteForCotizacion(clienteId, empresaId) {
  if (clienteId === undefined || clienteId === null || clienteId === '') return true;

  const [clientes] = await db.execute(
    'SELECT id FROM clientes WHERE id = ? AND empresa_id = ? AND activo = true LIMIT 1',
    [clienteId, empresaId]
  );

  return clientes.length > 0;
}

function sendError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: error.statusCode ? error.message : fallbackMessage,
    error: error.message
  });
}

// ============================================
// CREAR COTIZACION
// ============================================
const createCotizacion = async (req, res) => {
  try {
    console.log('Datos recibidos para crear cotizacion:', JSON.stringify(req.body, null, 2));

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

    const telefonoValidado = validatePhone(cliente_telefono, {
      label: 'El teléfono del cliente',
    });

    if (!telefonoValidado.ok) {
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const clienteTelefonoNormalizado = telefonoValidado.value;

    if (!cliente_id || !cliente_nombre) {
      return res.status(400).json({
        success: false,
        message: 'Cliente es requerido'
      });
    }

    if (!tipo || !['VENTA', 'REPARACION'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de cotizacion invalido'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe incluir al menos un item'
      });
    }

    const empresaId = requireTenantEmpresaId(req);
    const clienteValido = await validateClienteForCotizacion(cliente_id, empresaId);
    if (!clienteValido) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const itemsJson = JSON.stringify(items);

    const query = `
      INSERT INTO cotizaciones (
        empresa_id, cliente_id, cliente_nombre, cliente_telefono, cliente_email,
        cliente_nit, cliente_direccion, tipo, fecha_emision, vigencia_dias,
        items, subtotal, impuestos, mano_de_obra, total, aplicar_impuestos,
        estado, observaciones, notas_internas, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      empresaId,
      cliente_id,
      cliente_nombre,
      clienteTelefonoNormalizado,
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
    const [cotizacion] = await db.execute(
      'SELECT * FROM cotizaciones WHERE id = ? AND empresa_id = ?',
      [result.insertId, empresaId]
    );

    console.log('Cotizacion creada:', cotizacion[0]);

    res.status(201).json({
      success: true,
      message: 'Cotizacion creada exitosamente',
      data: cotizacion[0]
    });
  } catch (error) {
    console.error('Error al crear cotizacion:', error);
    return sendError(res, error, 'Error al crear cotizacion');
  }
};

// ============================================
// OBTENER TODAS LAS COTIZACIONES
// ============================================
const getAllCotizaciones = async (req, res) => {
  try {
    const { tipo, estado, cliente_id, desde, hasta, page = 1, limit = 20 } = req.query;
    const tenant = cotizacionTenantClause(req);

    let query = 'SELECT * FROM cotizaciones WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM cotizaciones WHERE 1=1';
    const values = [...tenant.params];
    const countValues = [...tenant.params];

    query += tenant.sql;
    countQuery += tenant.sql;

    if (tipo) {
      query += ' AND tipo = ?';
      countQuery += ' AND tipo = ?';
      values.push(tipo);
      countValues.push(tipo);
    }

    if (estado) {
      query += ' AND estado = ?';
      countQuery += ' AND estado = ?';
      values.push(estado);
      countValues.push(estado);
    }

    if (cliente_id) {
      query += ' AND cliente_id = ?';
      countQuery += ' AND cliente_id = ?';
      values.push(cliente_id);
      countValues.push(cliente_id);
    }

    if (desde) {
      query += ' AND fecha_emision >= ?';
      countQuery += ' AND fecha_emision >= ?';
      values.push(desde);
      countValues.push(desde);
    }

    if (hasta) {
      query += ' AND fecha_emision <= ?';
      countQuery += ' AND fecha_emision <= ?';
      values.push(hasta);
      countValues.push(hasta);
    }

    query += ' ORDER BY created_at DESC';

    const { page: pageNum, limit: limitNum, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    query += ' LIMIT ? OFFSET ?';
    values.push(limitNum, offset);

    const [cotizaciones] = await db.execute(query, values);
    const [countResult] = await db.execute(countQuery, countValues);

    res.json({
      success: true,
      data: cotizaciones,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error al obtener cotizaciones:', error);
    return sendError(res, error, 'Error al obtener cotizaciones');
  }
};

// ============================================
// OBTENER COTIZACION POR ID
// ============================================
const getCotizacionById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = cotizacionTenantClause(req);

    const [cotizaciones] = await db.execute(
      `SELECT * FROM cotizaciones WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (cotizaciones.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cotizacion no encontrada'
      });
    }

    res.json({
      success: true,
      data: cotizaciones[0]
    });
  } catch (error) {
    console.error('Error al obtener cotizacion:', error);
    return sendError(res, error, 'Error al obtener cotizacion');
  }
};

// ============================================
// ACTUALIZAR COTIZACION
// ============================================
const updateCotizacion = async (req, res) => {
  try {
    const { id } = req.params;
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

    console.log('Actualizando cotizacion:', id);

    const tenant = cotizacionTenantClause(req);
    const [existing] = await db.execute(
      `SELECT * FROM cotizaciones WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cotizacion no encontrada'
      });
    }

    if (existing[0].estado === 'CONVERTIDA') {
      return res.status(400).json({
        success: false,
        message: 'No se puede editar una cotizacion ya convertida'
      });
    }

    const telefonoFinal =
      cliente_telefono !== undefined
        ? cliente_telefono
        : existing[0].cliente_telefono;

    const telefonoValidado = validatePhone(telefonoFinal, {
      label: 'El teléfono del cliente',
    });

    if (!telefonoValidado.ok) {
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const clienteTelefonoNormalizado = telefonoValidado.value;

    const empresaId = existing[0].empresa_id ?? requireTenantEmpresaId(req);
    const clienteFinal = cliente_id !== undefined ? cliente_id : existing[0].cliente_id;
    const clienteValido = await validateClienteForCotizacion(clienteFinal, empresaId);
    if (!clienteValido) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const itemsJson = items ? JSON.stringify(items) : existing[0].items;
    const updateTenant = cotizacionTenantClause(req);

    const query = `
      UPDATE cotizaciones SET
        cliente_id = ?,
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
      WHERE id = ?${updateTenant.sql}
    `;

    const values = [
      clienteFinal,
      cliente_nombre || existing[0].cliente_nombre,
      clienteTelefonoNormalizado,
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
      id,
      ...updateTenant.params
    ];

    await db.execute(query, values);

    const [updated] = await db.execute(
      `SELECT * FROM cotizaciones WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    console.log('Cotizacion actualizada');

    res.json({
      success: true,
      message: 'Cotizacion actualizada exitosamente',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error al actualizar cotizacion:', error);
    return sendError(res, error, 'Error al actualizar cotizacion');
  }
};

// ============================================
// ELIMINAR COTIZACION
// ============================================
const deleteCotizacion = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = cotizacionTenantClause(req);

    const [existing] = await db.execute(
      `SELECT * FROM cotizaciones WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cotizacion no encontrada'
      });
    }

    if (existing[0].estado === 'CONVERTIDA') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar una cotizacion convertida'
      });
    }

    await db.execute(
      `DELETE FROM cotizaciones WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    console.log('Cotizacion eliminada:', id);

    res.json({
      success: true,
      message: 'Cotizacion eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar cotizacion:', error);
    return sendError(res, error, 'Error al eliminar cotizacion');
  }
};

// ============================================
// CAMBIAR ESTADO DE COTIZACION
// ============================================
const cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'VENCIDA', 'CONVERTIDA'];

    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado invalido'
      });
    }

    const tenant = cotizacionTenantClause(req);
    const [result] = await db.execute(
      `UPDATE cotizaciones SET estado = ?, updated_by = ? WHERE id = ?${tenant.sql}`,
      [estado, req.user ? req.user.id : null, id, ...tenant.params]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cotizacion no encontrada'
      });
    }

    console.log(`Estado de cotizacion ${id} cambiado a: ${estado}`);

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    return sendError(res, error, 'Error al cambiar estado');
  }
};

// ============================================
// OBTENER COTIZACIONES PROXIMAS A VENCER
// ============================================
const getCotizacionesProximasVencer = async (req, res) => {
  try {
    const { dias = 7 } = req.query;
    const tenant = cotizacionTenantClause(req, 'cot');

    const [cotizaciones] = await db.execute(
      `SELECT
        cot.id,
        cot.numero_cotizacion,
        cot.cliente_nombre,
        cot.cliente_telefono,
        cot.fecha_emision,
        cot.fecha_vencimiento,
        DATEDIFF(cot.fecha_vencimiento, CURDATE()) AS dias_restantes,
        cot.total,
        cot.estado
      FROM cotizaciones cot
      WHERE cot.estado IN ('ENVIADA', 'BORRADOR')
        AND cot.fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ${tenant.sql}
      ORDER BY cot.fecha_vencimiento ASC`,
      [parseInt(dias), ...tenant.params]
    );

    res.json({
      success: true,
      data: cotizaciones
    });
  } catch (error) {
    console.error('Error al obtener cotizaciones proximas a vencer:', error);
    return sendError(res, error, 'Error al obtener cotizaciones');
  }
};

// ============================================
// OBTENER ESTADISTICAS DE COTIZACIONES
// ============================================
const getEstadisticas = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const tenant = cotizacionTenantClause(req);

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

    const values = [...tenant.params];
    query += tenant.sql;

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
    console.error('Error al obtener estadisticas:', error);
    return sendError(res, error, 'Error al obtener estadisticas');
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
