import axios from 'axios';
import API_URL from './config';

const headers = () => ({
  Authorization: `Bearer ${sessionStorage.getItem('token')}`,
});

// ===== TYPES =====

export interface ResumenData {
  ventas_dia: number;
  ingresos_dia: number;
  ganancia_dia: number;
  perdidas_dia: number;
  ventas_mes: number;
  ingresos_mes: number;
  ganancia_mes: number;
  perdidas_mes: number;
  productos_vendidos: number;
  repuestos_vendidos: number;
  ticket_promedio: number;
  ventas_anuladas: number;
  monto_anulado: number;
  advertencia_costos: string | null;
}

export interface MetodoPago {
  metodo: string;
  count: number;
  monto: number;
}

export interface DiarioData {
  fecha: string;
  total_ventas: number;
  total_ingresos: number;
  costo_total: number;
  descuentos: number;
  ganancia_bruta: number;
  perdidas: number;
  ganancia_neta: number;
  ventas_anuladas: number;
  monto_anulado: number;
  metodos_pago: MetodoPago[];
  advertencia_costos: string | null;
}

export interface PorDia {
  fecha: string;
  ventas: number;
  ingresos: number;
  ganancia: number;
}

export interface ProductoVendido {
  id: number;
  source?: string;
  tipo?: string;
  nombre: string;
  sku?: string;
  codigo?: string;
  categoria: string;
  cantidad?: number;
  cantidad_vendida?: number;
  ingresos: number;
  costo?: number;
  costo_total?: number;
  ganancia?: number;
  ganancia_estimada?: number;
  stock_actual: number;
}

export interface SemanalData {
  fecha_inicio: string;
  fecha_fin: string;
  total_ventas: number;
  total_ingresos: number;
  ganancia: number;
  comparacion_semana_anterior: {
    ventas: number;
    ingresos: number;
    ganancia: number;
  };
  por_dia: PorDia[];
  productos_mas_vendidos: ProductoVendido[];
  advertencia_costos: string | null;
}

export interface ProductosMasVendidosData {
  data: ProductoVendido[];
  total: number;
  advertencia_costos: string | null;
}

export interface HistorialVenta {
  id: number;
  codigo: string;
  fecha: string;
  cliente: string;
  cliente_telefono: string;
  vendedor: string;
  estado: string;
  metodo_pago: string;
  subtotal: number;
  descuento: number;
  total: number;
  costo_total: number;
  ganancia_estimada: number;
}

export interface HistorialVentasData {
  data: HistorialVenta[];
  total: number;
  page: number;
  limit: number;
  advertencia_costos: string | null;
}

export interface MetricasFinancieras {
  desde: string;
  hasta: string;
  total_ventas: number;
  ingresos_totales: number;
  costos_totales: number;
  descuentos: number;
  ganancia_bruta: number;
  perdidas: number;
  ganancia_neta: number;
  ticket_promedio: number;
  margen_promedio: number;
  ventas_anuladas: { count: number; monto: number };
  egresos_caja: number;
  metodos_pago: MetodoPago[];
  por_dia: PorDia[];
  advertencia_costos: string | null;
}

export interface HistorialFiltros {
  desde?: string;
  hasta?: string;
  estado?: string;
  metodo_pago?: string;
  vendedor?: string;
  cliente?: string;
  page?: number;
  limit?: number;
}

// ===== API CALLS =====

export async function getResumen(): Promise<ResumenData> {
  const { data } = await axios.get(`${API_URL}/reportes/resumen`, { headers: headers() });
  return data;
}

export async function getDiario(fecha?: string): Promise<DiarioData> {
  const params = fecha ? { fecha } : {};
  const { data } = await axios.get(`${API_URL}/reportes/diario`, { headers: headers(), params });
  return data;
}

export async function getSemanal(fechaInicio?: string, fechaFin?: string): Promise<SemanalData> {
  const params: Record<string, string> = {};
  if (fechaInicio) params.fechaInicio = fechaInicio;
  if (fechaFin) params.fechaFin = fechaFin;
  const { data } = await axios.get(`${API_URL}/reportes/semanal`, { headers: headers(), params });
  return data;
}

export async function getProductosMasVendidos(
  desde?: string,
  hasta?: string,
  limit = 20
): Promise<ProductosMasVendidosData> {
  const params: Record<string, string | number> = { limit };
  if (desde) params.desde = desde;
  if (hasta) params.hasta = hasta;
  const { data } = await axios.get(`${API_URL}/reportes/productos-mas-vendidos`, {
    headers: headers(),
    params,
  });
  return data;
}

export async function getHistorialVentas(
  filtros: HistorialFiltros = {}
): Promise<HistorialVentasData> {
  const { data } = await axios.get(`${API_URL}/reportes/historial-ventas`, {
    headers: headers(),
    params: filtros,
  });
  return data;
}

export async function getMetricasFinancieras(
  desde?: string,
  hasta?: string
): Promise<MetricasFinancieras> {
  const params: Record<string, string> = {};
  if (desde) params.desde = desde;
  if (hasta) params.hasta = hasta;
  const { data } = await axios.get(`${API_URL}/reportes/metricas-financieras`, {
    headers: headers(),
    params,
  });
  return data;
}
