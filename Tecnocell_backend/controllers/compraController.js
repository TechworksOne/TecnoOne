// Controller para gestionar compras de productos y repuestos
const db = require('../config/database');
const { parsePagination } = require('../utils/pagination');
const purchaseInventoryService = require('../services/purchaseInventoryService');
const repuestoInventoryService = require('../services/repuestoInventoryService');
const { validatePhone } = require('../utils/phoneValidation');
const tarjetaCtrl = require('./tarjetaCreditoController');
const auditoriaService = require('../services/auditoriaService');
const planAccess = require('../services/planAccessService');

async function auditarCompra(req, empresaId, compraId, numeroCompra, total, tipo, body) {
  await auditoriaService.registrar({
    req,
    empresaId,
    accion: 'CREAR',
    entidad: 'COMPRA',
    entidadId: compraId,
    descripcion: `Compra ${numeroCompra} creada`,
    datosNuevos: { ...body, id: compraId, numero_compra: numeroCompra, total, tipo },
  });
}

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getCompraEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? null;
}

function requireCompraEmpresaId(req) {
  const empresaId = getCompraEmpresaId(req);
  if (empresaId === null || empresaId === undefined || empresaId === '') {
    const error = new Error('empresaId requerido');
    error.statusCode = 403;
    throw error;
  }
  return empresaId;
}

function compraTenantClause(req, alias = null) {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { sql: ` AND ${prefix}empresa_id = ?`, params: [requireCompraEmpresaId(req)] };
}

function resolveCompraEmpresaId(options = {}) {
  const { req, empresaId } = options;
  if (empresaId !== undefined && empresaId !== null && empresaId !== '') return empresaId;
  if (req) return requireCompraEmpresaId(req);
  throw new Error('empresaId requerido');
}

async function validateProveedorForCompra(connection, proveedorId, empresaId) {
  if (proveedorId === undefined || proveedorId === null || proveedorId === '') return true;

  const [proveedores] = await connection.query(
    'SELECT id FROM proveedores WHERE id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [proveedorId, empresaId]
  );

  return proveedores.length > 0;
}


function compraHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function compraModuleError(moduleCode) {
  const error = compraHttpError(
    'Este modulo no esta incluido en el plan contratado.',
    403
  );
  error.code = 'MODULE_NOT_INCLUDED';
  error.module = moduleCode;
  return error;
}

function compraUsuario(req) {
  return String(
    req.user?.name ||
    req.user?.username ||
    req.user?.id ||
    'Sistema'
  );
}

