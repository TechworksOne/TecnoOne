const pool = require('../config/database');

// ── Role helpers ──────────────────────────────────────────────────────────────
function resolveRole(user) {
  const list   = Array.isArray(user.roles) ? user.roles : [];
  const legacy = String(user.role || '').toLowerCase().trim();
  if (list.includes('ADMINISTRADOR') || legacy === 'admin' || legacy === 'administrador') return 'admin';
  if (list.includes('TECNICO')       || legacy === 'tecnico')                             return 'tecnico';
  if (list.includes('VENTAS')        || legacy === 'ventas')                              return 'ventas';
  return 'ventas'; // empleado sin rol específico → sin datos sensibles
}

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

function tenantClause(req, alias = null) {
  if (isSuperadminTenant(req)) return { sql: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { sql: ` AND ${prefix}empresa_id = ?`, params: [requireTenantEmpresaId(req)] };
}

exports.getDashboardStats = async (req, res) => {
  const callerRole = resolveRole(req.user);
  if (callerRole === 'tecnico') {
    return res.status(403).json({ error: 'Acceso denegado. Endpoint exclusivo para administradores.' });
  }

  try {
    const connection = await pool.getConnection();
    const ventasTenant = tenantClause(req);
    const cajaTenant = tenantClause(req);
    const comprasTenant = tenantClause(req);
    const productosTenant = tenantClause(req);
    const reparacionesTenant = tenantClause(req);
    const reparacionesAliasTenant = tenantClause(req, 'r');
    const clientesTenant = tenantClause(req);
    const cotizacionesTenant = tenantClause(req);

    // ── Ventas hoy ───────────────────────────────────────────────────────────
    const [[ventasHoy]] = await connection.query(`
      SELECT
        COUNT(*) AS cantidad,
        COALESCE(SUM(total), 0) AS ingresos
      FROM ventas
      WHERE DATE(COALESCE(fecha_venta, created_at)) = CURDATE()
        AND estado != 'ANULADA'
        ${ventasTenant.sql}
    `, ventasTenant.params);

    // ── Ventas mes actual ────────────────────────────────────────────────────
    const [[ventasMes]] = await connection.query(`
      SELECT
        COUNT(*) AS cantidad,
        COALESCE(SUM(total), 0) AS ingresos
      FROM ventas
      WHERE MONTH(COALESCE(fecha_venta, created_at)) = MONTH(CURDATE())
        AND YEAR(COALESCE(fecha_venta, created_at))  = YEAR(CURDATE())
        AND estado != 'ANULADA'
        ${ventasTenant.sql}
    `, ventasTenant.params);

    // ── Ventas mes anterior (para comparación %) ─────────────────────────────
    const [[ventasMesAnterior]] = await connection.query(`
      SELECT COALESCE(SUM(total), 0) AS ingresos
      FROM ventas
      WHERE MONTH(COALESCE(fecha_venta, created_at)) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        AND YEAR(COALESCE(fecha_venta, created_at))  = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        AND estado != 'ANULADA'
        ${ventasTenant.sql}
    `, ventasTenant.params);

    // ── Egresos de caja mes (gastos operativos) ──────────────────────────────
    const [[egresosCaja]] = await connection.query(`
      SELECT COALESCE(SUM(monto), 0) AS total
      FROM caja_chica
      WHERE tipo_movimiento = 'EGRESO'
        AND estado = 'CONFIRMADO'
        AND MONTH(fecha_movimiento) = MONTH(CURDATE())
        AND YEAR(fecha_movimiento)  = YEAR(CURDATE())
        ${cajaTenant.sql}
    `, cajaTenant.params);

    // ── Compras mes actual ───────────────────────────────────────────────────
    const [[comprasMes]] = await connection.query(`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM compras
      WHERE MONTH(fecha_compra) = MONTH(CURDATE())
        AND YEAR(fecha_compra)  = YEAR(CURDATE())
        AND estado IN ('CONFIRMADA', 'RECIBIDA')
        ${comprasTenant.sql}
    `, comprasTenant.params);

    // ── Compras mes anterior ─────────────────────────────────────────────────
    const [[comprasMesAnterior]] = await connection.query(`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM compras
      WHERE MONTH(fecha_compra) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        AND YEAR(fecha_compra)  = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        AND estado IN ('CONFIRMADA', 'RECIBIDA')
        ${comprasTenant.sql}
    `, comprasTenant.params);

    // ── Tendencia 7 días ─────────────────────────────────────────────────────
    const [tendenciaRows] = await connection.query(`
      SELECT
        DATE(COALESCE(fecha_venta, created_at)) AS fecha,
        COUNT(*) AS ventas,
        COALESCE(SUM(total), 0) AS ingresos
      FROM ventas
      WHERE COALESCE(fecha_venta, created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        AND estado != 'ANULADA'
        ${ventasTenant.sql}
      GROUP BY DATE(COALESCE(fecha_venta, created_at))
      ORDER BY fecha ASC
    `, ventasTenant.params);

    // ── Productos ────────────────────────────────────────────────────────────
    const [[productos]] = await connection.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN stock > 0 AND stock <= stock_minimo THEN 1 ELSE 0 END) AS bajo_stock,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) AS sin_stock
      FROM productos
      WHERE 1=1${productosTenant.sql}
    `, productosTenant.params);

    // ── Reparaciones activas ─────────────────────────────────────────────────
    const [[reparaciones]] = await connection.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN r.id IN (SELECT DISTINCT reparacion_id FROM check_equipo) THEN 1 ELSE 0 END) AS con_checklist,
        SUM(CASE WHEN r.id NOT IN (SELECT DISTINCT reparacion_id FROM check_equipo) THEN 1 ELSE 0 END) AS sin_checklist,
        SUM(CASE WHEN estado = 'COMPLETADA' THEN 1 ELSE 0 END) AS completadas
      FROM reparaciones r
      WHERE estado NOT IN ('ENTREGADA', 'CANCELADA')
        ${reparacionesAliasTenant.sql}
    `, reparacionesAliasTenant.params);

    // ── Reparaciones completadas este mes ────────────────────────────────────
    const [[repsMes]] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM reparaciones
      WHERE estado IN ('COMPLETADA', 'ENTREGADA')
        AND MONTH(COALESCE(fecha_cierre, updated_at)) = MONTH(CURDATE())
        AND YEAR(COALESCE(fecha_cierre, updated_at))  = YEAR(CURDATE())
        ${reparacionesTenant.sql}
    `, reparacionesTenant.params);

    // ── Reparaciones atrasadas ───────────────────────────────────────────────
    const [[repsAtrasadas]] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM reparaciones
      WHERE estado NOT IN ('COMPLETADA', 'ENTREGADA', 'CANCELADA')
        AND fecha_estimada_entrega IS NOT NULL
        AND fecha_estimada_entrega < CURDATE()
        ${reparacionesTenant.sql}
    `, reparacionesTenant.params);

    // ── Cotizaciones ─────────────────────────────────────────────────────────
    const [[cotizaciones]] = await connection.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS abiertas
      FROM cotizaciones
      WHERE 1=1${cotizacionesTenant.sql}
    `, cotizacionesTenant.params);

    // ── Tasa conversión cotizaciones (mes actual) ────────────────────────────
    const [[cotizMes]] = await connection.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN estado IN ('APROBADA', 'ACEPTADA') THEN 1 ELSE 0 END) AS aceptadas
      FROM cotizaciones
      WHERE MONTH(created_at) = MONTH(CURDATE())
        AND YEAR(created_at)  = YEAR(CURDATE())
        ${cotizacionesTenant.sql}
    `, cotizacionesTenant.params);

    // ── Clientes nuevos este mes ─────────────────────────────────────────────
    let clientesNuevosMes = 0;
    let clientesTotal = 0;
    try {
      const [[cliNuevos]] = await connection.query(`
        SELECT COUNT(*) AS total FROM clientes
        WHERE MONTH(created_at) = MONTH(CURDATE())
          AND YEAR(created_at)  = YEAR(CURDATE())
          AND activo = 1
          ${clientesTenant.sql}
      `, clientesTenant.params);
      const [[cliTotal]] = await connection.query(`SELECT COUNT(*) AS total FROM clientes WHERE activo = 1${clientesTenant.sql}`, clientesTenant.params);
      clientesNuevosMes = Number(cliNuevos.total) || 0;
      clientesTotal     = Number(cliTotal.total)  || 0;
    } catch (_) { /* tabla puede no tener created_at */ }

    connection.release();

    // ── Cálculos financieros (método periódico: ganancia = ingresos - compras) ─
    const ingresosMes      = Number(ventasMes.ingresos) || 0;
    const comprasMesTotal  = Number(comprasMes.total)   || 0;
    const egresosCajaMes   = Number(egresosCaja.total)  || 0;
    const gananciaBrutaMes = ingresosMes - comprasMesTotal;          // P&L periódico
    const gananciaNeta     = gananciaBrutaMes - egresosCajaMes;
    const margenBruto      = ingresosMes > 0 ? (gananciaBrutaMes / ingresosMes) * 100 : 0;
    const ticketPromedio   = Number(ventasMes.cantidad) > 0
      ? Math.round(ingresosMes / Number(ventasMes.cantidad)) : 0;

    // % cambio vs mes anterior (mismo método periódico)
    const ingresosMA      = Number(ventasMesAnterior.ingresos)    || 0;
    const comprasMA       = Number(comprasMesAnterior.total)      || 0;
    const gananciMA       = ingresosMA - comprasMA;
    const cambioIngresos  = ingresosMA > 0
      ? ((ingresosMes - ingresosMA) / ingresosMA) * 100 : null;
    const cambioGanancia  = gananciMA !== 0
      ? ((gananciaBrutaMes - gananciMA) / Math.abs(gananciMA)) * 100 : null;

    // Ganancia estimada hoy: aplica margen del mes a los ingresos de hoy
    const ingresosHoy = Number(ventasHoy.ingresos) || 0;
    const gananciaHoyEstimada = margenBruto > 0
      ? Math.round(ingresosHoy * (margenBruto / 100)) : 0;

    // Tasa de conversión cotizaciones
    const conversionRate = Number(cotizMes.total) > 0
      ? Math.round((Number(cotizMes.aceptadas) / Number(cotizMes.total)) * 100) : 0;

    // Tendencia — rellenar días sin ventas con cero
    const today = new Date();
    const tendencia = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const row = tendenciaRows.find(r => {
        const rDate = typeof r.fecha === 'string' ? r.fecha : new Date(r.fecha).toISOString().split('T')[0];
        return rDate === key;
      });
      tendencia.push({
        fecha:    key,
        ventas:   row ? Number(row.ventas)   : 0,
        ingresos: row ? Math.round(Number(row.ingresos) / 100) : 0,
        ganancia: row ? Math.round(Number(row.ingresos) * (margenBruto / 100) / 100) : 0,
      });
    }

    const resultado = {
      dashboardType: 'admin',

      // ── Bloque financiero completo (solo admin) ──────────────────────────
      financiero: {
        ingresos_hoy:        Math.round(ingresosHoy / 100),
        ganancia_hoy:        Math.round(gananciaHoyEstimada / 100),
        ventas_hoy:          Number(ventasHoy.cantidad),
        ingresos_mes:        Math.round(ingresosMes / 100),
        costo_ventas_mes:    Math.round(comprasMesTotal / 100),
        ganancia_bruta_mes:  Math.round(gananciaBrutaMes / 100),
        ganancia_neta_mes:   Math.round(gananciaNeta / 100),
        egresos_caja_mes:    Math.round(egresosCajaMes / 100),
        compras_mes:         Math.round(comprasMesTotal / 100),
        margen_bruto:        Math.round(margenBruto * 10) / 10,
        ticket_promedio:     Math.round(ticketPromedio / 100),
        ventas_mes:          Number(ventasMes.cantidad),
        cambio_ingresos_pct: cambioIngresos !== null ? Math.round(cambioIngresos * 10) / 10 : null,
        cambio_ganancia_pct: cambioGanancia !== null ? Math.round(cambioGanancia * 10) / 10 : null,
      },

      // ── Tendencia 7 días ─────────────────────────────────────────────────
      tendencia,

      // ── Campos legacy (compatibilidad con el resto del frontend) ────────
      ventas: {
        hoy:      Math.round(Number(ventasHoy.ingresos) / 100),
        mes:      Math.round(ingresosMes / 100),
        total:    0,
        cantidad: Number(ventasHoy.cantidad),
      },
      productos: {
        total:      Number(productos.total)      || 0,
        bajo_stock: Number(productos.bajo_stock) || 0,
        sin_stock:  Number(productos.sin_stock)  || 0,
      },
      reparaciones: {
        total:           Number(reparaciones.total)         || 0,
        con_checklist:   Number(reparaciones.con_checklist) || 0,
        sin_checklist:   Number(reparaciones.sin_checklist) || 0,
        completadas:     Number(reparaciones.completadas)   || 0,
        completadas_mes: Number(repsMes.total)              || 0,
        atrasadas:       Number(repsAtrasadas.total)        || 0,
      },
      cotizaciones: {
        total:           Number(cotizaciones.total)  || 0,
        abiertas:        Number(cotizaciones.abiertas)|| 0,
        conversion_rate: conversionRate,
      },
      gastos: {
        mes: Math.round(comprasMesTotal / 100),
      },
      ganancias: {
        hoy: Math.round(gananciaHoyEstimada / 100),
        mes: Math.round(gananciaNeta / 100),
      },
      clientes: {
        nuevos_mes: clientesNuevosMes,
        total:      clientesTotal,
      },
    };

    res.json(resultado);
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    res.status(error.statusCode || 500).json({
      error: 'Error al cargar estadísticas del dashboard',
      details: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard técnico — estadísticas filtradas por técnico autenticado
// ═══════════════════════════════════════════════════════════════════════════
exports.getTecnicoDashboardStats = async (req, res) => {
  // Solo técnicos pueden acceder
  if (resolveRole(req.user) !== 'tecnico') {
    return res.status(403).json({ error: 'Acceso denegado. Endpoint exclusivo para técnicos.' });
  }

  console.log('[DashboardTecnico] req.user:', {
    id:       req.user?.id,
    username: req.user?.username,
    name:     req.user?.name,
    role:     req.user?.role,
  });
  console.log('[DashboardTecnico] usando filtro tecnico_asignado_id:', req.user?.id);

  const tecnicoId = req.user.id;
  const reparacionesTenant = tenantClause(req);
  const reparacionesAliasTenant = tenantClause(req, 'r');

  try {
    const connection = await pool.getConnection();

    // Obtener nombre del técnico
    const [[userRow]] = await connection.query(
      'SELECT name, username FROM users WHERE id = ?',
      [tecnicoId]
    );
    if (!userRow) {
      connection.release();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const tecnicoNombre = userRow.name;

    // 1. Total asignadas (activas)
    const [[totalAsignadas]] = await connection.query(`
      SELECT COUNT(*) AS total FROM reparaciones
      WHERE tecnico_asignado_id = ?
        AND estado NOT IN ('ENTREGADA', 'CANCELADA')
        ${reparacionesTenant.sql}
    `, [tecnicoId, ...reparacionesTenant.params]);

    // 2. En proceso
    const [[enProceso]] = await connection.query(`
      SELECT COUNT(*) AS total FROM reparaciones
      WHERE tecnico_asignado_id = ?
        AND estado IN ('EN_DIAGNOSTICO','EN_REPARACION','EN_PROCESO',
                       'AUTORIZADA','ESPERANDO_AUTORIZACION','STAND_BY','ESPERANDO_PIEZA')
        ${reparacionesTenant.sql}
    `, [tecnicoId, ...reparacionesTenant.params]);

    // 3. Pendientes (recibidas pero sin iniciar trabajo)
    const [[pendientes]] = await connection.query(`
      SELECT COUNT(*) AS total FROM reparaciones
      WHERE tecnico_asignado_id = ?
        AND estado IN ('RECIBIDA','ANTICIPO_REGISTRADO')
        ${reparacionesTenant.sql}
    `, [tecnicoId, ...reparacionesTenant.params]);

    // 4. Listas para entregar
    const [[listas]] = await connection.query(`
      SELECT COUNT(*) AS total FROM reparaciones
      WHERE tecnico_asignado_id = ? AND estado = 'COMPLETADA'
        ${reparacionesTenant.sql}
    `, [tecnicoId, ...reparacionesTenant.params]);

    // 5. Atrasadas (fecha_estimada_entrega pasó y aún no cerrada)
    const [[atrasadas]] = await connection.query(`
      SELECT COUNT(*) AS total FROM reparaciones
      WHERE tecnico_asignado_id = ?
        AND estado NOT IN ('COMPLETADA','ENTREGADA','CANCELADA')
        AND fecha_estimada_entrega IS NOT NULL
        AND fecha_estimada_entrega < CURDATE()
        ${reparacionesTenant.sql}
    `, [tecnicoId, ...reparacionesTenant.params]);

    // 6. Sin checklist (activas sin entrada en check_equipo)
    const [[sinChecklist]] = await connection.query(`
      SELECT COUNT(*) AS total FROM reparaciones r
      WHERE r.tecnico_asignado_id = ?
        AND r.estado NOT IN ('ENTREGADA','CANCELADA')
        AND r.id NOT IN (SELECT DISTINCT reparacion_id FROM check_equipo)
        ${reparacionesAliasTenant.sql}
    `, [tecnicoId, ...reparacionesAliasTenant.params]);

    // 7. Finalizadas hoy
    const [[finalizadasHoy]] = await connection.query(`
      SELECT COUNT(*) AS total FROM reparaciones
      WHERE tecnico_asignado_id = ?
        AND estado IN ('COMPLETADA','ENTREGADA')
        AND DATE(COALESCE(fecha_cierre, updated_at)) = CURDATE()
        ${reparacionesTenant.sql}
    `, [tecnicoId, ...reparacionesTenant.params]);

    // 8. Finalizadas este mes
    const [[finalizadasMes]] = await connection.query(`
      SELECT COUNT(*) AS total FROM reparaciones
      WHERE tecnico_asignado_id = ?
        AND estado IN ('COMPLETADA','ENTREGADA')
        AND MONTH(COALESCE(fecha_cierre, updated_at)) = MONTH(CURDATE())
        AND YEAR(COALESCE(fecha_cierre, updated_at))  = YEAR(CURDATE())
        ${reparacionesTenant.sql}
    `, [tecnicoId, ...reparacionesTenant.params]);

    // 9. Repuestos/ítems usados este mes
    const [[repuestosUsados]] = await connection.query(`
      SELECT COALESCE(SUM(ri.cantidad), 0) AS total
      FROM reparaciones_items ri
      JOIN reparaciones r ON r.id = ri.reparacion_id
      WHERE r.tecnico_asignado_id = ?
        AND MONTH(r.fecha_ingreso) = MONTH(CURDATE())
        AND YEAR(r.fecha_ingreso)  = YEAR(CURDATE())
        ${reparacionesAliasTenant.sql}
    `, [tecnicoId, ...reparacionesAliasTenant.params]);

    // 10. Conteo por estado
    const [estadosBD] = await connection.query(`
      SELECT estado, COUNT(*) AS total
      FROM reparaciones
      WHERE tecnico_asignado_id = ? AND estado NOT IN ('ENTREGADA','CANCELADA')
        ${reparacionesTenant.sql}
      GROUP BY estado
    `, [tecnicoId, ...reparacionesTenant.params]);

    // 11. Lista de reparaciones activas (hasta 10, priorizando ALTA)
    const [reparacionesActivas] = await connection.query(`
      SELECT r.id, r.cliente_nombre, r.tipo_equipo, r.marca, r.modelo,
             r.estado, r.prioridad, r.fecha_ingreso, r.fecha_estimada_entrega,
             r.observaciones, r.tecnico_asignado_id, r.asignado_en,
             t.name AS tecnico_nombre, t.username AS tecnico_username
      FROM reparaciones r
      LEFT JOIN users t ON t.id = r.tecnico_asignado_id
      WHERE r.tecnico_asignado_id = ? AND r.estado NOT IN ('ENTREGADA','CANCELADA')
        ${reparacionesAliasTenant.sql}
      ORDER BY
        CASE r.prioridad WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
        r.created_at DESC
      LIMIT 10
    `, [tecnicoId, ...reparacionesAliasTenant.params]);

    // 12. Actividad reciente (últimos 8 eventos del historial de sus reparaciones)
    const [actividadReciente] = await connection.query(`
      SELECT h.reparacion_id, h.estado, h.nota, h.user_nombre, h.created_at,
             r.cliente_nombre, r.tipo_equipo, r.marca, r.modelo
      FROM reparaciones_historial h
      JOIN reparaciones r ON r.id = h.reparacion_id
      WHERE r.tecnico_asignado_id = ?
        ${reparacionesAliasTenant.sql}
      ORDER BY h.created_at DESC
      LIMIT 8
    `, [tecnicoId, ...reparacionesAliasTenant.params]);

    connection.release();

    // Convertir listado de estados a objeto
    const estados = {};
    estadosBD.forEach(row => { estados[row.estado] = row.total; });

    res.json({
      dashboardType: 'tecnico',
      tecnico: tecnicoNombre,
      stats: {
        asignadas:            totalAsignadas.total  || 0,
        en_proceso:           enProceso.total        || 0,
        pendientes:           pendientes.total        || 0,
        listas_para_entregar: listas.total            || 0,
        atrasadas:            atrasadas.total         || 0,
        sin_checklist:        sinChecklist.total      || 0,
        finalizadas_hoy:      finalizadasHoy.total    || 0,
        finalizadas_mes:      finalizadasMes.total    || 0,
        repuestos_usados_mes: repuestosUsados.total   || 0,
      },
      estados,
      reparaciones: reparacionesActivas,
      actividad:    actividadReciente,
    });
  } catch (error) {
    console.error('Error loading tecnico dashboard stats:', error);
    res.status(error.statusCode || 500).json({
      error: 'Error al cargar estadísticas del técnico',
      details: error.message,
    });
  }
};

// ── Dashboard de Ventas (sin datos financieros sensibles) ─────────────────────
exports.getVentasDashboard = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const ventasTenant = tenantClause(req);
    const reparacionesTenant = tenantClause(req);
    const productosTenant = tenantClause(req);
    const cotizacionesTenant = tenantClause(req);

    // ── Ventas hoy ───────────────────────────────────────────────────────────
    const [[ventasHoy]] = await connection.query(`
      SELECT COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS monto
      FROM ventas
      WHERE DATE(COALESCE(fecha_venta, created_at)) = CURDATE()
        AND estado != 'ANULADA'
        ${ventasTenant.sql}
    `, ventasTenant.params);

    // ── Ventas mes actual ────────────────────────────────────────────────────
    const [[ventasMes]] = await connection.query(`
      SELECT COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS monto
      FROM ventas
      WHERE MONTH(COALESCE(fecha_venta, created_at)) = MONTH(CURDATE())
        AND YEAR(COALESCE(fecha_venta, created_at))  = YEAR(CURDATE())
        AND estado != 'ANULADA'
        ${ventasTenant.sql}
    `, ventasTenant.params);

    // ── Ventas mes anterior (comparación %) ──────────────────────────────────
    const [[ventasMesAnterior]] = await connection.query(`
      SELECT COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS monto
      FROM ventas
      WHERE MONTH(COALESCE(fecha_venta, created_at)) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        AND YEAR(COALESCE(fecha_venta, created_at))  = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        AND estado != 'ANULADA'
        ${ventasTenant.sql}
    `, ventasTenant.params);

    // ── Cotizaciones abiertas (BORRADOR + ENVIADA) con valor total ────────────
    const [[cotizaciones]] = await connection.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN estado IN ('BORRADOR', 'ENVIADA') THEN 1 ELSE 0 END) AS abiertas,
        COALESCE(SUM(CASE WHEN estado IN ('BORRADOR', 'ENVIADA') THEN total ELSE 0 END), 0) AS valor_abierto
      FROM cotizaciones
      WHERE 1=1${cotizacionesTenant.sql}
    `, cotizacionesTenant.params);

    // ── Reparaciones: activas + COMPLETADAS (listas para entregar) ────────────
    const [[reparaciones]] = await connection.query(`
      SELECT
        COUNT(CASE WHEN estado NOT IN ('ENTREGADA', 'CANCELADA', 'COMPLETADA') THEN 1 END) AS activas,
        COUNT(CASE WHEN estado = 'COMPLETADA' THEN 1 END) AS listas
      FROM reparaciones
      WHERE 1=1${reparacionesTenant.sql}
    `, reparacionesTenant.params);

    // ── Ventas con saldo pendiente (PARCIAL) ──────────────────────────────────
    const [[ventasParciales]] = await connection.query(`
      SELECT COUNT(*) AS cantidad, COALESCE(SUM(saldo_pendiente), 0) AS saldo
      FROM ventas
      WHERE estado = 'PARCIAL'
        ${ventasTenant.sql}
    `, ventasTenant.params);

    // ── Stock ─────────────────────────────────────────────────────────────────
    const [[stockInfo]] = await connection.query(`
      SELECT
        SUM(CASE WHEN stock = 0 AND activo = 1 THEN 1 ELSE 0 END) AS sin_stock,
        SUM(CASE WHEN stock > 0 AND stock <= stock_minimo AND activo = 1 THEN 1 ELSE 0 END) AS bajo_stock
      FROM productos
      WHERE 1=1${productosTenant.sql}
    `, productosTenant.params);

    // ── Clientes únicos hoy y este mes ────────────────────────────────────────
    const [[clientesInfo]] = await connection.query(`
      SELECT
        COUNT(DISTINCT CASE WHEN DATE(COALESCE(fecha_venta, created_at)) = CURDATE()
          AND estado != 'ANULADA' THEN cliente_id END) AS hoy,
        COUNT(DISTINCT CASE WHEN MONTH(COALESCE(fecha_venta, created_at)) = MONTH(CURDATE())
          AND YEAR(COALESCE(fecha_venta, created_at)) = YEAR(CURDATE())
          AND estado != 'ANULADA' THEN cliente_id END) AS mes
      FROM ventas
      WHERE 1=1${ventasTenant.sql}
    `, ventasTenant.params);

    // ── Tendencia 7 días ──────────────────────────────────────────────────────
    const [tendenciaRows] = await connection.query(`
      SELECT
        DATE(COALESCE(fecha_venta, created_at)) AS fecha,
        COUNT(*) AS ventas,
        COALESCE(SUM(total), 0) AS ingresos
      FROM ventas
      WHERE COALESCE(fecha_venta, created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        AND estado != 'ANULADA'
        ${ventasTenant.sql}
      GROUP BY DATE(COALESCE(fecha_venta, created_at))
      ORDER BY fecha ASC
    `, ventasTenant.params);

    connection.release();

    // ── Cálculos derivados ────────────────────────────────────────────────────
    const hoyCant  = Number(ventasHoy.cantidad)        || 0;
    const hoyMonto = Number(ventasHoy.monto)           || 0;
    const mesCant  = Number(ventasMes.cantidad)        || 0;
    const mesMonto = Number(ventasMes.monto)           || 0;
    const mesAntMonto = Number(ventasMesAnterior.monto) || 0;

    const ticketHoy = hoyCant > 0 ? Math.round(hoyMonto / hoyCant / 100) : 0;
    const ticketMes = mesCant > 0 ? Math.round(mesMonto / mesCant / 100) : 0;
    const cambioMes = mesAntMonto > 0
      ? Math.round(((mesMonto - mesAntMonto) / mesAntMonto) * 1000) / 10
      : null;

    // Gap-fill tendencia
    const today = new Date();
    const tendencia = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const row = tendenciaRows.find(r => {
        const rDate = typeof r.fecha === 'string' ? r.fecha : new Date(r.fecha).toISOString().split('T')[0];
        return rDate === key;
      });
      tendencia.push({
        fecha:    key,
        ventas:   row ? Number(row.ventas)   : 0,
        ingresos: row ? Math.round(Number(row.ingresos) / 100) : 0,
      });
    }

    res.json({
      dashboardType: 'ventas',
      ventasHoy:         { cantidad: hoyCant, total: Math.round(hoyMonto / 100) },
      ventasMes:         { cantidad: mesCant, total: Math.round(mesMonto / 100) },
      ventasMesAnterior: { cantidad: Number(ventasMesAnterior.cantidad) || 0, total: Math.round(mesAntMonto / 100) },
      cambioMes,
      ticketHoy,
      ticketMes,
      cotizaciones: {
        total:        Number(cotizaciones.total)        || 0,
        abiertas:     Number(cotizaciones.abiertas)     || 0,
        valor_abierto: Math.round(Number(cotizaciones.valor_abierto) || 0),
      },
      reparaciones: {
        activas: Number(reparaciones.activas) || 0,
        listas:  Number(reparaciones.listas)  || 0,
      },
      ventasParciales: {
        cantidad: Number(ventasParciales.cantidad) || 0,
        saldo:    Math.round((Number(ventasParciales.saldo) || 0) / 100),
      },
      stock: {
        sin_stock:  Number(stockInfo.sin_stock)  || 0,
        bajo_stock: Number(stockInfo.bajo_stock) || 0,
      },
      stockBajo:   Number(stockInfo.bajo_stock) || 0,  // legacy
      clientesHoy: Number(clientesInfo.hoy) || 0,
      clientesMes: Number(clientesInfo.mes) || 0,
      tendencia,
    });
  } catch (error) {
    console.error('Error loading ventas dashboard stats:', error);
    res.status(error.statusCode || 500).json({
      error: 'Error al cargar estadísticas de ventas',
      details: error.message,
    });
  }
};

// ── Dispatcher unificado: detecta rol y devuelve el dashboard correcto ─────────
exports.getDashboard = async (req, res) => {
  const role = resolveRole(req.user);
  if (role === 'tecnico') return exports.getTecnicoDashboardStats(req, res);
  if (role === 'ventas')  return exports.getVentasDashboard(req, res);
  return exports.getDashboardStats(req, res); // admin
};
