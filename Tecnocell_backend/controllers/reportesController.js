const db = require('../config/database');
const { sendSafeControllerError } = require('../utils/safeControllerError');
const { calculateProfit } = require('../utils/reportFinancialMetrics');
const { parsePagination, parseLimit } = require('../utils/pagination');
const {
  normalizeScope, reportScopeClause, inventoryStockClause, validateDate, validateRange,
} = require('../services/reportScopeService');

// ===== HELPERS =====

function parseItems(itemsField) {
  if (!itemsField) return [];
  try {
    const arr = typeof itemsField === 'string' ? JSON.parse(itemsField) : itemsField;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function salesByBranch(req, dateSql = '', dateParams = []) {
  const scoped = reportScopeClause(req, 'v');
  if (scoped.scope.mode !== 'consolidated') return undefined;
  const [rows] = await db.query(`
    SELECT v.sucursal_id, s.nombre AS sucursal_nombre,
           COUNT(*) AS ventas, COALESCE(SUM(v.total), 0) AS ingresos
    FROM ventas v
    INNER JOIN sucursales s ON s.id = v.sucursal_id AND s.empresa_id = v.empresa_id
    WHERE v.estado != 'ANULADA' ${dateSql} ${scoped.sql}
    GROUP BY v.sucursal_id, s.nombre ORDER BY s.nombre, v.sucursal_id
  `, [...dateParams, ...scoped.params]);
  return rows.map(row => ({ ...row, ventas: Number(row.ventas), ingresos: Number(row.ingresos) / 100 }));
}

async function managementMetrics(req, desde, hasta) {
  const scope = normalizeScope(req);
  const comprasScope = reportScopeClause(req, 'c');
  const cajaScope = reportScopeClause(req, 'cs');
  const reparacionesScope = reportScopeClause(req, 'r');
  const productoMovScope = reportScopeClause(req, 'pm');
  const repuestoMovScope = reportScopeClause(req, 'rm');

  const [[compras]] = await db.query(`
    SELECT COUNT(*) AS cantidad, COALESCE(SUM(c.total), 0) AS total
    FROM compras c WHERE c.estado IN ('CONFIRMADA','RECIBIDA')
      AND DATE(c.fecha_compra) BETWEEN ? AND ? ${comprasScope.sql}`,
  [desde, hasta, ...comprasScope.params]);
  const [[caja]] = await db.query(`
    SELECT SUM(DATE(cs.fecha_apertura) BETWEEN ? AND ?) AS abiertas,
      SUM(cs.fecha_cierre IS NOT NULL AND DATE(cs.fecha_cierre) BETWEEN ? AND ?) AS cerradas,
      COALESCE(SUM(CASE WHEN DATE(cs.fecha_apertura) BETWEEN ? AND ? THEN cs.fondo_inicial_centavos ELSE 0 END), 0) AS apertura,
      COALESCE(SUM(CASE WHEN DATE(cs.fecha_cierre) BETWEEN ? AND ? THEN cs.efectivo_contado_centavos ELSE 0 END), 0) AS cierre,
      COALESCE(SUM(CASE WHEN DATE(cs.fecha_cierre) BETWEEN ? AND ? THEN cs.diferencia_centavos ELSE 0 END), 0) AS diferencia,
      COALESCE(SUM(CASE WHEN DATE(cs.fecha_cierre) BETWEEN ? AND ? AND cs.diferencia_centavos > 0 THEN cs.diferencia_centavos ELSE 0 END), 0) AS sobrantes,
      COALESCE(SUM(CASE WHEN DATE(cs.fecha_cierre) BETWEEN ? AND ? AND cs.diferencia_centavos < 0 THEN -cs.diferencia_centavos ELSE 0 END), 0) AS faltantes
    FROM caja_sesiones cs
    WHERE (DATE(cs.fecha_apertura) BETWEEN ? AND ? OR DATE(cs.fecha_cierre) BETWEEN ? AND ?) ${cajaScope.sql}`,
  [desde, hasta, desde, hasta, desde, hasta, desde, hasta, desde, hasta,
    desde, hasta, desde, hasta, desde, hasta, desde, hasta, ...cajaScope.params]);
  const [[reparaciones]] = await db.query(`
    SELECT COUNT(*) AS creadas,
      SUM(r.estado IN ('COMPLETADA','ENTREGADA')) AS finalizadas,
      SUM(r.estado = 'CANCELADA') AS canceladas,
      SUM(r.estado NOT IN ('COMPLETADA','ENTREGADA','CANCELADA')) AS pendientes
    FROM reparaciones r WHERE DATE(r.fecha_ingreso) BETWEEN ? AND ? ${reparacionesScope.sql}`,
  [desde, hasta, ...reparacionesScope.params]);
  const [[productosMov]] = await db.query(`
    SELECT COALESCE(SUM(CASE WHEN pm.tipo LIKE '%entrada%' OR pm.tipo LIKE '%recepcion%' THEN ABS(pm.cantidad) ELSE 0 END),0) AS entradas,
      COALESCE(SUM(CASE WHEN pm.tipo LIKE '%salida%' OR pm.tipo LIKE '%venta%' OR pm.tipo LIKE '%reparacion%' THEN ABS(pm.cantidad) ELSE 0 END),0) AS salidas,
      COALESCE(SUM(CASE WHEN pm.tipo LIKE '%ajuste%' THEN ABS(pm.cantidad) ELSE 0 END),0) AS ajustes
    FROM producto_movimientos pm WHERE DATE(pm.created_at) BETWEEN ? AND ? ${productoMovScope.sql}`,
  [desde, hasta, ...productoMovScope.params]);
  const [[repuestosMov]] = await db.query(`
    SELECT COALESCE(SUM(CASE WHEN rm.tipo LIKE '%entrada%' OR rm.tipo LIKE '%recepcion%' OR rm.tipo LIKE '%devolucion%' THEN ABS(rm.cantidad) ELSE 0 END),0) AS entradas,
      COALESCE(SUM(CASE WHEN rm.tipo LIKE '%salida%' OR rm.tipo LIKE '%venta%' OR rm.tipo LIKE '%reparacion%' THEN ABS(rm.cantidad) ELSE 0 END),0) AS salidas,
      COALESCE(SUM(CASE WHEN rm.tipo LIKE '%ajuste%' THEN ABS(rm.cantidad) ELSE 0 END),0) AS ajustes
    FROM repuesto_movimientos rm WHERE DATE(rm.created_at) BETWEEN ? AND ? ${repuestoMovScope.sql}`,
  [desde, hasta, ...repuestoMovScope.params]);

  let stockProductos = 0, stockRepuestos = 0;
  if (scope.sucursalIds.length) {
    const placeholders = scope.sucursalIds.map(() => '?').join(',');
    ([[{ total: stockProductos }]] = await db.query(
      `SELECT COALESCE(SUM(existencia),0) AS total FROM producto_existencias
       WHERE empresa_id = ? AND sucursal_id IN (${placeholders})`, [scope.empresaId, ...scope.sucursalIds]));
    ([[{ total: stockRepuestos }]] = await db.query(
      `SELECT COALESCE(SUM(existencia),0) AS total FROM repuesto_existencias
       WHERE empresa_id = ? AND sucursal_id IN (${placeholders})`, [scope.empresaId, ...scope.sucursalIds]));
  }

  let porSucursal;
  if (scope.mode === 'consolidated' && scope.sucursalIds.length) {
    const [rows] = await db.query(`
      SELECT s.id AS sucursal_id, s.nombre AS sucursal_nombre,
        (SELECT COUNT(*) FROM compras c WHERE c.empresa_id=s.empresa_id AND c.sucursal_id=s.id
          AND c.estado IN ('CONFIRMADA','RECIBIDA') AND DATE(c.fecha_compra) BETWEEN ? AND ?) AS compras_cantidad,
        (SELECT COALESCE(SUM(c.total),0) FROM compras c WHERE c.empresa_id=s.empresa_id AND c.sucursal_id=s.id
          AND c.estado IN ('CONFIRMADA','RECIBIDA') AND DATE(c.fecha_compra) BETWEEN ? AND ?) AS compras_total,
        (SELECT COUNT(*) FROM reparaciones r WHERE r.empresa_id=s.empresa_id AND r.sucursal_id=s.id
          AND DATE(r.fecha_ingreso) BETWEEN ? AND ?) AS reparaciones_creadas
      FROM sucursales s WHERE s.empresa_id=? AND s.id IN (${scope.sucursalIds.map(() => '?').join(',')})
      ORDER BY s.nombre, s.id`, [desde, hasta, desde, hasta, desde, hasta, scope.empresaId, ...scope.sucursalIds]);
    porSucursal = rows.map(row => ({ ...row, compras_cantidad: Number(row.compras_cantidad), compras_total: Number(row.compras_total) }));
  }

  return {
    compras: { cantidad: Number(compras.cantidad || 0), total: Number(compras.total || 0) },
    caja_operativa: {
      sesiones_abiertas: Number(caja.abiertas || 0), sesiones_cerradas: Number(caja.cerradas || 0),
      monto_apertura: Number(caja.apertura || 0) / 100, monto_cierre: Number(caja.cierre || 0) / 100,
      diferencia: Number(caja.diferencia || 0) / 100, sobrantes: Number(caja.sobrantes || 0) / 100,
      faltantes: Number(caja.faltantes || 0) / 100,
    },
    reparaciones: Object.fromEntries(Object.entries(reparaciones).map(([key, value]) => [key, Number(value || 0)])),
    inventario: {
      entradas: Number(productosMov.entradas || 0) + Number(repuestosMov.entradas || 0),
      salidas: Number(productosMov.salidas || 0) + Number(repuestosMov.salidas || 0),
      ajustes: Number(productosMov.ajustes || 0) + Number(repuestosMov.ajustes || 0),
      stock_productos: Number(stockProductos || 0), stock_repuestos: Number(stockRepuestos || 0),
      stock_consolidado: Number(stockProductos || 0) + Number(stockRepuestos || 0),
    },
    ...(porSucursal ? { por_sucursal: porSucursal } : {}),
  };
}

async function getCostMaps(ventas, scope) {
  if (!ventas || ventas.length === 0) {
    return { productos: {}, repuestos: {}, missingCosts: false };
  }

  const prodIds = new Set();
  const repIds = new Set();

  for (const v of ventas) {
    for (const item of parseItems(v.items)) {
      const id = item.refId || item.ref_id;
      if (!id) continue;
      if (item.source === 'PRODUCTO') prodIds.add(id);
      else if (item.source === 'REPUESTO') repIds.add(id);
    }
  }

  const productos = {}, repuestos = {};
  let missingCosts = false;

  if (prodIds.size > 0) {
    const stock = inventoryStockClause(scope, 'p', 'producto_id');
    const [rows] = await db.query(
      `SELECT p.id, p.sku, p.nombre, p.categoria, p.precio_costo, p.precio_venta,
              ${stock.sql} AS stock
       FROM productos p WHERE p.id IN (?) AND p.empresa_id = ?`,
      [...stock.params, [...prodIds], scope.empresaId]
    );
    rows.forEach(r => {
      productos[r.id] = r;
      if (!r.precio_costo || r.precio_costo === 0) missingCosts = true;
    });
  }

  if (repIds.size > 0) {
    const stock = inventoryStockClause(scope, 'r', 'repuesto_id');
    const [rows] = await db.query(
      `SELECT r.id, r.sku, r.nombre, r.precio_costo, ${stock.sql} AS stock
       FROM repuestos r WHERE r.id IN (?) AND r.empresa_id = ?`,
      [...stock.params, [...repIds], scope.empresaId]
    );
    rows.forEach(r => {
      repuestos[r.id] = r;
      if (!r.precio_costo || r.precio_costo === 0) missingCosts = true;
    });
  }

  return { productos, repuestos, missingCosts };
}

function getCostoVenta(venta, costMaps) {
  let costo = 0, cantProd = 0, cantRep = 0;
  for (const item of parseItems(venta.items)) {
    const id = item.refId || item.ref_id;
    const qty = item.cantidad || 0;
    if (item.source === 'PRODUCTO') {
      costo += (costMaps.productos[id]?.precio_costo || 0) * qty;
      cantProd += qty;
    } else if (item.source === 'REPUESTO') {
      costo += (costMaps.repuestos[id]?.precio_costo || 0) * qty;
      cantRep += qty;
    }
  }
  return { costo, cantProd, cantRep };
}

// ===== RESUMEN =====
/**
 * GET /api/reportes/resumen
 * Métricas del día y mes actual
 */
exports.getResumen = async (req, res) => {
  try {
    const scope = normalizeScope(req);
    const ventasTenant = reportScopeClause(req, 'v');
    const ventasNoAliasTenant = reportScopeClause(req);
    const cajaTenant = reportScopeClause(req);
    const [ventasDia] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) = CURDATE()
      AND v.estado != 'ANULADA'
      ${ventasTenant.sql}
    `, ventasTenant.params);

    const [ventasMes] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE MONTH(COALESCE(v.fecha_venta, v.created_at)) = MONTH(CURDATE())
      AND YEAR(COALESCE(v.fecha_venta, v.created_at)) = YEAR(CURDATE())
      AND v.estado != 'ANULADA'
      ${ventasTenant.sql}
    `, ventasTenant.params);

    const [anuladas] = await db.query(`
      SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as monto
      FROM ventas
      WHERE MONTH(COALESCE(fecha_venta, created_at)) = MONTH(CURDATE())
      AND YEAR(COALESCE(fecha_venta, created_at)) = YEAR(CURDATE())
      AND estado = 'ANULADA'
      ${ventasNoAliasTenant.sql}
    `, ventasNoAliasTenant.params);

    const [egresosDia] = await db.query(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM caja_chica
      WHERE tipo_movimiento = 'EGRESO' AND estado = 'CONFIRMADO'
      AND DATE(fecha_movimiento) = CURDATE()
      ${cajaTenant.sql}
    `, cajaTenant.params);

    const [egresosMes] = await db.query(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM caja_chica
      WHERE tipo_movimiento = 'EGRESO' AND estado = 'CONFIRMADO'
      AND MONTH(fecha_movimiento) = MONTH(CURDATE())
      AND YEAR(fecha_movimiento) = YEAR(CURDATE())
      ${cajaTenant.sql}
    `, cajaTenant.params);

    // Unir ventas evitando duplicados (día ya está en mes)
    const ventasUnicas = [...ventasMes];
    const costMaps = await getCostMaps(ventasUnicas, scope);
    const porSucursal = await salesByBranch(req,
      `AND MONTH(COALESCE(v.fecha_venta, v.created_at)) = MONTH(CURDATE())
       AND YEAR(COALESCE(v.fecha_venta, v.created_at)) = YEAR(CURDATE())`);

    let ingresosDia = 0, costosDia = 0, cantProdDia = 0, cantRepDia = 0, descuentosDia = 0;
    for (const v of ventasDia) {
      ingresosDia += v.total || 0;
      descuentosDia += v.descuento || 0;
      const m = getCostoVenta(v, costMaps);
      costosDia += m.costo;
      cantProdDia += m.cantProd;
      cantRepDia += m.cantRep;
    }
    const gananciaDia = ingresosDia - costosDia;
    const perdidasDia = egresosDia[0].total || 0;

    let ingresosMes = 0, costosMes = 0;
    for (const v of ventasMes) {
      ingresosMes += v.total || 0;
      const m = getCostoVenta(v, costMaps);
      costosMes += m.costo;
    }
    const gananciaMes = ingresosMes - costosMes;
    const perdidasMes = egresosMes[0].total || 0;
    const ticketPromedio = ventasMes.length > 0 ? Math.round(ingresosMes / ventasMes.length) : 0;

    res.json({
      ventas_dia: ventasDia.length,
      ingresos_dia: ingresosDia / 100,
      ganancia_dia: gananciaDia / 100,
      perdidas_dia: perdidasDia / 100,
      ventas_mes: ventasMes.length,
      ingresos_mes: ingresosMes / 100,
      ganancia_mes: gananciaMes / 100,
      perdidas_mes: perdidasMes / 100,
      productos_vendidos: cantProdDia,
      repuestos_vendidos: cantRepDia,
      ticket_promedio: ticketPromedio / 100,
      ventas_anuladas: anuladas[0].total,
      monto_anulado: anuladas[0].monto / 100,
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null,
      ...(porSucursal ? { por_sucursal: porSucursal } : {})
    });
  } catch (error) {
    console.error('Error en getResumen:', error);
    sendSafeControllerError(res, error, 'Error al obtener resumen', { error: 'Error al obtener resumen' });
  }
};

