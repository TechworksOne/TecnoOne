import axios from 'axios';
import API_URL from './config';
import { ACTIVE_BRANCH_STORAGE_KEY } from '../lib/branchContext';

const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const sucursalId = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
  if (sucursalId) config.headers['X-Sucursal-Id'] = sucursalId;
  return config;
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
  por_sucursal?: PorSucursal[];
}

export interface PorSucursal {
  sucursal_id: number;
  sucursal_nombre: string;
  ventas?: number;
  ingresos?: number;
  compras_cantidad?: number;
  compras_total?: number;
  reparaciones_creadas?: number;
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
  por_sucursal?: PorSucursal[];
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
  por_sucursal?: PorSucursal[];
}

export interface ProductosMasVendidosData {
  data: ProductoVendido[];
  total: number;
  advertencia_costos: string | null;
  por_sucursal?: PorSucursal[];
}

export interface HistorialVenta {
  id: number;
  sucursal_id?: number;
  sucursal_nombre?: string;
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
  totalPages: number;
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
  compras?: { cantidad: number; total: number };
  caja_operativa?: {
    sesiones_abiertas: number; sesiones_cerradas: number;
    monto_apertura: number; monto_cierre: number; diferencia: number;
    sobrantes: number; faltantes: number;
  };
  reparaciones?: { creadas: number; finalizadas: number; canceladas: number; pendientes: number };
  inventario?: { entradas: number; salidas: number; ajustes: number; stock_productos: number; stock_repuestos: number; stock_consolidado: number };
  por_sucursal?: PorSucursal[];
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
  const { data } = await api.get('/reportes/resumen');
  return data;
}

export async function getDiario(fecha?: string): Promise<DiarioData> {
  const params = fecha ? { fecha } : {};
  const { data } = await api.get('/reportes/diario', { params });
  return data;
}

export async function getSemanal(fechaInicio?: string, fechaFin?: string): Promise<SemanalData> {
  const params: Record<string, string> = {};
  if (fechaInicio) params.fechaInicio = fechaInicio;
  if (fechaFin) params.fechaFin = fechaFin;
  const { data } = await api.get('/reportes/semanal', { params });
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
  const { data } = await api.get('/reportes/productos-mas-vendidos', { params });
  return data;
}

export async function getHistorialVentas(
  filtros: HistorialFiltros = {}
): Promise<HistorialVentasData> {
  const { data } = await api.get('/reportes/historial-ventas', { params: filtros });
  return data;
}

export async function getMetricasFinancieras(
  desde?: string,
  hasta?: string
): Promise<MetricasFinancieras> {
  const params: Record<string, string> = {};
  if (desde) params.desde = desde;
  if (hasta) params.hasta = hasta;
  const { data } = await api.get('/reportes/metricas-financieras', { params });
  return data;
}
