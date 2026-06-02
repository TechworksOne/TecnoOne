import axios from 'axios';
import API_URL from './config';

// Configurar axios con token
const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================
// TIPOS
// ============================================

export interface VentaItem {
  id?: string;
  source: 'PRODUCTO' | 'REPUESTO';
  refId: string;
  nombre: string;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
  notas?: string;
}

export interface VentaPago {
  metodo: 'EFECTIVO' | 'TARJETA' | 'TARJETA_BAC' | 'TARJETA_NEONET' | 'TARJETA_OTRA' | 'TRANSFERENCIA';
  monto: number;
  referencia?: string;
  comprobanteUrl?: string;
  fecha?: string;
  usuario_id?: number;
}

export interface VentaData {
  id?: number;
  numero_venta?: string;
  cliente_id: number;
  cliente_nombre: string;
  cliente_telefono?: string;
  cliente_email?: string;
  cliente_nit?: string;
  cliente_direccion?: string;
  cotizacion_id?: number;
  numero_cotizacion?: string;
  tipo_venta?: 'PRODUCTOS' | 'REPUESTOS' | 'MIXTA';
  items: VentaItem[];
  subtotal: number; // en centavos
  impuestos?: number; // en centavos
  descuento?: number; // en centavos
  total: number; // en centavos
  estado?: 'PENDIENTE' | 'PAGADA' | 'PARCIAL' | 'ANULADA';
  metodo_pago?: 'EFECTIVO' | 'TARJETA' | 'TARJETA_BAC' | 'TARJETA_NEONET' | 'TARJETA_OTRA' | 'TRANSFERENCIA' | 'MIXTO';
  pagos?: VentaPago[];
  monto_pagado?: number; // en centavos
  saldo_pendiente?: number; // en centavos
  observaciones?: string;
  notas_internas?: string;
  factura_numero?: string;
  factura_uuid?: string;
  fecha_venta?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  vendedor_nombre?: string;
}

export interface VentaFilters {
  estado?: string;
  tipo_venta?: string;
  cliente_id?: number;
  metodo_pago?: string;
  search?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  page?: number;
  limit?: number;
}

export interface VentaEstadisticas {
  total_ventas: number;
  ventas_pagadas: number;
  ventas_pendientes: number;
  ventas_parciales: number;
  total_vendido_quetzales: number;
  total_cobrado_quetzales: number;
  total_pendiente_quetzales: number;
  promedio_venta_quetzales: number;
  ventas_hoy: number;
  total_hoy_quetzales: number;
  ventas_mes_actual: number;
  total_mes_actual_quetzales: number;
}

// ============================================
// HELPERS DE CONVERSIÓN
// ============================================

/**
 * Convertir quetzales a centavos
 */
export const quetzalesACentavos = (quetzales: number): number => {
  return Math.round(quetzales * 100);
};

/**
 * Convertir centavos a quetzales
 */
export const centavosAQuetzales = (centavos: number): number => {
  return centavos / 100;
};

/**
 * Formatear precio en centavos a string con formato Q
 */
export const formatearPrecio = (centavos: number): string => {
  const quetzales = centavosAQuetzales(centavos);
  return `Q${quetzales.toFixed(2)}`;
};

// ============================================
// FUNCIONES DEL SERVICIO
// ============================================

/**
 * Crear una nueva venta
 */
export const createVenta = async (data: Omit<VentaData, 'id'>): Promise<VentaData> => {
  const response = await api.post('/ventas', data);
  return response.data;
};

/**
 * Convertir cotización a venta
 */
export const createVentaFromQuote = async (
  cotizacionId: number,
  data: {
    pagos?: VentaPago[];
    metodo_pago?: string;
    monto_pagado?: number;
    observaciones?: string;
    created_by?: number;
  }
): Promise<VentaData> => {
  const response = await api.post(`/ventas/from-quote/${cotizacionId}`, data);
  return response.data;
};

/**
 * Obtener todas las ventas con filtros
 */
export const getAllVentas = async (filters?: VentaFilters): Promise<VentaData[]> => {
  const response = await api.get('/ventas', { params: filters });
  return response.data;
};

/**
 * Obtener una venta por ID
 */
export const getVentaById = async (id: number): Promise<VentaData> => {
  const response = await api.get(`/ventas/${id}`);
  return response.data;
};

/**
 * Registrar pago en una venta
 */
export const registrarPago = async (
  ventaId: number,
  pago: {
    monto: number;
    metodo: string;
    referencia?: string;
    comprobanteUrl?: string;
    usuario_id?: number;
  }
): Promise<VentaData> => {
  const response = await api.post(`/ventas/${ventaId}/pagos`, pago);
  return response.data;
};

/**
 * Anular una venta
 */
export const anularVenta = async (
  ventaId: number,
  data: {
    motivo: string;
    usuario_id?: number;
  }
): Promise<VentaData> => {
  const response = await api.post(`/ventas/${ventaId}/anular`, data);
  return response.data;
};

/**
 * Obtener estadísticas de ventas
 */
export const getEstadisticas = async (): Promise<VentaEstadisticas> => {
  const response = await api.get('/ventas/estadisticas');
  return response.data;
};

export default {
  createVenta,
  createVentaFromQuote,
  getAllVentas,
  getVentaById,
  registrarPago,
  anularVenta,
  getEstadisticas,
  quetzalesACentavos,
  centavosAQuetzales,
  formatearPrecio,
};