// ===== DIARIO =====
/**
 * GET /api/reportes/diario?fecha=YYYY-MM-DD
 */
exports.getDiario = async (req, res) => {
  try {
    const { fecha } = req.query;
    const fechaFiltro = validateDate(fecha, 'fecha') || new Date().toISOString().split('T')[0];
    const scope = normalizeScope(req);
    const ventasTenant = reportScopeClause(req, 'v');
    const ventasNoAliasTenant = reportScopeClause(req);
    const cajaTenant = reportScopeClause(req);

    const [ventas] = await db.query(`
      SELECT v.*, u.name as vendedor_nombre
      FROM ventas v LEFT JOIN users u ON v.created_by = u.id
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) = ?
      AND v.estado != 'ANULADA'
      ${ventasTenant.sql}
    `, [fechaFiltro, ...ventasTenant.params]);

    const [anuladas] = await db.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as monto
      FROM ventas
      WHERE DATE(COALESCE(fecha_venta, created_at)) = ?
      AND estado = 'ANULADA'
      ${ventasNoAliasTenant.sql}
    `, [fechaFiltro, ...ventasNoAliasTenant.params]);

    const [egresos] = await db.query(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM caja_chica
      WHERE tipo_movimiento = 'EGRESO' AND estado = 'CONFIRMADO'
      AND DATE(fecha_movimiento) = ?
      ${cajaTenant.sql}
    `, [fechaFiltro, ...cajaTenant.params]);

    const costMaps = await getCostMaps(ventas, scope);
    const porSucursal = await salesByBranch(req,
      'AND DATE(COALESCE(v.fecha_venta, v.created_at)) = ?', [fechaFiltro]);

    const metodosPago = {};
    let totalIngresos = 0, costoTotal = 0, descuentosTotal = 0;

    for (const v of ventas) {
      totalIngresos += v.total || 0;
      descuentosTotal += v.descuento || 0;
      const metodo = v.metodo_pago || 'DESCONOCIDO';
      if (!metodosPago[metodo]) metodosPago[metodo] = { count: 0, monto: 0 };
      metodosPago[metodo].count += 1;
      metodosPago[metodo].monto += v.total || 0;
      const m = getCostoVenta(v, costMaps);
      costoTotal += m.costo;
    }

    // ventas.total ya incluye el descuento; se conserva como dato informativo.
    const { gananciaBruta, perdidasTotal, gananciaNeta } = calculateProfit({
      totalIngresos,
      costoTotal,
      egresosTotal: egresos[0].total || 0,
    });

    res.json({
      fecha: fechaFiltro,
      total_ventas: ventas.length,
      total_ingresos: totalIngresos / 100,
      costo_total: costoTotal / 100,
      descuentos: descuentosTotal / 100,
      ganancia_bruta: gananciaBruta / 100,
      perdidas: perdidasTotal / 100,
      ganancia_neta: gananciaNeta / 100,
      ventas_anuladas: anuladas[0].count,
      monto_anulado: anuladas[0].monto / 100,
      metodos_pago: Object.entries(metodosPago).map(([metodo, d]) => ({
        metodo, count: d.count, monto: d.monto / 100
      })),
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null,
      ...(porSucursal ? { por_sucursal: porSucursal } : {})
    });
  } catch (error) {
    console.error('Error en getDiario:', error);
    sendSafeControllerError(res, error, 'Error al obtener reporte diario', { error: 'Error al obtener reporte diario' });
  }
};

