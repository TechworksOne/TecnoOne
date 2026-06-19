const db = require('../config/database');
const { parseLimit } = require('../utils/pagination');
const { validatePhone } = require('../utils/phoneValidation');

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

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

function supplierTenantClause(req, alias = 'p') {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { sql: ` AND ${prefix}empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

// Obtener todos los proveedores
exports.getAllSuppliers = async (req, res) => {
  try {
    const { search, activo, limit = 100 } = req.query;
    const tenant = supplierTenantClause(req, 'p');

    let query = `
      SELECT
        p.*,
        COUNT(DISTINCT c.id) as total_compras,
        MAX(c.fecha_compra) as ultima_compra
      FROM proveedores p
      LEFT JOIN compras c ON p.id = c.proveedor_id AND c.empresa_id = p.empresa_id
      WHERE 1=1${tenant.sql}
    `;

    const params = [...tenant.params];

    if (activo !== undefined) {
      query += ' AND p.activo = ?';
      const activoValue = activo === 'true' || activo === true;
      params.push(activoValue);
    }

    if (search) {
      query += ' AND (p.nombre LIKE ? OR p.contacto LIKE ? OR p.nit LIKE ? OR p.telefono LIKE ? OR p.email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' GROUP BY p.id ORDER BY p.nombre LIMIT ?';
    params.push(parseLimit(limit, { defaultLimit: 50, maxLimit: 100 }));

    const [suppliers] = await db.query(query, params);

    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al obtener proveedores',
      error: error.message
    });
  }
};

// Buscar proveedores
exports.searchSuppliers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un termino de busqueda'
      });
    }

    const tenant = supplierTenantClause(req, null);
    const searchPattern = `%${query}%`;
    const [suppliers] = await db.query(
      `SELECT * FROM proveedores
       WHERE activo = true${tenant.sql}
       AND (nombre LIKE ? OR contacto LIKE ? OR nit LIKE ? OR telefono LIKE ? OR email LIKE ?)
       ORDER BY nombre
       LIMIT 20`,
      [...tenant.params, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    );

    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('Error al buscar proveedores:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al buscar proveedores',
      error: error.message
    });
  }
};

// Obtener proveedor por ID
exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = supplierTenantClause(req, 'p');

    const [suppliers] = await db.query(
      `SELECT
        p.*,
        COUNT(DISTINCT c.id) as total_compras,
        MAX(c.fecha_compra) as ultima_compra,
        SUM(c.total) as monto_total_compras
      FROM proveedores p
      LEFT JOIN compras c ON p.id = c.proveedor_id AND c.empresa_id = p.empresa_id
      WHERE p.id = ?${tenant.sql}
      GROUP BY p.id`,
      [id, ...tenant.params]
    );

    if (suppliers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    res.json({
      success: true,
      data: suppliers[0]
    });
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al obtener proveedor',
      error: error.message
    });
  }
};

// Obtener compras de un proveedor
exports.getSupplierPurchases = async (req, res) => {
  try {
    const { id } = req.params;
    const supplierTenant = supplierTenantClause(req, null);

    const [suppliers] = await db.query(
      `SELECT id, empresa_id FROM proveedores WHERE id = ?${supplierTenant.sql} LIMIT 1`,
      [id, ...supplierTenant.params]
    );

    if (suppliers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    const empresaId = suppliers[0].empresa_id;
    const purchaseTenantSql = isSuperadminTenant(req) ? '' : ' AND c.empresa_id = ?';
    const purchaseParams = isSuperadminTenant(req) ? [id] : [id, empresaId];

    const [purchases] = await db.query(
      `SELECT
        c.id,
        c.numero_compra,
        c.fecha_compra,
        c.subtotal,
        c.impuestos,
        c.total,
        c.estado,
        c.notas,
        c.created_at,
        u.name as usuario_nombre,
        COUNT(ci.id) as total_items
      FROM compras c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN compra_items ci ON c.id = ci.compra_id AND ci.empresa_id = c.empresa_id
      WHERE c.proveedor_id = ?${purchaseTenantSql}
      GROUP BY c.id
      ORDER BY c.fecha_compra DESC
      LIMIT 50`,
      purchaseParams
    );

    res.json({
      success: true,
      data: purchases
    });
  } catch (error) {
    console.error('Error al obtener compras del proveedor:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al obtener compras del proveedor',
      error: error.message
    });
  }
};

// Crear proveedor
exports.createSupplier = async (req, res) => {
  try {
    const {
      nombre,
      contacto,
      telefono,
      email,
      direccion,
      nit,
      empresa,
      sitio_web,
      notas
    } = req.body;

    const telefonoValidado = validatePhone(telefono, {
      label: 'El teléfono del proveedor',
    });

    if (!telefonoValidado.ok) {
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const telefonoNormalizado = telefonoValidado.value;

    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del proveedor es requerido'
      });
    }

    const empresaId = requireTenantEmpresaId(req);
    const [result] = await db.query(
      `INSERT INTO proveedores
        (empresa_id, nombre, contacto, telefono, email, direccion, nit, empresa, sitio_web, notas, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [empresaId, nombre, contacto, telefonoNormalizado, email, direccion, nit, empresa, sitio_web, notas]
    );

    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al crear proveedor',
      error: error.message
    });
  }
};

// Actualizar proveedor
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      contacto,
      telefono,
      email,
      direccion,
      nit,
      empresa,
      sitio_web,
      notas,
      activo
    } = req.body;

    const telefonoValidado = validatePhone(telefono, {
      label: 'El teléfono del proveedor',
    });

    if (!telefonoValidado.ok) {
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const telefonoNormalizado = telefonoValidado.value;

    const updates = [];
    const values = [];

    if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
    if (contacto !== undefined) { updates.push('contacto = ?'); values.push(contacto); }
    if (telefono !== undefined) { updates.push('telefono = ?'); values.push(telefonoNormalizado); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (direccion !== undefined) { updates.push('direccion = ?'); values.push(direccion); }
    if (nit !== undefined) { updates.push('nit = ?'); values.push(nit); }
    if (empresa !== undefined) { updates.push('empresa = ?'); values.push(empresa); }
    if (sitio_web !== undefined) { updates.push('sitio_web = ?'); values.push(sitio_web); }
    if (notas !== undefined) { updates.push('notas = ?'); values.push(notas); }
    if (activo !== undefined) { updates.push('activo = ?'); values.push(activo); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
    }

    const tenant = supplierTenantClause(req, null);
    values.push(id, ...tenant.params);
    const [result] = await db.query(
      `UPDATE proveedores SET ${updates.join(', ')} WHERE id = ?${tenant.sql}`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Proveedor actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al actualizar proveedor',
      error: error.message
    });
  }
};

// Eliminar proveedor (soft delete)
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = supplierTenantClause(req, null);

    const [result] = await db.query(
      `UPDATE proveedores SET activo = false WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Proveedor desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Error al eliminar proveedor',
      error: error.message
    });
  }
};
