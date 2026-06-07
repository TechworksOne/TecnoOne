const db = require('../config/database');

// ── Helpers ────────────────────────────────────────────────────────────────
const soloAdmin = (req, res) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const hasAdmin = roles.includes('ADMINISTRADOR') || roles.includes('admin') || req.user?.role === 'ADMINISTRADOR';
  if (!hasAdmin) {
    res.status(403).json({ success: false, message: 'Solo administradores pueden acceder a este módulo' });
    return false;
  }
  return true;
};

const centsToQ = v => Number(v) / 100;
const qToCents = v => Math.round(Number(v) * 100);

function isSuperadminTenant(req) {
  return req.tenant?.isSuperadmin === true || (req.user?.role === 'superadmin' && req.user?.empresa_id == null);
}

function getTenantEmpresaId(req) {
  return req.tenant?.empresa_id ?? req.user?.empresa_id ?? null;
}

function requireTenantEmpresaId(req) {
  const empresaId = getTenantEmpresaId(req);
  if (empresaId === null || empresaId === undefined || empresaId === '') {
    const error = new Error('empresaId requerido');
    error.statusCode = 403;
    throw error;
  }
  return empresaId;
}

function tarjetaTenantClause(req, alias = 't') {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

function movimientoTarjetaTenantClause(req, alias = 'm') {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

// ── GET /api/tarjetas-credito ──────────────────────────────────────────────
exports.getTarjetas = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  try {
    const tenant = tarjetaTenantClause(req, 't');
    const [rows] = await db.query(`
      SELECT
        t.*,
        COALESCE(
          SUM(CASE WHEN m.tipo IN ('compra','interes') THEN m.monto ELSE 0 END) -
          SUM(CASE WHEN m.tipo IN ('pago','anulacion') THEN m.monto ELSE 0 END) +
          SUM(CASE WHEN m.tipo = 'ajuste' THEN m.monto ELSE 0 END),
          0
        ) AS saldo_centavos,
        u.name AS creado_por_nombre
      FROM tarjetas_credito t
      LEFT JOIN tarjeta_credito_movimientos m ON m.tarjeta_id = t.id AND m.empresa_id = t.empresa_id
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.activo = 1${tenant.sql}
      GROUP BY t.id
      ORDER BY t.banco ASC, t.alias ASC
    `, tenant.params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getTarjetas:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── POST /api/tarjetas-credito ─────────────────────────────────────────────
exports.createTarjeta = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  try {
    const { banco, alias, ultimos4, tasa_interes, dia_corte, dia_pago, limite_credito, moneda, notas } = req.body;

    if (!banco || !banco.trim()) return res.status(400).json({ success: false, message: 'El banco es requerido' });
    if (!ultimos4 || !/^\d{4}$/.test(String(ultimos4).trim()))
      return res.status(400).json({ success: false, message: 'Los últimos 4 dígitos deben ser exactamente 4 números' });
    if (dia_corte < 1 || dia_corte > 31) return res.status(400).json({ success: false, message: 'Día de corte inválido (1-31)' });
    if (dia_pago < 1 || dia_pago > 31)   return res.status(400).json({ success: false, message: 'Día de pago inválido (1-31)' });
    if (Number(tasa_interes) < 0) return res.status(400).json({ success: false, message: 'La tasa de interés no puede ser negativa' });

    const empresaId = requireTenantEmpresaId(req);
    const [result] = await db.query(
      `INSERT INTO tarjetas_credito (empresa_id, banco, alias, ultimos4, tasa_interes, dia_corte, dia_pago, limite_credito, moneda, notas, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId, banco.trim(), alias?.trim() || null, String(ultimos4).trim(),
        Number(tasa_interes) || 0, Number(dia_corte), Number(dia_pago),
        qToCents(limite_credito || 0), moneda || 'GTQ',
        notas?.trim() || null, req.user.id
      ]
    );
    res.status(201).json({ success: true, message: 'Tarjeta creada', data: { id: result.insertId } });
  } catch (error) {
    console.error('Error createTarjeta:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── PUT /api/tarjetas-credito/:id ──────────────────────────────────────────
exports.updateTarjeta = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const { banco, alias, ultimos4, tasa_interes, dia_corte, dia_pago, limite_credito, moneda, notas } = req.body;

    if (!banco?.trim()) return res.status(400).json({ success: false, message: 'El banco es requerido' });
    if (!ultimos4 || !/^\d{4}$/.test(String(ultimos4).trim()))
      return res.status(400).json({ success: false, message: 'Los últimos 4 dígitos deben ser exactamente 4 números' });

    const tenant = tarjetaTenantClause(req, 'tarjetas_credito');
    const [existing] = await db.query(
      `SELECT id FROM tarjetas_credito WHERE id = ? AND activo = 1${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Tarjeta no encontrada' });

    await db.query(
      `UPDATE tarjetas_credito SET banco=?, alias=?, ultimos4=?, tasa_interes=?, dia_corte=?, dia_pago=?, limite_credito=?, moneda=?, notas=?
       WHERE id = ?${tenant.sql}`,
      [
        banco.trim(), alias?.trim() || null, String(ultimos4).trim(),
        Number(tasa_interes) || 0, Number(dia_corte), Number(dia_pago),
        qToCents(limite_credito || 0), moneda || 'GTQ',
        notas?.trim() || null, id, ...tenant.params
      ]
    );
    res.json({ success: true, message: 'Tarjeta actualizada' });
  } catch (error) {
    console.error('Error updateTarjeta:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/tarjetas-credito/:id/desactivar ─────────────────────────────
exports.desactivarTarjeta = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const tenant = tarjetaTenantClause(req, 'tarjetas_credito');
    const [result] = await db.query(
      `UPDATE tarjetas_credito SET activo = 0 WHERE id = ?${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Tarjeta no encontrada' });
    res.json({ success: true, message: 'Tarjeta desactivada' });
  } catch (error) {
    console.error('Error desactivarTarjeta:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── GET /api/tarjetas-credito/:id/movimientos ──────────────────────────────
exports.getMovimientos = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const tarjetaTenant = tarjetaTenantClause(req, 't');
    const [tarjetas] = await db.query(
      `SELECT id FROM tarjetas_credito t WHERE t.id = ?${tarjetaTenant.sql}`,
      [id, ...tarjetaTenant.params]
    );
    if (!tarjetas.length) return res.status(404).json({ success: false, message: 'Tarjeta no encontrada' });

    const movimientoTenant = movimientoTarjetaTenantClause(req, 'm');
    const [rows] = await db.query(
      `SELECT m.*, u.name AS creado_por_nombre
       FROM tarjeta_credito_movimientos m
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.tarjeta_id = ?${movimientoTenant.sql}
       ORDER BY m.fecha_movimiento DESC`,
      [id, ...movimientoTenant.params]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getMovimientos:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── POST /api/tarjetas-credito/:id/pagos ──────────────────────────────────
// Paga la tarjeta desde una cuenta bancaria o caja chica
exports.registrarPago = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { cuenta_origen_id, tipo_cuenta_origen, monto, fecha, observaciones } = req.body;
    const empresaId = requireTenantEmpresaId(req);

    if (!monto || Number(monto) <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'El monto debe ser mayor a 0' });
    }

    // Verificar tarjeta activa
    const [tarjetas] = await connection.query(
      'SELECT * FROM tarjetas_credito WHERE id = ? AND empresa_id = ? AND activo = 1',
      [id, empresaId]
    );
    if (!tarjetas.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Tarjeta no encontrada o inactiva' });
    }
    const tarjeta = tarjetas[0];
    const montoCentavos = qToCents(monto);
    const descripcion = observaciones?.trim() || `Pago tarjeta ${tarjeta.banco} ****${tarjeta.ultimos4}`;

    // Registrar egreso en la cuenta de origen
    if (tipo_cuenta_origen === 'banco' && cuenta_origen_id) {
      const [cuentas] = await connection.query(
        'SELECT id FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activa = TRUE LIMIT 1',
        [cuenta_origen_id, empresaId]
      );
      if (!cuentas.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Cuenta bancaria no encontrada o inactiva' });
      }

      await connection.query(
        `INSERT INTO movimientos_bancarios
         (empresa_id, cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, fecha_movimiento, referencia_tipo, referencia_id)
         VALUES (?, ?, 'EGRESO', ?, ?, 'PAGO_TARJETA', 'CONFIRMADO', ?, ?, 'tarjeta_credito', ?)`,
        [empresaId, cuenta_origen_id, montoCentavos, descripcion, req.user.id, fecha || new Date(), id]
      );
      // Actualizar saldo banco
      await connection.query(
        'UPDATE cuentas_bancarias SET saldo_actual = saldo_actual - ? WHERE id = ? AND empresa_id = ?',
        [montoCentavos, cuenta_origen_id, empresaId]
      );
    } else if (tipo_cuenta_origen === 'caja') {
      await connection.query(
        `INSERT INTO caja_chica (empresa_id, tipo_movimiento, monto, concepto, categoria, realizado_por, estado, fecha_movimiento)
         VALUES (?, 'EGRESO', ?, ?, 'PAGO_TARJETA', ?, 'CONFIRMADO', ?)`,
        [empresaId, montoCentavos, descripcion, req.user.id, fecha || new Date()]
      );
    }

    // Registrar movimiento en tarjeta
    const [movResult] = await connection.query(
      `INSERT INTO tarjeta_credito_movimientos (empresa_id, tarjeta_id, tipo, monto, descripcion, referencia_tipo, referencia_id, cuenta_origen_id, fecha_movimiento, created_by)
       VALUES (?, ?, 'pago', ?, ?, 'pago_manual', NULL, ?, ?, ?)`,
      [empresaId, id, montoCentavos, descripcion, cuenta_origen_id || null, fecha || new Date(), req.user.id]
    );

    await connection.commit();
    res.status(201).json({ success: true, message: 'Pago registrado exitosamente', data: { id: movResult.insertId } });
  } catch (error) {
    await connection.rollback();
    console.error('Error registrarPago:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// ── POST /api/tarjetas-credito/:id/ajustes ────────────────────────────────
exports.registrarAjuste = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const { monto, descripcion, fecha } = req.body;

    if (!monto) return res.status(400).json({ success: false, message: 'El monto es requerido' });

    const empresaId = requireTenantEmpresaId(req);
    const [tarjetas] = await db.query(
      'SELECT id FROM tarjetas_credito WHERE id = ? AND empresa_id = ? AND activo = 1',
      [id, empresaId]
    );
    if (!tarjetas.length) return res.status(404).json({ success: false, message: 'Tarjeta no encontrada o inactiva' });

    // monto puede ser positivo (suma deuda) o negativo (resta deuda)
    await db.query(
      `INSERT INTO tarjeta_credito_movimientos (empresa_id, tarjeta_id, tipo, monto, descripcion, fecha_movimiento, created_by)
       VALUES (?, ?, 'ajuste', ?, ?, ?, ?)`,
      [empresaId, id, qToCents(monto), descripcion?.trim() || 'Ajuste manual', fecha || new Date(), req.user.id]
    );
    res.status(201).json({ success: true, message: 'Ajuste registrado' });
  } catch (error) {
    console.error('Error registrarAjuste:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── POST /api/tarjetas-credito/movimiento-compra (interno) ────────────────
// Usado por compraController cuando metodo_pago = 'tarjeta_credito'
exports.registrarCompra = async (connection, tarjetaId, montoCentavos, compraId, descripcion, userId, empresaId = null) => {
  const empresaIdFinanciera = Number(empresaId);
  if (!Number.isInteger(empresaIdFinanciera) || empresaIdFinanciera <= 0) {
    throw new Error('empresaId requerido');
  }
  const [tarjetas] = await connection.query(
    'SELECT id FROM tarjetas_credito WHERE id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [tarjetaId, empresaIdFinanciera]
  );
  if (!tarjetas.length) {
    throw new Error('Tarjeta no encontrada o inactiva para la empresa');
  }

  await connection.query(
    `INSERT INTO tarjeta_credito_movimientos (empresa_id, tarjeta_id, tipo, monto, descripcion, referencia_tipo, referencia_id, fecha_movimiento, created_by)
     VALUES (?, ?, 'compra', ?, ?, 'compra', ?, NOW(), ?)`,
    [empresaIdFinanciera, tarjetaId, montoCentavos, descripcion || 'Compra pagada con tarjeta de crédito', compraId, userId]
  );
};
