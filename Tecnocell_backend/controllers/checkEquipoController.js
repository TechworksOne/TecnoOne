const db = require('../config/database');

// Crear o actualizar checklist de equipo (UPSERT con manejo transaccional de anticipo)
exports.createCheckEquipo = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      reparacionId,
      tipoEquipo,
      checksGenerales,
      checksEspecificos,
      observaciones,
      fotosChecklist,
      realizadoPor,
      dejoAnticipo,
      montoAnticipo,
      metodoAnticipo,
      cuentaBancariaId  // requerido cuando metodoAnticipo === 'transferencia'
    } = req.body;

    // Preparar datos JSON según el tipo de equipo
    let telefonoChecks = null;
    let tabletChecks = null;
    let computadoraChecks = null;

    if (tipoEquipo === 'Telefono') {
      telefonoChecks = JSON.stringify(checksEspecificos);
    } else if (tipoEquipo === 'Tablet') {
      tabletChecks = JSON.stringify(checksEspecificos);
    } else if (tipoEquipo === 'Computadora' || tipoEquipo === 'Laptop') {
      computadoraChecks = JSON.stringify(checksEspecificos);
    }

    // ── UPSERT check_equipo ──────────────────────────────────────────────────
    const [existing] = await connection.query(
      'SELECT id FROM check_equipo WHERE reparacion_id = ? ORDER BY fecha_checklist DESC LIMIT 1',
      [reparacionId]
    );

    let checkId;
    const isUpdate = existing.length > 0;

    if (isUpdate) {
      checkId = existing[0].id;
      await connection.query(
        `UPDATE check_equipo SET
          tipo_equipo = ?,
          enciende = ?, tactil_funciona = ?, pantalla_ok = ?, bateria_ok = ?, carga_ok = ?,
          telefono_checks = ?, tablet_checks = ?, computadora_checks = ?,
          observaciones = ?, fotos_checklist = ?, realizado_por = ?
         WHERE id = ?`,
        [
          tipoEquipo,
          checksGenerales.enciende || false,
          checksGenerales.tactilFunciona || false,
          checksGenerales.pantallaOk || false,
          checksGenerales.bateriaOk || false,
          checksGenerales.cargaOk || false,
          telefonoChecks, tabletChecks, computadoraChecks,
          observaciones || null,
          fotosChecklist ? JSON.stringify(fotosChecklist) : null,
          realizadoPor || 'Sistema',
          checkId
        ]
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO check_equipo (
          reparacion_id, tipo_equipo,
          enciende, tactil_funciona, pantalla_ok, bateria_ok, carga_ok,
          telefono_checks, tablet_checks, computadora_checks,
          observaciones, fotos_checklist, realizado_por
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reparacionId, tipoEquipo,
          checksGenerales.enciende || false,
          checksGenerales.tactilFunciona || false,
          checksGenerales.pantallaOk || false,
          checksGenerales.bateriaOk || false,
          checksGenerales.cargaOk || false,
          telefonoChecks, tabletChecks, computadoraChecks,
          observaciones || null,
          fotosChecklist ? JSON.stringify(fotosChecklist) : null,
          realizadoPor || 'Sistema'
        ]
      );
      checkId = result.insertId;

      // Solo registrar RECIBIDA en historial la primera vez
      await connection.query(
        `INSERT INTO reparaciones_historial (reparacion_id, estado, nota, user_nombre, tipo_evento, descripcion)
         VALUES (?, 'RECIBIDA', 'Equipo recibido y checklist completado', ?, 'CHECKLIST_COMPLETADO', 'Se completó el checklist de inspección del equipo')`,
        [reparacionId, realizadoPor || 'Sistema']
      );

      // Actualizar estado a RECIBIDA solo si está en un estado muy inicial
      await connection.query(
        `UPDATE reparaciones SET estado = 'RECIBIDA'
         WHERE id = ? AND estado NOT IN (
           'EN_DIAGNOSTICO','ESPERANDO_AUTORIZACION','AUTORIZADA',
           'EN_REPARACION','EN_PROCESO','ESPERANDO_PIEZA',
           'COMPLETADA','ENTREGADA','CANCELADA'
         )`,
        [reparacionId]
      );
    }

    // ── MANEJO DE ANTICIPO ───────────────────────────────────────────────────
    if (dejoAnticipo && montoAnticipo > 0) {

      // 1. Verificar si ya existe un movimiento CONFIRMADO → no permitir cambios
      const [[{ cajaCnt }]] = await connection.query(
        `SELECT COUNT(*) AS cajaCnt FROM caja_chica
         WHERE referencia_tipo = 'REPARACION' AND referencia_id = ? AND estado = 'CONFIRMADO'`,
        [reparacionId]
      );
      const [[{ bancoCnt }]] = await connection.query(
        `SELECT COUNT(*) AS bancoCnt FROM movimientos_bancarios
         WHERE referencia_tipo = 'REPARACION' AND referencia_id = ? AND estado = 'CONFIRMADO'`,
        [reparacionId]
      );

      if (cajaCnt > 0 || bancoCnt > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'El anticipo ya fue confirmado en Caja/Bancos y no puede ser modificado.',
          anticipo_confirmado: true
        });
      }

      // 2. Eliminar movimientos PENDIENTES previos (puede haberse cambiado el método)
      await connection.query(
        `DELETE FROM caja_chica
         WHERE referencia_tipo = 'REPARACION' AND referencia_id = ? AND estado = 'PENDIENTE'`,
        [reparacionId]
      );
      await connection.query(
        `DELETE FROM movimientos_bancarios
         WHERE referencia_tipo = 'REPARACION' AND referencia_id = ? AND estado = 'PENDIENTE'`,
        [reparacionId]
      );

      // 3. Crear nuevo movimiento según método
      const montoDecimal = montoAnticipo / 100; // centavos → quetzales
      const concepto = `Anticipo de reparación ${reparacionId}`;

      if (metodoAnticipo === 'efectivo') {
        await connection.query(
          `INSERT INTO caja_chica
           (tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones, referencia_tipo, referencia_id)
           VALUES ('INGRESO', ?, ?, 'ANTICIPO_REPARACION', 'PENDIENTE', ?, 'Anticipo registrado desde checklist de ingreso', 'REPARACION', ?)`,
          [montoDecimal, concepto, realizadoPor || 'Sistema', reparacionId]
        );
      } else if (metodoAnticipo === 'transferencia') {
        if (!cuentaBancariaId) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Debe seleccionar una cuenta bancaria para el anticipo por transferencia'
          });
        }
        await connection.query(
          `INSERT INTO movimientos_bancarios
           (cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones, referencia_tipo, referencia_id)
           VALUES (?, 'INGRESO', ?, ?, 'ANTICIPO_REPARACION', 'PENDIENTE', ?, 'Anticipo por transferencia desde checklist de ingreso', 'REPARACION', ?)`,
          [cuentaBancariaId, montoDecimal, concepto, realizadoPor || 'Sistema', reparacionId]
        );
      } else if (metodoAnticipo === 'tarjeta_bac') {
        const [cuentaBac] = await connection.query(
          "SELECT id FROM cuentas_bancarias WHERE (nombre LIKE '%BAC%' OR pos_asociado LIKE '%BAC%') AND activa = TRUE ORDER BY id LIMIT 1"
        );
        const cuentaId = cuentaBac.length > 0 ? cuentaBac[0].id : null;
        if (cuentaId) {
          await connection.query(
            `INSERT INTO movimientos_bancarios
             (cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones, referencia_tipo, referencia_id)
             VALUES (?, 'INGRESO', ?, ?, 'ANTICIPO_REPARACION', 'PENDIENTE', ?, 'Anticipo por tarjeta BAC desde checklist de ingreso', 'REPARACION', ?)`,
            [cuentaId, montoDecimal, concepto, realizadoPor || 'Sistema', reparacionId]
          );
        }
      } else if (metodoAnticipo === 'tarjeta_neonet') {
        const [cuentaIndustrial] = await connection.query(
          "SELECT id FROM cuentas_bancarias WHERE (nombre LIKE '%Industrial%' OR nombre LIKE '%Neonet%' OR pos_asociado LIKE '%NEONET%' OR pos_asociado LIKE '%Industrial%') AND activa = TRUE ORDER BY id LIMIT 1"
        );
        const cuentaId = cuentaIndustrial.length > 0 ? cuentaIndustrial[0].id : null;
        if (cuentaId) {
          await connection.query(
            `INSERT INTO movimientos_bancarios
             (cuenta_id, tipo_movimiento, monto, concepto, categoria, estado, realizado_por, observaciones, referencia_tipo, referencia_id)
             VALUES (?, 'INGRESO', ?, ?, 'ANTICIPO_REPARACION', 'PENDIENTE', ?, 'Anticipo por tarjeta Neonet desde checklist de ingreso', 'REPARACION', ?)`,
            [cuentaId, montoDecimal, concepto, realizadoPor || 'Sistema', reparacionId]
          );
        }
      }

      // 4. Actualizar reparación
      await connection.query(
        `UPDATE reparaciones
         SET monto_anticipo = ?, saldo_anticipo = ?, metodo_anticipo = ?, cuenta_bancaria_anticipo_id = ?
         WHERE id = ?`,
        [
          montoAnticipo, montoAnticipo, metodoAnticipo,
          metodoAnticipo === 'transferencia' ? (cuentaBancariaId || null) : null,
          reparacionId
        ]
      );

      // 5. Historial
      const metodoLabel = metodoAnticipo === 'efectivo' ? 'Efectivo'
        : metodoAnticipo === 'transferencia' ? 'Transferencia'
        : metodoAnticipo === 'tarjeta_bac' ? 'Tarjeta BAC'
        : metodoAnticipo === 'tarjeta_neonet' ? 'Tarjeta Neonet'
        : 'Tarjeta';
      const montoStr = `Q${(montoAnticipo / 100).toFixed(2)}`;
      await connection.query(
        `INSERT INTO reparaciones_historial (reparacion_id, estado, nota, user_nombre, tipo_evento, descripcion)
         VALUES (?, 'ANTICIPO_REGISTRADO', ?, ?, 'ANTICIPO_REGISTRADO', ?)`,
        [
          reparacionId,
          `Anticipo ${montoStr} (${metodoLabel}) – pendiente de confirmación en Caja/Bancos`,
          realizadoPor || 'Sistema',
          `Anticipo de ${montoStr} registrado por ${metodoLabel}. Pendiente de confirmación.`
        ]
      );

    } else if (!dejoAnticipo) {
      // Si se desmarcó el anticipo: limpiar movimientos PENDIENTES y resetear en reparación
      await connection.query(
        `DELETE FROM caja_chica
         WHERE referencia_tipo = 'REPARACION' AND referencia_id = ? AND estado = 'PENDIENTE'`,
        [reparacionId]
      );
      await connection.query(
        `DELETE FROM movimientos_bancarios
         WHERE referencia_tipo = 'REPARACION' AND referencia_id = ? AND estado = 'PENDIENTE'`,
        [reparacionId]
      );
      await connection.query(
        `UPDATE reparaciones
         SET monto_anticipo = 0, saldo_anticipo = 0, metodo_anticipo = NULL, cuenta_bancaria_anticipo_id = NULL
         WHERE id = ?`,
        [reparacionId]
      );
    }

    await connection.commit();

    res.status(200).json({
      success: true,
      message: isUpdate ? 'Checklist actualizado exitosamente' : 'Checklist creado exitosamente',
      data: {
        id: checkId,
        reparacionId,
        anticipoRegistrado: !!(dejoAnticipo && montoAnticipo > 0)
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error saving check equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar checklist',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Obtener checklist por reparación
exports.getCheckByReparacion = async (req, res) => {
  try {
    const { reparacionId } = req.params;

    const [checks] = await db.query(
      `SELECT ce.*,
              r.monto_anticipo, r.saldo_anticipo, r.metodo_anticipo,
              r.cuenta_bancaria_anticipo_id
       FROM check_equipo ce
       LEFT JOIN reparaciones r ON ce.reparacion_id = r.id
       WHERE ce.reparacion_id = ?
       ORDER BY ce.fecha_checklist DESC
       LIMIT 1`,
      [reparacionId]
    );

    if (checks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró checklist para esta reparación'
      });
    }

    const check = checks[0];

    // Verificar si el anticipo ya fue confirmado en Caja o Bancos
    let anticipo_confirmado = false;
    if (check.monto_anticipo && check.monto_anticipo > 0) {
      const [[{ cajaCnt }]] = await db.query(
        `SELECT COUNT(*) AS cajaCnt FROM caja_chica
         WHERE referencia_tipo = 'REPARACION' AND referencia_id = ? AND estado = 'CONFIRMADO'`,
        [reparacionId]
      );
      const [[{ bancoCnt }]] = await db.query(
        `SELECT COUNT(*) AS bancoCnt FROM movimientos_bancarios
         WHERE referencia_tipo = 'REPARACION' AND referencia_id = ? AND estado = 'CONFIRMADO'`,
        [reparacionId]
      );
      anticipo_confirmado = cajaCnt > 0 || bancoCnt > 0;
    }
    check.anticipo_confirmado = anticipo_confirmado;

    // Parsear JSON fields
    if (check.telefono_checks) check.telefono_checks = JSON.parse(check.telefono_checks);
    if (check.tablet_checks) check.tablet_checks = JSON.parse(check.tablet_checks);
    if (check.computadora_checks) check.computadora_checks = JSON.parse(check.computadora_checks);
    if (check.fotos_checklist) check.fotos_checklist = JSON.parse(check.fotos_checklist);

    res.json({
      success: true,
      data: check
    });

  } catch (error) {
    console.error('Error getting check equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener checklist',
      error: error.message
    });
  }
};