async function aplicarPagoCompra(connection, {
  empresaId,
  metodoPago,
  tarjetaId,
  cuentaId,
  total,
  compraId,
  numeroCompra,
  req
}) {
  const monto = Math.round(Number(total) * 100) / 100;
  const usuario = compraUsuario(req);

  if (!Number.isFinite(monto) || monto <= 0) {
    throw compraHttpError('El total de la compra debe ser mayor que cero');
  }

  if (!['efectivo', 'transferencia', 'tarjeta_credito'].includes(metodoPago)) {
    throw compraHttpError('Método de pago inválido');
  }

  if (metodoPago === 'efectivo') {
    // Bloquea los movimientos de caja de la empresa durante la validación.
    await connection.query(
      'SELECT id FROM caja_chica WHERE empresa_id = ? FOR UPDATE',
      [empresaId]
    );

    const [[saldoRow]] = await connection.query(
      `SELECT COALESCE(
         SUM(
           CASE
             WHEN tipo_movimiento = 'INGRESO' THEN monto
             WHEN tipo_movimiento = 'EGRESO' THEN -monto
             ELSE 0
           END
         ),
         0
       ) AS saldo
       FROM caja_chica
       WHERE empresa_id = ?
         AND estado = 'CONFIRMADO'`,
      [empresaId]
    );

    const saldo = Number(saldoRow.saldo || 0);

    if (monto > saldo) {
      throw compraHttpError(
        `Saldo insuficiente en caja. Disponible: Q${saldo.toFixed(2)}`,
        409
      );
    }

    await connection.query(
      `INSERT INTO caja_chica
        (empresa_id, tipo_movimiento, monto, concepto, categoria,
         estado, realizado_por, observaciones, referencia_tipo, referencia_id)
       VALUES (?, 'EGRESO', ?, ?, 'Compra a proveedor',
               'CONFIRMADO', ?, ?, 'compra', ?)`,
      [
        empresaId,
        monto,
        `Pago en efectivo de compra ${numeroCompra}`,
        usuario,
        `Egreso automático generado por la compra ${numeroCompra}`,
        compraId
      ]
    );
  }

  if (metodoPago === 'transferencia') {
    if (!cuentaId) {
      throw compraHttpError('Debes seleccionar una cuenta bancaria');
    }

    const [cuentas] = await connection.query(
      `SELECT id, nombre, saldo_actual
       FROM cuentas_bancarias
       WHERE id = ?
         AND empresa_id = ?
         AND activa = TRUE
       LIMIT 1
       FOR UPDATE`,
      [cuentaId, empresaId]
    );

    if (!cuentas.length) {
      throw compraHttpError('Cuenta bancaria no encontrada o inactiva', 404);
    }

    const cuenta = cuentas[0];
    const saldo = Number(cuenta.saldo_actual || 0);

    if (monto > saldo) {
      throw compraHttpError(
        `Saldo insuficiente en ${cuenta.nombre}. Disponible: Q${saldo.toFixed(2)}`,
        409
      );
    }

    await connection.query(
      `INSERT INTO movimientos_bancarios
        (empresa_id, cuenta_id, tipo_movimiento, monto, concepto,
         categoria, estado, numero_referencia, realizado_por,
         observaciones, referencia_tipo, referencia_id)
       VALUES (?, ?, 'EGRESO', ?, ?, 'Compra a proveedor',
               'CONFIRMADO', ?, ?, ?, 'compra', ?)`,
      [
        empresaId,
        cuentaId,
        monto,
        `Pago por transferencia de compra ${numeroCompra}`,
        numeroCompra,
        usuario,
        `Egreso automático generado por la compra ${numeroCompra}`,
        compraId
      ]
    );

    const [updateResult] = await connection.query(
      `UPDATE cuentas_bancarias
       SET saldo_actual = saldo_actual - ?
       WHERE id = ?
         AND empresa_id = ?
         AND activa = TRUE
         AND saldo_actual >= ?`,
      [monto, cuentaId, empresaId, monto]
    );

    if (updateResult.affectedRows !== 1) {
      throw compraHttpError(
        'El saldo de la cuenta cambió durante la operación. Intenta nuevamente.',
        409
      );
    }
  }

  if (metodoPago === 'tarjeta_credito') {
    const tarjetasIncluidas = await planAccess.tieneModuloEmpresa(
      empresaId,
      'tarjetas',
      connection
    );

    if (!tarjetasIncluidas) {
      throw compraModuleError('tarjetas');
    }

    if (!tarjetaId) {
      throw compraHttpError('Debes seleccionar una tarjeta de crédito');
    }

    const montoCentavos = Math.round(monto * 100);

    await tarjetaCtrl.registrarCompra(
      connection,
      tarjetaId,
      montoCentavos,
      compraId,
      `Compra ${numeroCompra} pagada con tarjeta de crédito`,
      req.user?.id,
      empresaId
    );
  }

  await connection.query(
    `UPDATE compras
     SET metodo_pago = ?,
         tarjeta_id = ?,
         cuenta_id = ?,
         estado_financiero = 'APLICADO'
     WHERE id = ?
       AND empresa_id = ?`,
    [
      metodoPago,
      metodoPago === 'tarjeta_credito' ? tarjetaId : null,
      metodoPago === 'transferencia' ? cuentaId : null,
      compraId,
      empresaId
    ]
  );
}

async function revertirPagoCompra(connection, compra, req) {
  if (compra.estado_financiero !== 'APLICADO' || !compra.metodo_pago) {
    return;
  }

  const empresaId = Number(compra.empresa_id);
  const monto = Math.round(Number(compra.total) * 100) / 100;
  const usuario = compraUsuario(req);

  if (compra.metodo_pago === 'efectivo') {
    await connection.query(
      `INSERT INTO caja_chica
        (empresa_id, tipo_movimiento, monto, concepto, categoria,
         estado, realizado_por, observaciones, referencia_tipo, referencia_id)
       VALUES (?, 'INGRESO', ?, ?, 'Anulación de compra',
               'CONFIRMADO', ?, ?, 'compra_anulacion', ?)`,
      [
        empresaId,
        monto,
        `Reintegro por anulación de compra ${compra.numero_compra}`,
        usuario,
        `Reversa financiera automática de ${compra.numero_compra}`,
        compra.id
      ]
    );
  }

  if (compra.metodo_pago === 'transferencia') {
    if (!compra.cuenta_id) {
      throw compraHttpError(
        'La compra no tiene una cuenta bancaria asociada para realizar la reversa',
        409
      );
    }

    const [cuentas] = await connection.query(
      `SELECT id
       FROM cuentas_bancarias
       WHERE id = ?
         AND empresa_id = ?
       LIMIT 1
       FOR UPDATE`,
      [compra.cuenta_id, empresaId]
    );

    if (!cuentas.length) {
      throw compraHttpError(
        'La cuenta bancaria asociada a la compra ya no existe',
        409
      );
    }

    await connection.query(
      `INSERT INTO movimientos_bancarios
        (empresa_id, cuenta_id, tipo_movimiento, monto, concepto,
         categoria, estado, numero_referencia, realizado_por,
         observaciones, referencia_tipo, referencia_id)
       VALUES (?, ?, 'INGRESO', ?, ?, 'Anulación de compra',
               'CONFIRMADO', ?, ?, ?, 'compra_anulacion', ?)`,
      [
        empresaId,
        compra.cuenta_id,
        monto,
        `Reintegro por anulación de compra ${compra.numero_compra}`,
        compra.numero_compra,
        usuario,
        `Reversa financiera automática de ${compra.numero_compra}`,
        compra.id
      ]
    );

    await connection.query(
      `UPDATE cuentas_bancarias
       SET saldo_actual = saldo_actual + ?
       WHERE id = ?
         AND empresa_id = ?`,
      [monto, compra.cuenta_id, empresaId]
    );
  }

  if (compra.metodo_pago === 'tarjeta_credito') {
    if (!compra.tarjeta_id) {
      throw compraHttpError(
        'La compra no tiene una tarjeta asociada para liberar el crédito',
        409
      );
    }

    await connection.query(
      `INSERT INTO tarjeta_credito_movimientos
        (empresa_id, tarjeta_id, tipo, monto, descripcion,
         referencia_tipo, referencia_id, fecha_movimiento, created_by)
       VALUES (?, ?, 'anulacion', ?, ?, 'compra', ?, NOW(), ?)`,
      [
        empresaId,
        compra.tarjeta_id,
        Math.round(monto * 100),
        `Liberación de crédito por anulación de compra ${compra.numero_compra}`,
        compra.id,
        req.user?.id || null
      ]
    );
  }

  await connection.query(
    `UPDATE compras
     SET estado_financiero = 'REVERTIDO'
     WHERE id = ?
       AND empresa_id = ?`,
    [compra.id, empresaId]
  );
}


