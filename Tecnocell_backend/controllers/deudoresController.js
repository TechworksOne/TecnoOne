const db = require('../config/database');

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? 1;
}

function deudorTenantClause(req, alias = 'd') {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.empresa_id = ?`, params: [getTenantEmpresaId(req)] };
}

function pagoTenantClause(req, alias = 'p') {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.empresa_id = ?`, params: [getTenantEmpresaId(req)] };
}

// ── Listar todos los créditos ──────────────────────────────────────────────
exports.getDeudores = async (req, res) => {
  try {
    const { estado, cliente_id, search, tipo_origen } = req.query;
    const tenant = deudorTenantClause(req, 'd');

    let query = `
      SELECT 
        d.*,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(c.apellido), ''))) AS cliente_nombre_actual,
        c.telefono AS cliente_telefono_actual
      FROM deudores d
      LEFT JOIN clientes c ON d.cliente_id = c.id AND c.empresa_id = d.empresa_id
      WHERE 1=1
    `;
    const params = [...tenant.params];
    query += tenant.sql;

    if (estado) {
      query += ' AND d.estado = ?';
      params.push(estado);
    }
    if (cliente_id) {
      query += ' AND d.cliente_id = ?';
      params.push(cliente_id);
    }
    if (tipo_origen) {
      query += ' AND d.tipo_origen = ?';
      params.push(tipo_origen);
    }
    if (search) {
      query += ' AND (d.cliente_nombre LIKE ? OR d.descripcion LIKE ? OR d.numero_credito LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY d.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al obtener deudores:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Obtener un crédito por ID ──────────────────────────────────────────────
exports.getDeudorById = async (req, res) => {
  try {
    const { id } = req.params;
    const deudorTenant = deudorTenantClause(req, 'd');
    const [rows] = await db.query(
      `SELECT d.*, TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(c.apellido), ''))) AS cliente_nombre_actual, c.telefono AS cliente_telefono_actual
       FROM deudores d
       LEFT JOIN clientes c ON d.cliente_id = c.id AND c.empresa_id = d.empresa_id
       WHERE d.id = ?${deudorTenant.sql}`,
      [id, ...deudorTenant.params]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Crédito no encontrado' });

    const deudor = rows[0];
    // Pagos del crédito (incluye cuotas pre-programadas y pagos reales)
    const pagoTenant = pagoTenantClause(req, 'deudores_pagos');
    const [pagos] = await db.query(
      `SELECT * FROM deudores_pagos WHERE deudor_id = ?${pagoTenant.sql}
       ORDER BY numero_cuota ASC, fecha_pago ASC`,
      [id, ...pagoTenant.params]
    );
    deudor.pagos = pagos;
    res.json({ success: true, data: deudor });
  } catch (error) {
    console.error('Error al obtener crédito:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Crear crédito ──────────────────────────────────────────────────────────
exports.createDeudor = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      cliente_id, cliente_nombre, cliente_telefono,
      descripcion, monto_total, fecha_vencimiento,
      referencia_venta_id, referencia_reparacion_id,
      tipo_origen = 'MANUAL',
      numero_cuotas = 1,
      frecuencia_pago = 'MENSUAL',
      fecha_primer_pago,
      items_detalle,
      notas, created_by
    } = req.body;

    if (!cliente_nombre) {
      await connection.rollback();
      return res.status(400).json({ error: 'El nombre del cliente es requerido' });
    }
    if (!monto_total || Number(monto_total) <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const cuotas   = Math.max(1, parseInt(numero_cuotas) || 1);
    const total    = parseFloat(monto_total);
    const cuotaBase = parseFloat((total / cuotas).toFixed(2));
    const cuotaUlt  = parseFloat((total - cuotaBase * (cuotas - 1)).toFixed(2));
    const empresaId = getTenantEmpresaId(req);

    if (cliente_id) {
      const [clientes] = await connection.query(
        'SELECT id FROM clientes WHERE id = ? AND empresa_id = ? LIMIT 1',
        [cliente_id, empresaId]
      );
      if (!clientes.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Cliente no encontrado para la empresa' });
      }
    }

    if (referencia_venta_id) {
      const [ventas] = await connection.query(
        'SELECT id FROM ventas WHERE id = ? AND empresa_id = ? LIMIT 1',
        [referencia_venta_id, empresaId]
      );
      if (!ventas.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Venta no encontrada para la empresa' });
      }
    }

    if (referencia_reparacion_id) {
      const [reparaciones] = await connection.query(
        'SELECT id FROM reparaciones WHERE id = ? AND empresa_id = ? LIMIT 1',
        [referencia_reparacion_id, empresaId]
      );
      if (!reparaciones.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Reparacion no encontrada para la empresa' });
      }
    }

    const [result] = await connection.query(
      `INSERT INTO deudores
         (empresa_id, cliente_id, cliente_nombre, cliente_telefono, descripcion,
          monto_total, monto_pagado, saldo_pendiente,
          fecha_vencimiento, referencia_venta_id, referencia_reparacion_id,
          tipo_origen, numero_cuotas, monto_cuota, frecuencia_pago, fecha_primer_pago,
          items_detalle, notas, estado, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?)`,
      [
        empresaId, cliente_id || null, cliente_nombre, cliente_telefono || null,
        descripcion || null, total, total,
        fecha_vencimiento || null,
        referencia_venta_id || null,
        referencia_reparacion_id || null,
        tipo_origen,
        cuotas, cuotaBase, frecuencia_pago || 'MENSUAL',
        fecha_primer_pago || null,
        items_detalle ? JSON.stringify(items_detalle) : null,
        notas || null, created_by || null
      ]
    );

    const deudorId = result.insertId;

    // Crear plan de cuotas pre-programadas
    if (cuotas > 1 && fecha_primer_pago) {
      const cuotasRows = [];
      let fecha = new Date(fecha_primer_pago + 'T12:00:00');
      for (let i = 1; i <= cuotas; i++) {
        const montoCuota = i === cuotas ? cuotaUlt : cuotaBase;
        cuotasRows.push([
          empresaId,
          deudorId,
          i,
          0,                            // monto pagado = 0
          montoCuota,                   // monto_programado
          fecha.toISOString().split('T')[0], // fecha_vencimiento
          'PENDIENTE',
          'SISTEMA',
        ]);
        if (frecuencia_pago === 'SEMANAL')    fecha.setDate(fecha.getDate() + 7);
        else if (frecuencia_pago === 'QUINCENAL') fecha.setDate(fecha.getDate() + 15);
        else fecha.setMonth(fecha.getMonth() + 1);
      }
      for (const row of cuotasRows) {
        await connection.query(
          `INSERT INTO deudores_pagos
             (empresa_id, deudor_id, numero_cuota, monto, monto_programado, fecha_vencimiento, estado_cuota, realizado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          row
        );
      }
    }

    await connection.commit();
    const [rows] = await db.query('SELECT * FROM deudores WHERE id = ? AND empresa_id = ?', [deudorId, empresaId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear crédito:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// ── Buscar reparaciones para vincular ─────────────────────────────────────
exports.searchReparaciones = async (req, res) => {
  try {
    const { search = '', limit = 15 } = req.query;
    const like = `%${search}%`;
    const empresaId = getTenantEmpresaId(req);
    const [rows] = await db.query(
      `SELECT id, sticker_serie_interna AS numero_reparacion,
              cliente_nombre, cliente_telefono,
              marca, modelo, estado,
              ROUND(total / 100, 2)          AS total,
              ROUND(monto_anticipo / 100, 2) AS monto_anticipo
       FROM reparaciones
       WHERE (cliente_nombre LIKE ? OR marca LIKE ? OR modelo LIKE ?
              OR sticker_serie_interna LIKE ?)
         AND empresa_id = ?
         AND estado NOT IN ('CANCELADA')
       ORDER BY created_at DESC
       LIMIT ?`,
      [like, like, like, like, empresaId, parseInt(limit)]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error búsqueda reparaciones:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Helpers internos ──────────────────────────────────────────────────────
async function _buscarCuentaPorPOS(conn, tipoPOS, empresaId) {
  let patrones = [];
  if (tipoPOS === 'BAC')    patrones = ['%BAC%'];
  if (tipoPOS === 'NEONET') patrones = ['%NEONET%', '%Neonet%', '%Industrial%'];
  if (!patrones.length) return null;
  const conds = patrones.map(() => '(nombre LIKE ? OR pos_asociado LIKE ?)').join(' OR ');
  const params = patrones.flatMap(p => [p, p]);
  const [rows] = await conn.query(
    `SELECT id, nombre FROM cuentas_bancarias WHERE activa = TRUE AND (${conds}) AND empresa_id = ? ORDER BY id LIMIT 1`,
    [...params, empresaId]
  );
  return rows[0] || null;
}

async function _buscarPrimeraCuentaActiva(conn, empresaId) {
  const [rows] = await conn.query(
    'SELECT id, nombre FROM cuentas_bancarias WHERE activa = TRUE AND empresa_id = ? ORDER BY id LIMIT 1',
    [empresaId]
  );
  return rows[0] || null;
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// ── Registrar pago parcial o total ────────────────────────────────────────
exports.registrarPago = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      monto, metodo_pago = 'EFECTIVO', referencia, notas,
      realizado_por, porcentaje_recargo = 0, usuario_id,
    } = req.body;
    const empresaId = getTenantEmpresaId(req);

    if (!monto || Number(monto) <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const [rows] = await connection.query('SELECT * FROM deudores WHERE id = ? AND empresa_id = ? LIMIT 1', [id, empresaId]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Crédito no encontrado' });
    }

    const deudor = rows[0];
    if (deudor.estado === 'PAGADO') {
      await connection.rollback();
      return res.status(400).json({ error: 'Este crédito ya está pagado' });
    }
    if (deudor.estado === 'ANULADO') {
      await connection.rollback();
      return res.status(400).json({ error: 'No se puede registrar pago en un crédito anulado' });
    }

    const montoBase    = round2(monto);
    const pct          = round2(porcentaje_recargo || 0);
    const montoRecargo = round2(montoBase * pct / 100);
    const totalCobrado = round2(montoBase + montoRecargo);

    if (montoBase > Number(deudor.saldo_pendiente) + 0.01) {
      await connection.rollback();
      return res.status(400).json({
        error: `El monto (Q${montoBase.toFixed(2)}) supera el saldo pendiente (Q${Number(deudor.saldo_pendiente).toFixed(2)})`,
      });
    }

    const concepto = `Pago crédito ${deudor.numero_credito} — ${deudor.cliente_nombre}`;
    const agente   = realizado_por || 'Sistema';

    // ── Insertar registro en deudores_pagos ──
    const [pagoResult] = await connection.query(
      `INSERT INTO deudores_pagos
         (empresa_id, deudor_id, monto, metodo_pago, referencia, notas, realizado_por,
          porcentaje_recargo, monto_recargo, total_cobrado, estado_cuota)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAGADO')`,
      [empresaId, id, montoBase, metodo_pago, referencia || null, notas || null, agente,
       pct, montoRecargo, totalCobrado]
    );
    const pagoId = pagoResult.insertId;

    // ── Actualizar totales del crédito ──
    const nuevoMontoPagado = round2(Number(deudor.monto_pagado) + montoBase);
    const nuevoSaldo       = round2(Math.max(0, Number(deudor.monto_total) - nuevoMontoPagado));
    const nuevoEstado      = nuevoSaldo <= 0 ? 'PAGADO' : 'PARCIAL';

    await connection.query(
      'UPDATE deudores SET monto_pagado = ?, saldo_pendiente = ?, estado = ? WHERE id = ? AND empresa_id = ?',
      [nuevoMontoPagado, nuevoSaldo, nuevoEstado, id, empresaId]
    );

    // ── Registrar movimiento en caja / banco ──
    let cajaMovId  = null;
    let bancoMovId = null;

    if (metodo_pago === 'EFECTIVO') {
      const [cajaRes] = await connection.query(
        `INSERT INTO caja_chica
           (empresa_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones)
         VALUES (?, 'INGRESO', ?, ?, 'Cobro Deuda', 'CONFIRMADO', ?, ?)`,
        [empresaId, montoBase, concepto, agente, notas || null]
      );
      cajaMovId = cajaRes.insertId;

    } else if (metodo_pago === 'TRANSFERENCIA') {
      let cuenta = null;
      if (req.body.cuenta_id) {
        const [cs] = await connection.query(
          'SELECT id, nombre FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE LIMIT 1',
          [req.body.cuenta_id, empresaId]
        );
        cuenta = cs[0] || null;
      }
      if (!cuenta) cuenta = await _buscarPrimeraCuentaActiva(connection, empresaId);

      if (cuenta) {
        const [bRes] = await connection.query(
          `INSERT INTO movimientos_bancarios
             (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado,
              numero_referencia, realizado_por, observaciones)
           VALUES (?, ?, 'INGRESO', ?, ?, 'Transferencia', 'CONFIRMADO', ?, ?, ?)`,
          [empresaId, cuenta.id, montoBase, concepto, referencia || null, agente, notas || null]
        );
        bancoMovId = bRes.insertId;
        await connection.query(
          'UPDATE cuentas_bancarias SET saldo_actual = saldo_actual + ? WHERE id = ? AND empresa_id = ?',
          [montoBase, cuenta.id, empresaId]
        );
      }

    } else if (metodo_pago === 'TARJETA_BAC') {
      let cuenta = await _buscarCuentaPorPOS(connection, 'BAC', empresaId);
      if (!cuenta) cuenta = await _buscarPrimeraCuentaActiva(connection, empresaId);
      if (cuenta) {
        const [bRes] = await connection.query(
          `INSERT INTO movimientos_bancarios
             (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado,
              numero_referencia, realizado_por, observaciones)
           VALUES (?, ?, 'INGRESO', ?, ?, 'POS', 'PENDIENTE', ?, ?, ?)`,
          [empresaId, cuenta.id, montoBase, concepto, referencia || null, agente, notas || null]
        );
        bancoMovId = bRes.insertId;
      }

    } else if (metodo_pago === 'TARJETA_NEONET') {
      let cuenta = await _buscarCuentaPorPOS(connection, 'NEONET', empresaId);
      if (!cuenta) cuenta = await _buscarPrimeraCuentaActiva(connection, empresaId);
      if (cuenta) {
        const [bRes] = await connection.query(
          `INSERT INTO movimientos_bancarios
             (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado,
              numero_referencia, realizado_por, observaciones)
           VALUES (?, ?, 'INGRESO', ?, ?, 'POS', 'PENDIENTE', ?, ?, ?)`,
          [empresaId, cuenta.id, montoBase, concepto, referencia || null, agente, notas || null]
        );
        bancoMovId = bRes.insertId;
      }

    } else if (metodo_pago === 'TARJETA_OTRA') {
      const cuenta = await _buscarPrimeraCuentaActiva(connection, empresaId);
      if (cuenta) {
        const [bRes] = await connection.query(
          `INSERT INTO movimientos_bancarios
             (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado,
              numero_referencia, realizado_por, observaciones)
           VALUES (?, ?, 'INGRESO', ?, ?, 'POS', 'PENDIENTE', ?, ?, ?)`,
          [empresaId, cuenta.id, montoBase, concepto, referencia || null, agente, notas || null]
        );
        bancoMovId = bRes.insertId;
      }
    }

    // ── Vincular movimiento al pago ──
    if (cajaMovId || bancoMovId) {
      await connection.query(
        'UPDATE deudores_pagos SET caja_movimiento_id = ?, banco_movimiento_id = ? WHERE id = ? AND empresa_id = ?',
        [cajaMovId, bancoMovId, pagoId, empresaId]
      );
    }

    await connection.commit();

    const [updated] = await db.query('SELECT * FROM deudores WHERE id = ? AND empresa_id = ?', [id, empresaId]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    await connection.rollback();
    console.error('Error al registrar pago:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// ── Anular crédito ────────────────────────────────────────────────────────
exports.anularDeudor = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { motivo, anulado_por } = req.body;
    const empresaId = getTenantEmpresaId(req);

    if (!motivo || !String(motivo).trim()) {
      await connection.rollback();
      return res.status(400).json({ error: 'El motivo de anulación es requerido' });
    }

    const [rows] = await connection.query('SELECT * FROM deudores WHERE id = ? AND empresa_id = ? LIMIT 1', [id, empresaId]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Crédito no encontrado' });
    }
    const deudor = rows[0];
    if (deudor.estado === 'ANULADO') {
      await connection.rollback();
      return res.status(400).json({ error: 'El crédito ya está anulado' });
    }

    // ── Marcar deudor como ANULADO ──
    await connection.query(
      `UPDATE deudores
       SET estado = 'ANULADO',
           motivo_anulacion = ?,
           fecha_anulacion  = NOW(),
           anulado_por      = ?
       WHERE id = ? AND empresa_id = ?`,
      [String(motivo).trim(), anulado_por || null, id, empresaId]
    );

    // ── Anular cuotas PENDIENTES ──
    await connection.query(
      `UPDATE deudores_pagos
       SET estado_cuota = 'ANULADA'
       WHERE deudor_id = ? AND empresa_id = ? AND (estado_cuota = 'PENDIENTE' OR estado_cuota IS NULL) AND fecha_pago IS NULL`,
      [id, empresaId]
    );

    // ── Restaurar stock si es VENTA con items_detalle ──
    if (deudor.tipo_origen === 'VENTA' && deudor.items_detalle) {
      let items = [];
      try { items = JSON.parse(deudor.items_detalle); } catch { items = []; }
      for (const item of items) {
        const itemId  = parseInt(item.id);
        const itemQty = parseInt(item.cantidad) || 0;
        if (itemId > 0 && itemQty > 0) {
          // Update productos (items de venta siempre son productos)
          await connection.query(
            'UPDATE productos SET stock = stock + ? WHERE id = ? AND empresa_id = ?',
            [itemQty, itemId, empresaId]
          );
        }
      }
    }

    // ── Reversas de pagos ya realizados ──
    const [pagosRealizados] = await connection.query(
      `SELECT * FROM deudores_pagos
       WHERE deudor_id = ? AND empresa_id = ? AND monto > 0 AND fecha_pago IS NOT NULL
         AND (estado_cuota != 'ANULADA' OR estado_cuota IS NULL)`,
      [id, empresaId]
    );

    const agente     = anulado_por ? `Usuario #${anulado_por}` : 'Sistema';
    const motivoCorto = String(motivo).substring(0, 200);

    for (const pago of pagosRealizados) {
      // Always use monto (not total_cobrado): bank only received the base amount
      const montoPago = round2(Number(pago.monto));
      const concepto  = `Reversa anulación crédito ${deudor.numero_credito} — ${deudor.cliente_nombre}`;

      if (pago.caja_movimiento_id) {
        await connection.query(
          `INSERT INTO caja_chica
             (empresa_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones)
           VALUES (?, 'EGRESO', ?, ?, 'Reversa Deuda', 'CONFIRMADO', ?, ?)`,
          [empresaId, montoPago, concepto, agente, motivoCorto]
        );
      }

      if (pago.banco_movimiento_id) {
        // Fetch the original bank movement with its status
        const [movOrig] = await connection.query(
          'SELECT id, cuenta_id, estado FROM movimientos_bancarios WHERE id = ? AND empresa_id = ? LIMIT 1',
          [pago.banco_movimiento_id, empresaId]
        );
        if (movOrig.length) {
          const movEstado = movOrig[0].estado;
          if (movEstado === 'PENDIENTE') {
            // Movement was never confirmed — just delete it, no reversal needed
            await connection.query(
              'DELETE FROM movimientos_bancarios WHERE id = ? AND empresa_id = ?',
              [pago.banco_movimiento_id, empresaId]
            );
          } else if (movEstado === 'CONFIRMADO' && movOrig[0].cuenta_id) {
            // Movement was confirmed — register a reversal EGRESO and subtract balance
            await connection.query(
              `INSERT INTO movimientos_bancarios
                 (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado,
                  numero_referencia, realizado_por, observaciones)
               VALUES (?, ?, 'EGRESO', ?, ?, 'Reversa Deuda', 'CONFIRMADO', NULL, ?, ?)`,
              [empresaId, movOrig[0].cuenta_id, montoPago, concepto, agente, motivoCorto]
            );
            await connection.query(
              'UPDATE cuentas_bancarias SET saldo_actual = saldo_actual - ? WHERE id = ? AND empresa_id = ?',
              [montoPago, movOrig[0].cuenta_id, empresaId]
            );
          }
          // Any other status (ANULADO, CANCELADO) — skip, no action needed
        }
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Crédito anulado correctamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al anular crédito:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// ── Resumen / estadísticas ────────────────────────────────────────────────
exports.getResumen = async (req, res) => {
  try {
    const tenant = deudorTenantClause(req, 'deudores');
    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS total_creditos,
        SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'PARCIAL'   THEN 1 ELSE 0 END) AS parciales,
        SUM(CASE WHEN estado = 'PAGADO'    THEN 1 ELSE 0 END) AS pagados,
        SUM(CASE WHEN estado != 'ANULADO'  THEN monto_total    ELSE 0 END) AS total_prestado,
        SUM(CASE WHEN estado != 'ANULADO'  THEN saldo_pendiente ELSE 0 END) AS total_pendiente,
        SUM(CASE WHEN estado != 'ANULADO'  THEN monto_pagado   ELSE 0 END) AS total_cobrado
      FROM deudores
      WHERE 1=1${tenant.sql}
    `, tenant.params);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
