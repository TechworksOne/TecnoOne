const db = require('../config/database');

// ===== HELPERS =====

function parseItems(itemsField) {
  if (!itemsField) return [];
  try {
    const arr = typeof itemsField === 'string' ? JSON.parse(itemsField) : itemsField;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function getCostMaps(ventas) {
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
    const [rows] = await db.query(
      'SELECT id, sku, nombre, categoria, precio_costo, precio_venta, stock FROM productos WHERE id IN (?)',
      [[...prodIds]]
    );
    rows.forEach(r => {
      productos[r.id] = r;
      if (!r.precio_costo || r.precio_costo === 0) missingCosts = true;
    });
  }

  if (repIds.size > 0) {
    const [rows] = await db.query(
      'SELECT id, sku, nombre, precio_costo, stock FROM repuestos WHERE id IN (?)',
      [[...repIds]]
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
    const [ventasDia] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) = CURDATE()
      AND v.estado != 'ANULADA'
    `);

    const [ventasMes] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE MONTH(COALESCE(v.fecha_venta, v.created_at)) = MONTH(CURDATE())
      AND YEAR(COALESCE(v.fecha_venta, v.created_at)) = YEAR(CURDATE())
      AND v.estado != 'ANULADA'
    `);

    const [anuladas] = await db.query(`
      SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as monto
      FROM ventas
      WHERE MONTH(COALESCE(fecha_venta, created_at)) = MONTH(CURDATE())
      AND YEAR(COALESCE(fecha_venta, created_at)) = YEAR(CURDATE())
      AND estado = 'ANULADA'
    `);

    const [egresosDia] = await db.query(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM caja_chica
      WHERE tipo_movimiento = 'EGRESO' AND estado = 'CONFIRMADO'
      AND DATE(fecha_movimiento) = CURDATE()
    `);

    const [egresosMes] = await db.query(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM caja_chica
      WHERE tipo_movimiento = 'EGRESO' AND estado = 'CONFIRMADO'
      AND MONTH(fecha_movimiento) = MONTH(CURDATE())
      AND YEAR(fecha_movimiento) = YEAR(CURDATE())
    `);

    // Unir ventas evitando duplicados (día ya está en mes)
    const ventasUnicas = [...ventasMes];
    const costMaps = await getCostMaps(ventasUnicas);

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
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null
    });
  } catch (error) {
    console.error('Error en getResumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen', details: error.message });
  }
};

// ===== DIARIO =====
/**
 * GET /api/reportes/diario?fecha=YYYY-MM-DD
 */
exports.getDiario = async (req, res) => {
  try {
    const { fecha } = req.query;
    const fechaFiltro = fecha || new Date().toISOString().split('T')[0];

    const [ventas] = await db.query(`
      SELECT v.*, u.name as vendedor_nombre
      FROM ventas v LEFT JOIN users u ON v.created_by = u.id
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) = ?
      AND v.estado != 'ANULADA'
    `, [fechaFiltro]);

    const [anuladas] = await db.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as monto
      FROM ventas
      WHERE DATE(COALESCE(fecha_venta, created_at)) = ?
      AND estado = 'ANULADA'
    `, [fechaFiltro]);

    const [egresos] = await db.query(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM caja_chica
      WHERE tipo_movimiento = 'EGRESO' AND estado = 'CONFIRMADO'
      AND DATE(fecha_movimiento) = ?
    `, [fechaFiltro]);

    const costMaps = await getCostMaps(ventas);

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

    const gananciaBruta = totalIngresos - costoTotal;
    const perdidasTotal = egresos[0].total || 0;
    const gananciaNeta = gananciaBruta - perdidasTotal - descuentosTotal;

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
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null
    });
  } catch (error) {
    console.error('Error en getDiario:', error);
    res.status(500).json({ error: 'Error al obtener reporte diario', details: error.message });
  }
};

// ===== SEMANAL =====
/**
 * GET /api/reportes/semanal?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
 */
exports.getSemanal = async (req, res) => {
  try {
    let { fechaInicio, fechaFin } = req.query;

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

    const [ventas] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) BETWEEN ? AND ?
      AND v.estado != 'ANULADA'
    `, [fechaInicio, fechaFin]);

    const prevInicio = new Date(fechaInicio);
    prevInicio.setDate(prevInicio.getDate() - 7);
    const prevFin = new Date(fechaFin);
    prevFin.setDate(prevFin.getDate() - 7);

    const [ventasPrev] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) BETWEEN ? AND ?
      AND v.estado != 'ANULADA'
    `, [prevInicio.toISOString().split('T')[0], prevFin.toISOString().split('T')[0]]);

    const allVentas = [...ventas, ...ventasPrev];
    const costMaps = await getCostMaps(allVentas);

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
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null
    });
  } catch (error) {
    console.error('Error en getSemanal:', error);
    res.status(500).json({ error: 'Error al obtener reporte semanal', details: error.message });
  }
};