// ========== FUENTES DE PAGO DISPONIBLES PARA COMPRAS ==========
exports.getFuentesPago = async (req, res) => {
  try {
    const empresaId = requireCompraEmpresaId(req);
    const tarjetasIncluidas = await planAccess.tieneModuloEmpresa(
      empresaId,
      'tarjetas'
    );

    const [[cajaRow]] = await db.query(
      `SELECT COALESCE(
         SUM(
           CASE
             WHEN tipo_movimiento = 'INGRESO' THEN monto
             WHEN tipo_movimiento = 'EGRESO' THEN -monto
             ELSE 0
           END
         ),
         0
       ) AS saldo_caja
       FROM caja_chica
       WHERE empresa_id = ?
         AND estado = 'CONFIRMADO'`,
      [empresaId]
    );

    const [cuentas] = await db.query(
      `SELECT
         id,
         nombre,
         tipo_cuenta,
         saldo_actual,
         activa
       FROM cuentas_bancarias
       WHERE empresa_id = ?
         AND activa = TRUE
       ORDER BY nombre`,
      [empresaId]
    );

    const [tarjetas] = tarjetasIncluidas
      ? await db.query(
          `SELECT
         t.id,
         t.banco,
         t.alias,
         t.ultimos4,
         t.limite_credito,
         COALESCE(
           SUM(
             CASE
               WHEN m.tipo IN ('compra', 'interes') THEN m.monto
               WHEN m.tipo IN ('pago', 'anulacion') THEN -m.monto
               WHEN m.tipo = 'ajuste' THEN m.monto
               ELSE 0
             END
           ),
           0
         ) AS saldo_centavos
       FROM tarjetas_credito t
       LEFT JOIN tarjeta_credito_movimientos m
         ON m.tarjeta_id = t.id
        AND m.empresa_id = t.empresa_id
       WHERE t.empresa_id = ?
         AND t.activo = 1
       GROUP BY
         t.id,
         t.banco,
         t.alias,
         t.ultimos4,
         t.limite_credito
       ORDER BY t.banco, t.alias, t.ultimos4`,
          [empresaId]
        )
      : [[]];

    res.json({
      success: true,
      data: {
        saldo_caja: Number(cajaRow.saldo_caja || 0),
        cuentas: cuentas.map((cuenta) => ({
          ...cuenta,
          saldo_actual: Number(cuenta.saldo_actual || 0)
        })),
        tarjetas: tarjetas.map((tarjeta) => ({
          ...tarjeta,
          limite_credito: Number(tarjeta.limite_credito || 0),
          saldo_centavos: Number(tarjeta.saldo_centavos || 0)
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo fuentes de pago:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        module: error.module,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al obtener las fuentes de pago'
    });
  }
};

// ========== CREAR COMPRA DE PRODUCTOS ==========
exports.createCompraProductos = async (req, res) => {
  const connection = await db.getConnection();

  try {
    purchaseInventoryService.requireSpecific(req.branchScope);
    await connection.beginTransaction();

    const {
      fecha_compra,
      proveedor_id,
      proveedor_nombre,
      proveedor_telefono,
      proveedor_nit,
      proveedor_direccion,
      items,
      notas,
      estado = 'CONFIRMADA',
      metodo_pago = 'efectivo',
      tarjeta_id,
      cuenta_id
    } = req.body;

    const telefonoValidado = validatePhone(proveedor_telefono, {
      label: 'El teléfono del proveedor',
    });

    if (!telefonoValidado.ok) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const proveedorTelefonoNormalizado = telefonoValidado.value;

    if (!fecha_compra || !proveedor_nombre || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }
    const empresaId = requireCompraEmpresaId(req);
    const sucursalId = Number(req.branchScope.sucursalId);

    const proveedorValido = await validateProveedorForCompra(connection, proveedor_id, empresaId);
    if (!proveedorValido) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Proveedor no encontrado para la empresa' });
    }

    // Calcular totales
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.cantidad * item.precio_unitario;
    });
    const total = subtotal;

    // Generar número de compra
    const fecha = new Date(fecha_compra);
    const year = fecha.getFullYear();
    const [lastCompra] = await connection.query(
      'SELECT id FROM compras ORDER BY id DESC LIMIT 1'
    );
    const nextId = lastCompra.length > 0 ? lastCompra[0].id + 1 : 1;
    const numero_compra = `COMP-${year}-${nextId}`;

    // Insertar compra
    const [compraResult] = await connection.query(
      `INSERT INTO compras
        (empresa_id, sucursal_id, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedor_telefono,
         proveedor_nit, proveedor_direccion, subtotal, impuestos, total, estado, notas, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'PRODUCTO')`,
      [empresaId, sucursalId, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedorTelefonoNormalizado,
       proveedor_nit, proveedor_direccion, subtotal, total, estado, notas]
    );

    const compraId = compraResult.insertId;

    // Validar fondos y registrar el movimiento financiero dentro
    // de la misma transacción de la compra.
    await aplicarPagoCompra(connection, {
      empresaId,
      metodoPago: metodo_pago,
      tarjetaId: tarjeta_id,
      cuentaId: cuenta_id,
      total,
      compraId,
      numeroCompra: numero_compra,
      req
    });

    // Procesar items
    for (const item of items) {
      const [productos] = await connection.query(
        'SELECT id FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1',
        [item.producto_id, empresaId]
      );
      if (!productos.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: `Producto ${item.producto_id} no encontrado para la empresa` });
      }

      // Insertar item
      const [itemResult] = await connection.query(
        `INSERT INTO compra_items
          (empresa_id, compra_id, producto_id, sku, nombre_producto, cantidad, precio_unitario, subtotal, aplica_serie)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, compraId, item.producto_id, item.sku, item.nombre_producto, item.cantidad,
         item.precio_unitario, item.cantidad * item.precio_unitario, item.aplica_serie || false]
      );

      const compraItemId = itemResult.insertId;

      // Insertar series si aplica
      if (item.aplica_serie && item.series && item.series.length > 0) {
        for (const numeroSerie of item.series) {
          await connection.query(
            `INSERT INTO producto_series
              (empresa_id, producto_id, sku, numero_serie, compra_id, compra_item_id, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'DISPONIBLE')`,
            [empresaId, item.producto_id, item.sku, numeroSerie, compraId, compraItemId]
          );
        }
      }

      // Actualizar inventario si está confirmada
      if (estado === 'CONFIRMADA' || estado === 'RECIBIDA') {
        const margen = 1.30; // 30% de ganancia
        const precioVentaCalculado = item.precio_unitario * margen;

        await connection.query(
          'UPDATE productos SET precio_costo = ?, precio_venta = ? WHERE id = ? AND empresa_id = ?',
          [item.precio_unitario, precioVentaCalculado, item.producto_id, empresaId]
        );
        await purchaseInventoryService.receiveProduct(connection, {
          branchScope: req.branchScope,
          compraId,
          compraItemId,
          productoId: Number(item.producto_id),
          cantidad: Number(item.cantidad),
          usuarioId: req.user?.id ?? req.user?.userId ?? null,
          numeroCompra: numero_compra,
        });

        console.log(`✅ Producto ${item.producto_id}: +${item.cantidad} stock, Costo: Q${item.precio_unitario}, Venta: Q${precioVentaCalculado.toFixed(2)}`);
      }
    }

    await connection.commit();

    await auditarCompra(req, empresaId, compraId, numero_compra, total, 'PRODUCTO', req.body);
    res.status(201).json({
      success: true,
      message: 'Compra de productos registrada exitosamente',
      data: {
        id: compraId,
        numero_compra,
        total,
        items_count: items.length
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear compra de productos:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al registrar la compra de productos',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ========== CREAR COMPRA DE REPUESTOS ==========
exports.createCompraRepuestos = async (req, res) => {
  const connection = await db.getConnection();

  try {
    purchaseInventoryService.requireSpecific(req.branchScope);
    await connection.beginTransaction();

    const {
      fecha_compra,
      proveedor_id,
      proveedor_nombre,
      proveedor_telefono,
      proveedor_nit,
      proveedor_direccion,
      items,
      notas,
      estado = 'CONFIRMADA',
      metodo_pago = 'efectivo',
      tarjeta_id,
      cuenta_id
    } = req.body;

    const telefonoValidado = validatePhone(proveedor_telefono, {
      label: 'El teléfono del proveedor',
    });

    if (!telefonoValidado.ok) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const proveedorTelefonoNormalizado = telefonoValidado.value;

    if (!fecha_compra || !proveedor_nombre || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }
    const empresaId = requireCompraEmpresaId(req);
    const sucursalId = Number(req.branchScope.sucursalId);

    const proveedorValido = await validateProveedorForCompra(connection, proveedor_id, empresaId);
    if (!proveedorValido) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Proveedor no encontrado para la empresa' });
    }

    // Calcular totales
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.cantidad * item.precio_unitario;
    });
    const total = subtotal;

    // Generar número de compra
    const fecha = new Date(fecha_compra);
    const year = fecha.getFullYear();
    const [lastCompra] = await connection.query(
      'SELECT id FROM compras ORDER BY id DESC LIMIT 1'
    );
    const nextId = lastCompra.length > 0 ? lastCompra[0].id + 1 : 1;
    const numero_compra = `COMR-${year}-${nextId}`;

    // Insertar compra
    const [compraResult] = await connection.query(
      `INSERT INTO compras
        (empresa_id, sucursal_id, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedor_telefono,
         proveedor_nit, proveedor_direccion, subtotal, impuestos, total, estado, notas, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'REPUESTO')`,
      [empresaId, sucursalId, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedorTelefonoNormalizado,
       proveedor_nit, proveedor_direccion, subtotal, total, estado, notas]
    );

    const compraId = compraResult.insertId;

    // Validar fondos y registrar el movimiento financiero dentro
    // de la misma transacción de la compra.
    await aplicarPagoCompra(connection, {
      empresaId,
      metodoPago: metodo_pago,
      tarjetaId: tarjeta_id,
      cuentaId: cuenta_id,
      total,
      compraId,
      numeroCompra: numero_compra,
      req
    });

    // Procesar items
    for (const item of items) {
      if (!Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
        throw compraHttpError('La cantidad de cada repuesto debe ser un entero positivo');
      }
      const [repuestos] = await connection.query(
        'SELECT id FROM repuestos WHERE id = ? AND empresa_id = ? LIMIT 1 FOR UPDATE',
        [item.producto_id, empresaId]
      );
      if (!repuestos.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: `Repuesto ${item.producto_id} no encontrado para la empresa` });
      }

      // Insertar item
      const [itemResult] = await connection.query(
        `INSERT INTO compra_items
          (empresa_id, compra_id, producto_id, sku, nombre_producto, cantidad, precio_unitario, subtotal, aplica_serie)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, false)`,
        [empresaId, compraId, item.producto_id, item.sku, item.nombre_producto, item.cantidad,
         item.precio_unitario, item.cantidad * item.precio_unitario]
      );

      // Actualizar inventario si está confirmada
      if (estado === 'CONFIRMADA' || estado === 'RECIBIDA') {
        const margen = 1.30; // 30% de ganancia
        // precio_unitario viene en quetzales del frontend; la tabla repuestos almacena en centavos
        const costoCentavos = Math.round(item.precio_unitario * 100);
        const publicoCentavos = Math.round(item.precio_unitario * margen * 100);

        await connection.query(
          'UPDATE repuestos SET precio_costo = ?, precio_publico = ? WHERE id = ? AND empresa_id = ?',
          [costoCentavos, publicoCentavos, item.producto_id, empresaId]
        );
        await repuestoInventoryService.receivePurchase(connection, {
          branchScope: req.branchScope,
          compraId,
          compraItemId: Number(itemResult.insertId),
          repuestoId: Number(item.producto_id),
          cantidad: Number(item.cantidad),
          usuarioId: req.user?.id ?? req.user?.userId ?? null,
          numeroCompra: numero_compra,
        });

        console.log(`✅ Repuesto ${item.producto_id}: +${item.cantidad} stock, Costo: Q${item.precio_unitario}, Público: Q${(item.precio_unitario * margen).toFixed(2)}`);
      }
    }

    await connection.commit();

    await auditarCompra(req, empresaId, compraId, numero_compra, total, 'REPUESTO', req.body);
    res.status(201).json({
      success: true,
      message: 'Compra de repuestos registrada exitosamente',
      data: {
        id: compraId,
        numero_compra,
        total,
        items_count: items.length
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear compra de repuestos:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al registrar la compra de repuestos',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ========== CREAR COMPRA (DEPRECADO - MANTENER POR COMPATIBILIDAD) ==========
exports.createCompra = async (req, res) => {
  const connection = await db.getConnection();

  try {
    purchaseInventoryService.requireSpecific(req.branchScope);
    await connection.beginTransaction();

    const {
      fecha_compra,
      proveedor_id, // ID del proveedor (puede ser null si se ingresa manualmente)
      proveedor_nombre,
      proveedor_telefono,
      proveedor_nit,
      proveedor_direccion,
      items, // [{ producto_id, sku, nombre_producto, cantidad, precio_unitario, aplica_serie, series: [], tipo_item: 'producto'|'repuesto' }]
      notas,
      estado = 'CONFIRMADA',
      metodo_pago = 'efectivo',
      tarjeta_id,
      cuenta_id
    } = req.body;

    const telefonoValidado = validatePhone(proveedor_telefono, {
      label: 'El teléfono del proveedor',
    });

    if (!telefonoValidado.ok) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: telefonoValidado.message,
      });
    }

    const proveedorTelefonoNormalizado = telefonoValidado.value;

    // Validaciones
    if (!fecha_compra || !proveedor_nombre || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: fecha_compra, proveedor_nombre, items'
      });
    }
    const empresaId = requireCompraEmpresaId(req);
    const sucursalId = Number(req.branchScope.sucursalId);

    const proveedorValido = await validateProveedorForCompra(connection, proveedor_id, empresaId);
    if (!proveedorValido) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Proveedor no encontrado para la empresa' });
    }

    const itemsNormalizados = items.map((item, index) => {
      const tipoItem = item.tipo_item || 'producto';
      const cantidad = Number(item.cantidad);
      const precioUnitario = Number(item.precio_unitario);

      if (!['producto', 'repuesto'].includes(tipoItem)) {
        throw compraHttpError(`Tipo inválido en el ítem ${index + 1}`);
      }

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw compraHttpError(`Cantidad inválida en el ítem ${index + 1}`);
      }

      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
        throw compraHttpError(`Precio inválido en el ítem ${index + 1}`);
      }

      return {
        ...item,
        tipo_item: tipoItem,
        cantidad,
        precio_unitario: precioUnitario
      };
    });

    const tiposCompra = new Set(itemsNormalizados.map(item => item.tipo_item));
    const tipoCompra =
      tiposCompra.size > 1
        ? 'MIXTA'
        : tiposCompra.has('repuesto')
          ? 'REPUESTO'
          : 'PRODUCTO';

    // Calcular totales
    let subtotal = 0;
    itemsNormalizados.forEach(item => {
      subtotal += item.cantidad * item.precio_unitario;
    });
    const impuestos = 0; // Por ahora sin impuestos
    const total = subtotal + impuestos;

    // Generar número de compra único
    const fecha = new Date(fecha_compra);
    const year = fecha.getFullYear();
    const [lastCompra] = await connection.query(
      'SELECT id FROM compras ORDER BY id DESC LIMIT 1'
    );
    const nextId = lastCompra.length > 0 ? lastCompra[0].id + 1 : 1;
    const numero_compra = `COM-${year}-${nextId}`;

    // Insertar compra (con proveedor_id si existe)
    const [compraResult] = await connection.query(
      `INSERT INTO compras
        (empresa_id, sucursal_id, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedor_telefono, proveedor_nit,
         proveedor_direccion, subtotal, impuestos, total, notas, estado, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, sucursalId, numero_compra, fecha_compra, proveedor_id, proveedor_nombre, proveedorTelefonoNormalizado, proveedor_nit,
       proveedor_direccion, subtotal, impuestos, total, notas, estado, tipoCompra]
    );

    const compraId = compraResult.insertId;

    if (estado === 'CONFIRMADA' || estado === 'RECIBIDA') {
      await aplicarPagoCompra(connection, {
        empresaId,
        metodoPago: metodo_pago,
        tarjetaId: tarjeta_id,
        cuentaId: cuenta_id,
        total,
        compraId,
        numeroCompra: numero_compra,
        req
      });
    }

    // Insertar items y actualizar stock
    for (const item of itemsNormalizados) {
      const subtotalItem = item.cantidad * item.precio_unitario;
      const tipoItem = item.tipo_item || 'producto'; // Default a producto si no se especifica

      if (tipoItem === 'producto') {
        const [productos] = await connection.query(
          'SELECT id FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1',
          [item.producto_id, empresaId]
        );
        if (!productos.length) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: `Producto ${item.producto_id} no encontrado para la empresa` });
        }
      } else if (tipoItem === 'repuesto') {
        const [repuestos] = await connection.query(
          'SELECT id FROM repuestos WHERE id = ? AND empresa_id = ? LIMIT 1 FOR UPDATE',
          [item.producto_id, empresaId]
        );
        if (!repuestos.length) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: `Repuesto ${item.producto_id} no encontrado para la empresa` });
        }
      }

      // Insertar item
      const [itemResult] = await connection.query(
        `INSERT INTO compra_items
          (empresa_id, compra_id, producto_id, sku, nombre_producto, cantidad,
           precio_unitario, subtotal, aplica_serie, tipo_item)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, compraId, item.producto_id, item.sku, item.nombre_producto,
         item.cantidad, item.precio_unitario, subtotalItem,
         Boolean(item.aplica_serie && tipoItem === 'producto'), tipoItem]
      );

      const compraItemId = itemResult.insertId;

      // Si aplica serie, insertar número de serie (ahora es uno solo para todas las unidades)
      if (tipoItem === 'producto' && item.aplica_serie && item.series && item.series.length > 0) {
        // Obtener la serie (todas son iguales ahora)
        const numeroSerie = item.series[0];

        if (!numeroSerie || numeroSerie.trim() === '') {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `El número de serie es requerido para "${item.nombre_producto}"`
          });
        }

        // NO validar duplicados - permitir la misma serie en diferentes compras
        // Esto es útil para modelos genéricos o lotes del mismo producto

        // Insertar UNA sola serie que representa el modelo/serie de este lote de productos
        // con una nota indicando la cantidad
        await connection.query(
          `INSERT INTO producto_series
            (empresa_id, producto_id, sku, numero_serie, compra_id, compra_item_id, estado, notas)
          VALUES (?, ?, ?, ?, ?, ?, 'DISPONIBLE', ?)`,
          [empresaId, item.producto_id, item.sku, numeroSerie, compraId, compraItemId,
           `Lote de ${item.cantidad} unidades - Compra ${numero_compra}`]
        );
      }

      // Actualizar stock y precio según el tipo de item (producto o repuesto)
      if (estado === 'CONFIRMADA' || estado === 'RECIBIDA') {
        if (tipoItem === 'producto') {
          // Calcular precio de venta con margen (ejemplo: 30% de ganancia)
          const margen = 1.30; // 30% de ganancia
          const precioVentaCalculado = item.precio_unitario * margen;

          // El precio es empresarial; la existencia se recibe en la sucursal activa.
          await connection.query(
            'UPDATE productos SET precio_costo = ?, precio_venta = ? WHERE id = ? AND empresa_id = ?',
            [item.precio_unitario, precioVentaCalculado, item.producto_id, empresaId]
          );
          await purchaseInventoryService.receiveProduct(connection, {
            branchScope: req.branchScope,
            compraId,
            compraItemId,
            productoId: Number(item.producto_id),
            cantidad: Number(item.cantidad),
            usuarioId: req.user?.id ?? req.user?.userId ?? null,
            numeroCompra: numero_compra,
          });
          console.log(`✅ Stock actualizado: Producto ${item.producto_id}, +${item.cantidad}, Costo: Q${item.precio_unitario}, Venta: Q${precioVentaCalculado}`);

        } else if (tipoItem === 'repuesto') {
          // Calcular precio público con margen (ejemplo: 30% de ganancia)
          const margen = 1.30;
          const costoCentavos = Math.round(item.precio_unitario * 100);
          const publicoCentavos = Math.round(item.precio_unitario * margen * 100);

          await connection.query(
            'UPDATE repuestos SET precio_costo = ?, precio_publico = ? WHERE id = ? AND empresa_id = ?',
            [costoCentavos, publicoCentavos, item.producto_id, empresaId]
          );
          await repuestoInventoryService.receivePurchase(connection, {
            branchScope: req.branchScope,
            compraId,
            compraItemId,
            repuestoId: Number(item.producto_id),
            cantidad: Number(item.cantidad),
            usuarioId: req.user?.id ?? req.user?.userId ?? null,
            numeroCompra: numero_compra,
          });
          console.log(`✅ Stock actualizado: Repuesto ${item.producto_id}, +${item.cantidad}, Costo: Q${item.precio_unitario}, Público: Q${(publicoCentavos / 100).toFixed(2)}`);
        }
      }
    }

    await connection.commit();

    await auditarCompra(req, empresaId, compraId, numero_compra, total, tipoCompra, req.body);
    res.status(201).json({
      success: true,
      message: 'Compra registrada exitosamente',
      data: {
        id: compraId,
        numero_compra,
        total,
        items_count: itemsNormalizados.length
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear compra:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al crear compra',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ========== OBTENER TODAS LAS COMPRAS ==========
exports.getAllCompras = async (req, res) => {
  try {
    const { estado, fecha_desde, fecha_hasta, proveedor } = req.query;
    const { page: pageNum, limit: limitNum, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const scope = purchaseInventoryService.purchaseScopeClause(req.branchScope, 'compras');

    let query = 'SELECT * FROM compras WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM compras WHERE 1=1';
    const params = [...scope.params];
    const countParams = [...scope.params];
    query += scope.sql;
    countQuery += scope.sql;

    if (estado) {
      query += ' AND estado = ?';
      countQuery += ' AND estado = ?';
      params.push(estado);
      countParams.push(estado);
    }

    if (fecha_desde) {
      query += ' AND fecha_compra >= ?';
      countQuery += ' AND fecha_compra >= ?';
      params.push(fecha_desde);
      countParams.push(fecha_desde);
    }

    if (fecha_hasta) {
      query += ' AND fecha_compra <= ?';
      countQuery += ' AND fecha_compra <= ?';
      params.push(fecha_hasta);
      countParams.push(fecha_hasta);
    }

    if (proveedor) {
      query += ' AND proveedor_nombre LIKE ?';
      countQuery += ' AND proveedor_nombre LIKE ?';
      const searchPattern = `%${proveedor}%`;
      params.push(searchPattern);
      countParams.push(searchPattern);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    query += ' ORDER BY fecha_compra DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [compras] = await db.query(query, params);

    res.json({
      success: true,
      data: compras,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('❌ Error al obtener compras:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al obtener compras',
      error: error.message
    });
  }
};

// ========== OBTENER COMPRA POR ID CON ITEMS ==========
exports.getCompraById = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = purchaseInventoryService.purchaseScopeClause(req.branchScope, 'compras');

    // Obtener compra
    const [compras] = await db.query(`SELECT * FROM compras WHERE id = ?${scope.sql}`, [id, ...scope.params]);

    if (compras.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    const compra = compras[0];
    const empresaId = compra.empresa_id ?? requireCompraEmpresaId(req);

    // Obtener items de la compra
    const [items] = await db.query(
      `SELECT ci.*,
        (SELECT COUNT(*) FROM producto_series ps WHERE ps.compra_item_id = ci.id AND ps.empresa_id = ci.empresa_id) as series_count
      FROM compra_items ci
      WHERE ci.compra_id = ? AND ci.empresa_id = ?`,
      [id, empresaId]
    );

    // Para cada item que aplica serie, obtener las series
    for (const item of items) {
      if (item.aplica_serie) {
        const [series] = await db.query(
          'SELECT * FROM producto_series WHERE compra_item_id = ? AND empresa_id = ?',
          [item.id, empresaId]
        );
        item.series = series;
      }
    }

    compra.items = items;

    res.json({
      success: true,
      data: compra
    });
  } catch (error) {
    console.error('❌ Error al obtener compra:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al obtener compra',
      error: error.message
    });
  }
};

// ========== OBTENER SERIES DE UN PRODUCTO ==========
exports.getSeriesByProducto = async (req, res) => {
  try {
    const { productoId } = req.params;
    const { estado } = req.query;
    const empresaId = requireCompraEmpresaId(req);

    const [productos] = await db.query(
      'SELECT id FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1',
      [productoId, empresaId]
    );
    if (!productos.length) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    const scope = purchaseInventoryService.purchaseScopeClause(req.branchScope, 'c');
    let query = `SELECT ps.* FROM producto_series ps
      INNER JOIN compras c
        ON c.id = ps.compra_id AND c.empresa_id = ps.empresa_id
      WHERE ps.producto_id = ? AND ps.empresa_id = ?${scope.sql}`;
    const params = [productoId, empresaId, ...scope.params];

    if (estado) {
      query += ' AND ps.estado = ?';
      params.push(estado);
    }

    query += ' ORDER BY ps.fecha_ingreso DESC';

    const [series] = await db.query(query, params);

    res.json({
      success: true,
      data: series
    });
  } catch (error) {
    console.error('❌ Error al obtener series:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Error al obtener series',
      error: error.message
    });
  }
};

// ========== ANULAR COMPRA ==========
exports.anularCompra = async (req, res) => {
  const connection = await db.getConnection();
  try {
    purchaseInventoryService.requireSpecific(req.branchScope);
    await connection.beginTransaction();

    const { id } = req.params;
    const { motivo = '' } = req.body;
    const scope = purchaseInventoryService.purchaseScopeClause(req.branchScope, 'compras');

    // Obtener la compra
    const [compras] = await connection.query(
      `SELECT * FROM compras WHERE id = ?${scope.sql} FOR UPDATE`,
      [id, ...scope.params]
    );
    if (compras.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Compra no encontrada' });
    }

    const compra = compras[0];
    const empresaId = compra.empresa_id ?? requireCompraEmpresaId(req);

    if (compra.estado === 'CANCELADA') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'La compra ya está anulada' });
    }

    // Obtener los items de la compra
    const [items] = await connection.query('SELECT * FROM compra_items WHERE compra_id = ? AND empresa_id = ?', [id, empresaId]);

    // Revertir stock solo si la compra estaba confirmada/recibida
    if (compra.estado === 'CONFIRMADA' || compra.estado === 'RECIBIDA') {
      for (const item of items) {
        const tipoItem = compra.tipo === 'MIXTA'
          ? String(item.tipo_item || 'producto').toUpperCase()
          : compra.tipo;

        if (tipoItem === 'PRODUCTO') {
          await purchaseInventoryService.reverseProduct(connection, {
            branchScope: req.branchScope,
            compraId: Number(id),
            compraItemId: Number(item.id),
            productoId: Number(item.producto_id),
            cantidad: Number(item.cantidad),
            usuarioId: req.user?.id ?? req.user?.userId ?? null,
            numeroCompra: compra.numero_compra,
          });
        } else if (tipoItem === 'REPUESTO') {
          await repuestoInventoryService.reversePurchase(connection, {
            branchScope: req.branchScope,
            compraId: Number(id),
            compraItemId: Number(item.id),
            repuestoId: Number(item.producto_id),
            cantidad: Number(item.cantidad),
            usuarioId: req.user?.id ?? req.user?.userId ?? null,
            numeroCompra: compra.numero_compra,
          });
        }
      }
    }

    // Revertir efectivo, saldo bancario o crédito utilizado.
    await revertirPagoCompra(connection, compra, req);

    // Marcar como cancelada
    await connection.query(
      "UPDATE compras SET estado = 'CANCELADA', notas = CONCAT(COALESCE(notas,''), IF(notas IS NULL OR notas = '', '', ' | '), 'ANULADA: ', ?) WHERE id = ? AND empresa_id = ? AND sucursal_id = ?",
      [motivo || 'Sin motivo', id, empresaId, Number(req.branchScope.sucursalId)]
    );

    await connection.commit();
    res.json({ success: true, message: 'Compra anulada; stock y movimiento financiero revertidos correctamente' });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al anular compra:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error al anular la compra', error: error.message });
  } finally {
    connection.release();
  }
};

module.exports = exports;