// ===== SEMANAL =====
/**
 * GET /api/reportes/semanal?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
 */
exports.getSemanal = async (req, res) => {
  try {
    let { fechaInicio, fechaFin } = req.query;
    const scope = normalizeScope(req);
    const ventasTenant = reportScopeClause(req, 'v');

    if (!fechaInicio || !fechaFin) {
      const today = new Date();
      const day = today.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(today);
      mon.setDate(today.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      fechaInicio = mon.toISOString().split('T')[0];
      fechaFin = sun.toISOString().split('T')[0];
    }
    ({ desde: fechaInicio, hasta: fechaFin } = validateRange(fechaInicio, fechaFin));

    const [ventas] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) BETWEEN ? AND ?
      AND v.estado != 'ANULADA'
      ${ventasTenant.sql}
    `, [fechaInicio, fechaFin, ...ventasTenant.params]);

    const prevInicio = new Date(fechaInicio);
    prevInicio.setDate(prevInicio.getDate() - 7);
    const prevFin = new Date(fechaFin);
    prevFin.setDate(prevFin.getDate() - 7);

    const [ventasPrev] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) BETWEEN ? AND ?
      AND v.estado != 'ANULADA'
      ${ventasTenant.sql}
    `, [prevInicio.toISOString().split('T')[0], prevFin.toISOString().split('T')[0], ...ventasTenant.params]);

    const allVentas = [...ventas, ...ventasPrev];
    const costMaps = await getCostMaps(allVentas, scope);
    const porSucursal = await salesByBranch(req,
      'AND DATE(COALESCE(v.fecha_venta, v.created_at)) BETWEEN ? AND ?', [fechaInicio, fechaFin]);

    // Ventas por día
    const porDia = {};
    for (const v of ventas) {
      const fecha = new Date(v.fecha_venta || v.created_at).toISOString().split('T')[0];
      if (!porDia[fecha]) porDia[fecha] = { ventas: 0, ingresos: 0, costo: 0 };
      porDia[fecha].ventas += 1;
      porDia[fecha].ingresos += v.total || 0;
      porDia[fecha].costo += getCostoVenta(v, costMaps).costo;
    }

    // Productos más vendidos de la semana
    const productosAgg = {};
    for (const v of ventas) {
      for (const item of parseItems(v.items)) {
        const id = item.refId || item.ref_id;
        if (!id) continue;
        const key = `${item.source}-${id}`;
        if (!productosAgg[key]) {
          const info = item.source === 'PRODUCTO' ? costMaps.productos[id] : costMaps.repuestos[id];
          productosAgg[key] = {
            id, source: item.source,
            nombre: item.nombre || info?.nombre || 'Desconocido',
            sku: info?.sku || '',
            categoria: info?.categoria || item.source,
            cantidad: 0, ingresos: 0, costo: 0,
            stock_actual: info?.stock || 0
          };
        }
        const qty = item.cantidad || 0;
        const precioCosto = (item.source === 'PRODUCTO' ? costMaps.productos[id]?.precio_costo : costMaps.repuestos[id]?.precio_costo) || 0;
        productosAgg[key].cantidad += qty;
        productosAgg[key].ingresos += item.subtotal || 0;
        productosAgg[key].costo += precioCosto * qty;
      }
    }

    const topProductos = Object.values(productosAgg)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)
      .map(p => ({
        ...p,
        ingresos: p.ingresos / 100,
        costo: p.costo / 100,
        ganancia: (p.ingresos - p.costo) / 100
      }));

    const totalActual = ventas.reduce((s, v) => s + (v.total || 0), 0);
    const totalPrev = ventasPrev.reduce((s, v) => s + (v.total || 0), 0);
    const costoActual = ventas.reduce((s, v) => s + getCostoVenta(v, costMaps).costo, 0);
    const costoPrev = ventasPrev.reduce((s, v) => s + getCostoVenta(v, costMaps).costo, 0);

    res.json({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      total_ventas: ventas.length,
      total_ingresos: totalActual / 100,
      ganancia: (totalActual - costoActual) / 100,
      comparacion_semana_anterior: {
        ventas: ventasPrev.length,
        ingresos: totalPrev / 100,
        ganancia: (totalPrev - costoPrev) / 100
      },
      por_dia: Object.entries(porDia)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, d]) => ({
          fecha,
          ventas: d.ventas,
          ingresos: d.ingresos / 100,
          ganancia: (d.ingresos - d.costo) / 100
        })),
      productos_mas_vendidos: topProductos,
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null,
      ...(porSucursal ? { por_sucursal: porSucursal } : {})
    });
  } catch (error) {
    console.error('Error en getSemanal:', error);
    sendSafeControllerError(res, error, 'Error al obtener reporte semanal', { error: 'Error al obtener reporte semanal' });
  }
};