// Obtener todos los checklists (para listados)
exports.getAllChecks = async (req, res) => {
  try {
    const [checks] = await db.query(
      `SELECT 
        id, 
        reparacion_id, 
        fecha_checklist,
        realizado_por
       FROM check_equipo 
       ORDER BY fecha_checklist DESC`
    );

    res.json({
      success: true,
      data: checks
    });

  } catch (error) {
    console.error('Error getting all checks:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener checklists',
      error: error.message
    });
  }
};

// Actualizar checklist
exports.updateCheckEquipo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      checksGenerales,
      checksEspecificos,
      observaciones,
      fotosChecklist,
      realizadoPor
    } = req.body;

    // Obtener tipo de equipo del check existente
    const [existing] = await db.query(
      `SELECT tipo_equipo FROM check_equipo WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Checklist no encontrado'
      });
    }

    const tipoEquipo = existing[0].tipo_equipo;
    let telefonoChecks = null;
    let tabletChecks = null;
    let computadoraChecks = null;

    if (tipoEquipo === 'Telefono') {
      telefonoChecks = JSON.stringify(checksEspecificos);
    } else if (tipoEquipo === 'Tablet') {
      tabletChecks = JSON.stringify(checksEspecificos);
    } else if (tipoEquipo === 'Computadora' || tipoEquipo === 'Laptop') {
      computadoraChecks = JSON.stringify(checksEspecificos);
    }

    await db.query(
      `UPDATE check_equipo SET
        enciende = ?,
        tactil_funciona = ?,
        pantalla_ok = ?,
        bateria_ok = ?,
        carga_ok = ?,
        telefono_checks = ?,
        tablet_checks = ?,
        computadora_checks = ?,
        observaciones = ?,
        fotos_checklist = ?,
        realizado_por = ?
      WHERE id = ?`,
      [
        checksGenerales.enciende || false,
        checksGenerales.tactilFunciona || false,
        checksGenerales.pantallaOk || false,
        checksGenerales.bateriaOk || false,
        checksGenerales.cargaOk || false,
        telefonoChecks,
        tabletChecks,
        computadoraChecks,
        observaciones || null,
        fotosChecklist ? JSON.stringify(fotosChecklist) : null,
        realizadoPor || 'Sistema',
        id
      ]
    );

    res.json({
      success: true,
      message: 'Checklist actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error updating check equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar checklist',
      error: error.message
    });
  }
};

module.exports = exports;
