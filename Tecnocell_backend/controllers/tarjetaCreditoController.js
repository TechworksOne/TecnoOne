const db = require('../config/database');

// ── Helpers ────────────────────────────────────────────────────────────────
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

  const connection = await db.getConnection();
  let transactionStarted = false;

  try {
    const { id } = req.params;

    const {
      cuenta_origen_id,
      tipo_cuenta_origen,
      monto,
      fecha,
      observaciones,
    } = req.body;

    const empresaId =
      Number(requireTenantEmpresaId(req));

    const sucursalId =
      Number(req.branchScope?.sucursalId);

    if (
      req.branchScope?.mode !== 'specific' ||
      !Number.isInteger(sucursalId) ||
      sucursalId <= 0
    ) {
      const error = new Error(
        'Seleccione una sucursal específica para realizar esta operación.'
      );
      error.statusCode = 400;
      error.code = 'BRANCH_SPECIFIC_REQUIRED';
      throw error;
    }

    /*
     * Contrato monetario:
     *
     * - El frontend envía CENTAVOS.
     * - tarjeta_credito_movimientos usa CENTAVOS.
     * - Caja Chica y bancos usan QUETZALES.
     */
    const montoCentavos = Number(monto);

    if (
      !Number.isInteger(montoCentavos) ||
      montoCentavos <= 0
    ) {
      const error = new Error(
        'El monto debe ser mayor a 0'
      );
      error.statusCode = 400;
      error.code = 'MONTO_INVALIDO';
      throw error;
    }

    const montoQuetzales =
      centsToQ(montoCentavos);

    if (
      !['banco', 'caja'].includes(
        tipo_cuenta_origen
      )
    ) {
      const error = new Error(
        'El origen del pago debe ser banco o Caja Chica'
      );
      error.statusCode = 400;
      error.code = 'ORIGEN_PAGO_INVALIDO';
      throw error;
    }

    if (
      tipo_cuenta_origen === 'banco' &&
      !cuenta_origen_id
    ) {
      const error = new Error(
        'Debe seleccionar una cuenta bancaria'
      );
      error.statusCode = 400;
      error.code = 'CUENTA_BANCARIA_REQUERIDA';
      throw error;
    }

    const userId =
      req.user?.id ??
      req.user?.userId ??
      req.user?.usuario_id ??
      null;

    const userName = String(
      req.user?.name ||
      req.user?.nombre ||
      req.user?.username ||
      req.user?.email ||
      userId ||
      'Usuario'
    );

    await connection.beginTransaction();
    transactionStarted = true;

    /*
     * Mutex financiero de sucursal.
     * Todas estas operaciones bloquean primero sucursal
     * para mantener un orden de locks consistente.
     */
    const [[sucursal]] =
      await connection.query(
        `SELECT id
         FROM sucursales
         WHERE id = ?
           AND empresa_id = ?
           AND activa = TRUE
         LIMIT 1
         FOR UPDATE`,
        [
          sucursalId,
          empresaId,
        ]
      );

    if (!sucursal) {
      const error = new Error(
        'La sucursal seleccionada no está disponible'
      );
      error.statusCode = 409;
      error.code = 'BRANCH_INACTIVE';
      throw error;
    }

    const [[tarjeta]] =
      await connection.query(
        `SELECT *
         FROM tarjetas_credito
         WHERE id = ?
           AND empresa_id = ?
           AND activo = 1
         LIMIT 1
         FOR UPDATE`,
        [
          id,
          empresaId,
        ]
      );

    if (!tarjeta) {
      const error = new Error(
        'Tarjeta no encontrada o inactiva'
      );
      error.statusCode = 404;
      error.code = 'TARJETA_NO_ENCONTRADA';
      throw error;
    }

    const descripcion =
      String(observaciones || '').trim() ||
      `Pago tarjeta ${tarjeta.banco} ****${tarjeta.ultimos4}`;

    let cuentaOrigenMovimiento = null;

    if (tipo_cuenta_origen === 'banco') {
      const [[cuenta]] =
        await connection.query(
          `SELECT
             id,
             nombre,
             saldo_actual
           FROM cuentas_bancarias
           WHERE id = ?
             AND empresa_id = ?
             AND activa = TRUE
           LIMIT 1
           FOR UPDATE`,
          [
            cuenta_origen_id,
            empresaId,
          ]
        );

      if (!cuenta) {
        const error = new Error(
          'Cuenta bancaria no encontrada o inactiva'
        );
        error.statusCode = 404;
        error.code =
          'CUENTA_BANCARIA_NO_ENCONTRADA';
        throw error;
      }

      const saldoBanco =
        Number(cuenta.saldo_actual || 0);

      if (
        montoQuetzales >
        saldoBanco
      ) {
        const error = new Error(
          `Saldo insuficiente en ${cuenta.nombre}. Disponible: Q${saldoBanco.toFixed(2)}`
        );
        error.statusCode = 409;
        error.code =
          'BANCO_SALDO_INSUFICIENTE';
        throw error;
      }

      await connection.query(
        `INSERT INTO movimientos_bancarios (
           empresa_id,
           cuenta_id,
           tipo_movimiento,
           monto,
           concepto,
           categoria,
           estado,
           realizado_por,
           fecha_movimiento,
           referencia_tipo,
           referencia_id,
           confirmado_por,
           confirmado_en
         )
         VALUES (
           ?,
           ?,
           'EGRESO',
           ?,
           ?,
           'PAGO_TARJETA',
           'CONFIRMADO',
           ?,
           ?,
           'tarjeta_credito',
           ?,
           ?,
           NOW()
         )`,
        [
          empresaId,
          cuenta.id,
          montoQuetzales,
          descripcion,
          userName,
          fecha || new Date(),
          String(id),
          userId,
        ]
      );

      await connection.query(
        `UPDATE cuentas_bancarias
         SET saldo_actual =
           saldo_actual - ?
         WHERE id = ?
           AND empresa_id = ?`,
        [
          montoQuetzales,
          cuenta.id,
          empresaId,
        ]
      );

      cuentaOrigenMovimiento =
        Number(cuenta.id);
    } else {
      const [[saldoRow]] =
        await connection.query(
          `SELECT COALESCE(
             SUM(
               CASE
                 WHEN estado = 'CONFIRMADO'
                  AND tipo_movimiento = 'INGRESO'
                 THEN monto

                 WHEN estado = 'CONFIRMADO'
                  AND tipo_movimiento = 'EGRESO'
                 THEN -monto

                 ELSE 0
               END
             ),
             0
           ) AS saldo
           FROM caja_chica
           WHERE empresa_id = ?
             AND sucursal_id = ?`,
          [
            empresaId,
            sucursalId,
          ]
        );

      const saldoCaja =
        Number(saldoRow?.saldo || 0);

      if (
        montoQuetzales >
        saldoCaja
      ) {
        const error = new Error(
          `Saldo insuficiente en Caja Chica. Disponible: Q${saldoCaja.toFixed(2)}`
        );
        error.statusCode = 409;
        error.code =
          'CAJA_CHICA_SALDO_INSUFICIENTE';
        throw error;
      }

      await connection.query(
        `INSERT INTO caja_chica (
           empresa_id,
           sucursal_id,
           tipo_movimiento,
           monto,
           concepto,
           categoria,
           realizado_por,
           estado,
           fecha_movimiento,
           referencia_tipo,
           referencia_id,
           confirmado_por,
           confirmado_en
         )
         VALUES (
           ?,
           ?,
           'EGRESO',
           ?,
           ?,
           'PAGO_TARJETA',
           ?,
           'CONFIRMADO',
           ?,
           'TARJETA_CREDITO',
           ?,
           ?,
           NOW()
         )`,
        [
          empresaId,
          sucursalId,
          montoQuetzales,
          descripcion,
          userName,
          fecha || new Date(),
          String(id),
          userId,
        ]
      );
    }

    /*
     * Tarjetas almacenan el monto en CENTAVOS.
     */
    const [movResult] =
      await connection.query(
        `INSERT INTO tarjeta_credito_movimientos (
           empresa_id,
           tarjeta_id,
           tipo,
           monto,
           descripcion,
           referencia_tipo,
           referencia_id,
           cuenta_origen_id,
           fecha_movimiento,
           created_by
         )
         VALUES (
           ?,
           ?,
           'pago',
           ?,
           ?,
           'pago_manual',
           NULL,
           ?,
           ?,
           ?
         )`,
        [
          empresaId,
          id,
          montoCentavos,
          descripcion,
          cuentaOrigenMovimiento,
          fecha || new Date(),
          userId,
        ]
      );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message:
        'Pago registrado exitosamente',
      data: {
        id: movResult.insertId,
        monto_centavos: montoCentavos,
        monto_quetzales: montoQuetzales,
        sucursal_id: sucursalId,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error(
      'Error registrarPago:',
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        code: error.code,
        message: error.message,
      });
  } finally {
    connection.release();
  }
};