// ===== PRODUCTOS MÁS VENDIDOS =====
/**
 * GET /api/reportes/productos-mas-vendidos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&limit=20
 */
exports.getProductosMasVendidos = async (req, res) => {
  try {
    const { desde, hasta, limit = 20 } = req.query;
    validateRange(desde, hasta);
    const scope = normalizeScope(req);
    const ventasTenant = reportScopeClause(req, 'v');

    let query = `SELECT v.* FROM ventas v WHERE v.estado != 'ANULADA'`;
    const params = [...ventasTenant.params];
    query += ventasTenant.sql;

    if (desde) { query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) >= ?'; params.push(desde); }
    if (hasta) { query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) <= ?'; params.push(hasta); }

    const [ventas] = await db.query(query, params);
    const costMaps = await getCostMaps(ventas, scope);
    const branchDateParts = [];
    const branchDateParams = [];
    if (desde) { branchDateParts.push('AND DATE(COALESCE(v.fecha_venta, v.created_at)) >= ?'); branchDateParams.push(desde); }
    if (hasta) { branchDateParts.push('AND DATE(COALESCE(v.fecha_venta, v.created_at)) <= ?'); branchDateParams.push(hasta); }
    const porSucursal = await salesByBranch(req, branchDateParts.join(' '), branchDateParams);

    const productosAgg = {};
    for (const v of ventas) {
      for (const item of parseItems(v.items)) {
        const id = item.refId || item.ref_id;
        if (!id) continue;
        const key = `${item.source}-${id}`;
        if (!productosAgg[key]) {
          const info = item.source === 'PRODUCTO' ? costMaps.productos[id] : costMaps.repuestos[id];
          productosAgg[key] = {
            id, tipo: item.source,
            nombre: item.nombre || info?.nombre || 'Desconocido',
            codigo: info?.sku || '',
            categoria: info?.categoria || item.source,
            cantidad_vendida: 0, ingresos: 0, costo_total: 0,
            stock_actual: info?.stock || 0
          };
        }
        const qty = item.cantidad || 0;
        const precioCosto = (item.source === 'PRODUCTO' ? costMaps.productos[id]?.precio_costo : costMaps.repuestos[id]?.precio_costo) || 0;
        productosAgg[key].cantidad_vendida += qty;
        productosAgg[key].ingresos += item.subtotal || 0;
        productosAgg[key].costo_total += precioCosto * qty;
      }
    }

    const resultado = Object.values(productosAgg)
      .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
      .slice(0, parseLimit(limit, { defaultLimit: 10, maxLimit: 100 }))
      .map(p => ({
        ...p,
        ingresos: p.ingresos / 100,
        costo_total: p.costo_total / 100,
        ganancia_estimada: (p.ingresos - p.costo_total) / 100
      }));

    res.json({
      data: resultado,
      total: resultado.length,
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null,
      ...(porSucursal ? { por_sucursal: porSucursal } : {})
    });
  } catch (error) {
    console.error('Error en getProductosMasVendidos:', error);
    sendSafeControllerError(res, error, 'Error al obtener productos más vendidos', { error: 'Error al obtener productos más vendidos' });
  }
};