// ===== PRODUCTOS MÁS VENDIDOS =====
/**
 * GET /api/reportes/productos-mas-vendidos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&limit=20
 */
exports.getProductosMasVendidos = async (req, res) => {
  try {
    const { desde, hasta, limit = 20 } = req.query;

    let query = `SELECT v.* FROM ventas v WHERE v.estado != 'ANULADA'`;
    const params = [];

    if (desde) { query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) >= ?'; params.push(desde); }
    if (hasta) { query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) <= ?'; params.push(hasta); }

    const [ventas] = await db.query(query, params);
    const costMaps = await getCostMaps(ventas);

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
      .slice(0, parseInt(limit))
      .map(p => ({
        ...p,
        ingresos: p.ingresos / 100,
        costo_total: p.costo_total / 100,
        ganancia_estimada: (p.ingresos - p.costo_total) / 100
      }));

    res.json({
      data: resultado,
      total: resultado.length,
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null
    });
  } catch (error) {
    console.error('Error en getProductosMasVendidos:', error);
    res.status(500).json({ error: 'Error al obtener productos más vendidos', details: error.message });
  }
};

// ===== HISTORIAL DE VENTAS =====
/**
 * GET /api/reportes/historial-ventas
 */
exports.getHistorialVentas = async (req, res) => {
  try {
    const { desde, hasta, estado, metodo_pago, vendedor, cliente, page = 1, limit = 100 } = req.query;

    let query = `
      SELECT v.*, u.name as vendedor_nombre
      FROM ventas v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (desde) { query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) >= ?'; params.push(desde); }
    if (hasta) { query += ' AND DATE(COALESCE(v.fecha_venta, v.created_at)) <= ?'; params.push(hasta); }
    if (estado) { query += ' AND v.estado = ?'; params.push(estado); }
    if (metodo_pago) { query += ' AND v.metodo_pago = ?'; params.push(metodo_pago); }
    if (cliente) { query += ' AND v.cliente_nombre LIKE ?'; params.push(`%${cliente}%`); }
    if (vendedor) { query += ' AND u.name LIKE ?'; params.push(`%${vendedor}%`); }

    query += ' ORDER BY COALESCE(v.fecha_venta, v.created_at) DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [ventas] = await db.query(query, params);
    const costMaps = await getCostMaps(ventas);

    const resultado = ventas.map(v => {
      const { costo } = getCostoVenta(v, costMaps);
      return {
        id: v.id,
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
      total: resultado.length,
      page: parseInt(page),
      limit: parseInt(limit),
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null
    });
  } catch (error) {
    console.error('Error en getHistorialVentas:', error);
    res.status(500).json({ error: 'Error al obtener historial de ventas', details: error.message });
  }
};

// ===== MÉTRICAS FINANCIERAS =====
/**
 * GET /api/reportes/metricas-financieras?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */
exports.getMetricasFinancieras = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const hoy = new Date();
    const desdeDefault = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    const hastaDefault = hoy.toISOString().split('T')[0];

    const desdeStr = desde || desdeDefault;
    const hastaStr = hasta || hastaDefault;

    const [ventas] = await db.query(`
      SELECT v.* FROM ventas v
      WHERE DATE(COALESCE(v.fecha_venta, v.created_at)) BETWEEN ? AND ?
      AND v.estado != 'ANULADA'
    `, [desdeStr, hastaStr]);

    const [anuladas] = await db.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as monto
      FROM ventas
      WHERE DATE(COALESCE(fecha_venta, created_at)) BETWEEN ? AND ?
      AND estado = 'ANULADA'
    `, [desdeStr, hastaStr]);

    const [egresos] = await db.query(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM caja_chica
      WHERE tipo_movimiento = 'EGRESO' AND estado = 'CONFIRMADO'
      AND DATE(fecha_movimiento) BETWEEN ? AND ?
    `, [desdeStr, hastaStr]);

    const costMaps = await getCostMaps(ventas);

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

    const gananciaBruta = totalIngresos - costoTotal;
    const perdidasTotal = (egresos[0].total || 0) + (anuladas[0].monto || 0);
    const gananciaNeta = gananciaBruta - perdidasTotal - descuentosTotal;
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
      advertencia_costos: costMaps.missingCosts ? 'Algunos productos no tienen costo registrado.' : null
    });
  } catch (error) {
    console.error('Error en getMetricasFinancieras:', error);
    res.status(500).json({ error: 'Error al obtener métricas financieras', details: error.message });
  }
};