// ── POST /api/tarjetas-credito/:id/ajustes ────────────────────────────────
exports.registrarAjuste = async (req, res) => {
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
exports.registrarCompra = async (
  connection,
  tarjetaId,
  montoCentavos,
  compraId,
  descripcion,
  userId,
  empresaId = null
) => {
  const empresaIdFinanciera = Number(empresaId);
  const monto = Number(montoCentavos);

  if (!Number.isInteger(empresaIdFinanciera) || empresaIdFinanciera <= 0) {
    const error = new Error('empresaId requerido');
    error.statusCode = 403;
    throw error;
  }

  if (!Number.isInteger(monto) || monto <= 0) {
    const error = new Error('El monto de la compra debe ser mayor que cero');
    error.statusCode = 400;
    throw error;
  }

  // Bloquea la tarjeta durante la validación para evitar dos compras
  // simultáneas usando el mismo crédito disponible.
  const [tarjetas] = await connection.query(
    `SELECT id, banco, alias, ultimos4, limite_credito
     FROM tarjetas_credito
     WHERE id = ? AND empresa_id = ? AND activo = 1
     LIMIT 1
     FOR UPDATE`,
    [tarjetaId, empresaIdFinanciera]
  );

  if (!tarjetas.length) {
    const error = new Error('Tarjeta no encontrada o inactiva para la empresa');
    error.statusCode = 404;
    throw error;
  }

  const tarjeta = tarjetas[0];

  const [[saldoRow]] = await connection.query(
    `SELECT COALESCE(
       SUM(
         CASE
           WHEN tipo IN ('compra', 'interes') THEN monto
           WHEN tipo IN ('pago', 'anulacion') THEN -monto
           WHEN tipo = 'ajuste' THEN monto
           ELSE 0
         END
       ),
       0
     ) AS saldo_centavos
     FROM tarjeta_credito_movimientos
     WHERE tarjeta_id = ? AND empresa_id = ?`,
    [tarjetaId, empresaIdFinanciera]
  );

  const limiteCentavos = Number(tarjeta.limite_credito || 0);
  const saldoCentavos = Number(saldoRow.saldo_centavos || 0);
  const disponibleCentavos = Math.max(0, limiteCentavos - saldoCentavos);

  if (monto > disponibleCentavos) {
    const error = new Error(
      `Crédito insuficiente en ${tarjeta.alias || tarjeta.banco} ****${tarjeta.ultimos4}. ` +
      `Disponible: Q${(disponibleCentavos / 100).toFixed(2)}`
    );
    error.statusCode = 409;
    throw error;
  }

  await connection.query(
    `INSERT INTO tarjeta_credito_movimientos
      (empresa_id, tarjeta_id, tipo, monto, descripcion,
       referencia_tipo, referencia_id, fecha_movimiento, created_by)
     VALUES (?, ?, 'compra', ?, ?, 'compra', ?, NOW(), ?)`,
    [
      empresaIdFinanciera,
      tarjetaId,
      monto,
      descripcion || 'Compra pagada con tarjeta de crédito',
      compraId,
      userId || null
    ]
  );

  return {
    tarjeta,
    limite_centavos: limiteCentavos,
    saldo_anterior_centavos: saldoCentavos,
    disponible_anterior_centavos: disponibleCentavos,
    disponible_nuevo_centavos: disponibleCentavos - monto
  };
};