// ===== HISTORIAL DE VENTAS =====
/**
 * GET /api/reportes/historial-ventas
 */
exports.getHistorialVentas = async (req, res) => {
  try {
    const { desde, hasta, estado, metodo_pago, vendedor, cliente, page = 1, limit = 100 } = req.query;
    validateRange(desde, hasta);
    const scope = normalizeScope(req);
    const ventasTenant = reportScopeClause(req, 'v');

    let query = `
      SELECT v.*, u.name as vendedor_nombre
      FROM ventas v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE 1=1
    `;
    const params = [...ventasTenant.params];
    query += ventasTenant.sql;

    if (desde) { query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) >= ?'; params.push(desde); }
    if (hasta) { query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) <= ?'; params.push(hasta); }
    if (estado) { query += ' AND v.estado = ?'; params.push(estado); }
    if (metodo_pago) { query += ' AND v.metodo_pago = ?'; params.push(metodo_pago); }
    if (cliente) { query += ' AND v.cliente_nombre LIKE ?'; params.push(`%${cliente}%`); }
    if (vendedor) { query += ' AND u.name LIKE ?'; params.push(`%${vendedor}%`); }

    const countQuery = query.replace(
      /SELECT v\.\*, u\.name as vendedor_nombre[\s\S]*?FROM ventas v/,
      'SELECT COUNT(*) AS total FROM ventas v'
    );
    const countParams = [...params];
    query += ' ORDER BY COALESCE(v.fecha_venta, v.created_at) DESC';

    const { page: pageNum, limit: limitNum, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    query += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [[countRow]] = await db.query(countQuery, countParams);
    const [ventas] = await db.query(query, params);
    const costMaps = await getCostMaps(ventas, scope);

    const resultado = ventas.map(v => {
      const { costo } = getCostoVenta(v, costMaps);
      return {
        id: v.id,
        sucursal_id: v.sucursal_id,
        codigo: v.numero_venta,
        fecha: v.fecha_venta || v.created_at,
        cliente: v.cliente_nombre,
        cliente_telefono: v.cliente_telefono,
        vendedor: v.vendedor_nombre || 'N/A',
        estado: v.estado,
        metodo_pago: v.metodo_pago,
        subtotal: (v.subtotal || 0) / 100,
        descuento: (v.descuento || 0) / 100,
        total: (v.total || 0) / 100,
        costo_total: costo / 100,
        ganancia_estimada: ((v.total || 0) - costo) / 100
      };
    });

    res.json({
      data: resultado,
      total: Number(countRow.total),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(Number(countRow.total) / limitNum),
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null
    });
  } catch (error) {
    console.error('Error en getHistorialVentas:', error);
    sendSafeControllerError(res, error, 'Error al obtener historial de ventas', { error: 'Error al obtener historial de ventas' });
  }
};

// ===== MÉTRICAS FINANCIERAS =====
/**
 * GET /api/reportes/metricas-financieras?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */
exports.getMetricasFinancieras = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const scope = normalizeScope(req);
    const ventasTenant = reportScopeClause(req, 'v');
    const ventasNoAliasTenant = reportScopeClause(req);
    const cajaTenant = reportScopeClause(req);
    const hoy = new Date();
    const desdeDefault = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    const hastaDefault = hoy.toISOString().split('T')[0];

    const desdeStr = desde || desdeDefault;
    const hastaStr = hasta || hastaDefault;
    validateRange(desdeStr, hastaStr);

    const [ventas] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) BETWEEN ? AND ?
      AND v.estado != 'ANULADA'
      ${ventasTenant.sql}
    `, [desdeStr, hastaStr, ...ventasTenant.params]);

    const [anuladas] = await db.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as monto
      FROM ventas
      WHERE DATE(COALESCE(fecha_venta, created_at)) BETWEEN ? AND ?
      AND estado = 'ANULADA'
      ${ventasNoAliasTenant.sql}
    `, [desdeStr, hastaStr, ...ventasNoAliasTenant.params]);

    const [egresos] = await db.query(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM caja_chica
      WHERE tipo_movimiento = 'EGRESO' AND estado = 'CONFIRMADO'
      AND DATE(fecha_movimiento) BETWEEN ? AND ?
      ${cajaTenant.sql}
    `, [desdeStr, hastaStr, ...cajaTenant.params]);

    const costMaps = await getCostMaps(ventas, scope);
    const gerencial = await managementMetrics(req, desdeStr, hastaStr);
    const porSucursalVentas = await salesByBranch(req,
      'AND DATE(COALESCE(v.fecha_venta, v.created_at)) BETWEEN ? AND ?', [desdeStr, hastaStr]);

    let totalIngresos = 0, costoTotal = 0, descuentosTotal = 0;
    const metodosPago = {};
    const porDia = {};

    for (const v of ventas) {
      totalIngresos += v.total || 0;
      descuentosTotal += v.descuento || 0;
      const m = getCostoVenta(v, costMaps);
      costoTotal += m.costo;

      const metodo = v.metodo_pago || 'DESCONOCIDO';
      if (!metodosPago[metodo]) metodosPago[metodo] = { count: 0, monto: 0 };
      metodosPago[metodo].count += 1;
      metodosPago[metodo].monto += v.total || 0;

      const fecha = new Date(v.fecha_venta || v.created_at).toISOString().split('T')[0];
      if (!porDia[fecha]) porDia[fecha] = { ventas: 0, ingresos: 0, costo: 0 };
      porDia[fecha].ventas += 1;
      porDia[fecha].ingresos += v.total || 0;
      porDia[fecha].costo += m.costo;
    }

    // Las anuladas no son ingreso ni una perdida adicional.
    const { gananciaBruta, perdidasTotal, gananciaNeta } = calculateProfit({
      totalIngresos,
      costoTotal,
      egresosTotal: egresos[0].total || 0,
    });
    const ticketPromedio = ventas.length > 0 ? totalIngresos / ventas.length : 0;
    const margenPromedio = totalIngresos > 0 ? (gananciaBruta / totalIngresos) * 100 : 0;

    res.json({
      desde: desdeStr,
      hasta: hastaStr,
      total_ventas: ventas.length,
      ingresos_totales: totalIngresos / 100,
      costos_totales: costoTotal / 100,
      descuentos: descuentosTotal / 100,
      ganancia_bruta: gananciaBruta / 100,
      perdidas: perdidasTotal / 100,
      ganancia_neta: gananciaNeta / 100,
      ticket_promedio: ticketPromedio / 100,
      margen_promedio: Math.round(margenPromedio * 100) / 100,
      ventas_anuladas: { count: anuladas[0].count, monto: anuladas[0].monto / 100 },
      egresos_caja: egresos[0].total / 100,
      metodos_pago: Object.entries(metodosPago).map(([metodo, d]) => ({
        metodo, count: d.count, monto: d.monto / 100
      })),
      por_dia: Object.entries(porDia)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, d]) => ({
          fecha,
          ventas: d.ventas,
          ingresos: d.ingresos / 100,
          ganancia: (d.ingresos - d.costo) / 100
        })),
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null,
      compras: gerencial.compras,
      caja_operativa: gerencial.caja_operativa,
      reparaciones: gerencial.reparaciones,
      inventario: gerencial.inventario,
      ...(gerencial.por_sucursal ? {
        por_sucursal: gerencial.por_sucursal.map(branch => ({
          ...branch,
          ...(porSucursalVentas || []).find(v => Number(v.sucursal_id) === Number(branch.sucursal_id)),
        }))
      } : {})
    });
  } catch (error) {
    console.error('Error en getMetricasFinancieras:', error);
    sendSafeControllerError(res, error, 'Error al obtener métricas financieras', { error: 'Error al obtener métricas financieras' });
  }
};
