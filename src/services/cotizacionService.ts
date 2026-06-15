import axios, { InternalAxiosRequestConfig } from 'axios';
import API_URL from './config';

/**
 * SERVICIO DE COTIZACIONES
 * Maneja todas las llamadas a la API de cotizaciones
 */

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para agregar el token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('token');
    console.log('🔑 Token encontrado:', token ? 'SÍ' : 'NO');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Token agregado al header');
    } else {
      console.log('❌ No se agregó token - Usuario no autenticado');
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// Interfaces TypeScript
export interface CotizacionItem {
  id: string;
  source: 'PRODUCTO' | 'REPUESTO';
  refId: string;
  nombre: string;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
  aplicarImpuestos?: boolean;
  notas?: string;
}

export interface CotizacionData {
  id?: number;
  numero_cotizacion?: string;
  cliente_id: number;
  cliente_nombre: string;
  cliente_telefono?: string;
  cliente_email?: string;
  cliente_nit?: string;
  cliente_direccion?: string;
  tipo: 'VENTA' | 'REPARACION';
  fecha_emision?: string;
  vigencia_dias?: number;
  fecha_vencimiento?: string;
  items: CotizacionItem[];
  subtotal: number;
  impuestos: number;
  mano_de_obra?: number;
  total: number;
  aplicar_impuestos?: boolean;
  estado?: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'VENCIDA' | 'CONVERTIDA';
  observaciones?: string;
  notas_internas?: string;
  convertida_a?: 'VENTA' | 'REPARACION';
  referencia_venta_id?: number;
  referencia_reparacion_id?: number;
  fecha_conversion?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
}

export interface CotizacionFilters {
  tipo?: 'VENTA' | 'REPARACION';
  estado?: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'VENCIDA' | 'CONVERTIDA';
  cliente_id?: number;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
}

export interface CotizacionEstadisticas {
  total: number;
  borradores: number;
  enviadas: number;
  aprobadas: number;
  rechazadas: number;
  vencidas: number;
  convertidas: number;
  monto_total: number;
  monto_convertido: number;
  tasa_conversion: number;
}

export interface ConvertirVentaResponse {
  id?: number;
  venta_id?: number;
  cotizacion_id?: number;
  numero_venta?: string;
  [key: string]: any;
}

// ============================================
// CREAR COTIZACIÓN
// ============================================
export const createCotizacion = async (data: CotizacionData): Promise<CotizacionData> => {
  try {
    console.log('📤 Creando cotización:', data);
    const response = await api.post('/cotizaciones', data);
    console.log('✅ Cotización creada:', response.data);
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Error al crear cotización:', error.response?.data || error);
    throw error;
  }
};

// ============================================
// OBTENER TODAS LAS COTIZACIONES
// ============================================
export const getAllCotizaciones = async (filters?: CotizacionFilters) => {
  try {
    const response = await api.get('/cotizaciones', {
      params: filters
    });
    return response.data;
  } catch (error: any) {
    console.error('❌ Error al obtener cotizaciones:', error);
    throw error;
  }
};

// ============================================
// OBTENER COTIZACIÓN POR ID
// ============================================
export const getCotizacionById = async (id: number): Promise<CotizacionData> => {
  try {
    const response = await api.get(`/cotizaciones/${id}`);
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Error al obtener cotización:', error);
    throw error;
  }
};

// ============================================
// ACTUALIZAR COTIZACIÓN
// ============================================
export const updateCotizacion = async (id: number, data: Partial<CotizacionData>): Promise<CotizacionData> => {
  try {
    console.log('📝 Actualizando cotización:', id, data);
    const response = await api.put(`/cotizaciones/${id}`, data);
    console.log('✅ Cotización actualizada:', response.data);
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Error al actualizar cotización:', error);
    throw error;
  }
};

// ============================================
// ELIMINAR COTIZACIÓN
// ============================================
export const deleteCotizacion = async (id: number): Promise<void> => {
  try {
    await api.delete(`/cotizaciones/${id}`);
    console.log('🗑️ Cotización eliminada:', id);
  } catch (error: any) {
    console.error('❌ Error al eliminar cotización:', error);
    throw error;
  }
};

// ============================================
// CAMBIAR ESTADO DE COTIZACIÓN
// ============================================
export const cambiarEstadoCotizacion = async (
  id: number, 
  estado: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'VENCIDA' | 'CONVERTIDA'
): Promise<void> => {
  try {
    await api.patch(`/cotizaciones/${id}/estado`, { estado });
    console.log(`🔄 Estado de cotización ${id} cambiado a: ${estado}`);
  } catch (error: any) {
    console.error('❌ Error al cambiar estado:', error);
    throw error;
  }
};

// ============================================
// CONVERTIR COTIZACIÓN A VENTA
// ============================================
export const convertirAVenta = async (id: number | string): Promise<ConvertirVentaResponse> => {
  try {
    const response = await api.post(`/cotizaciones/${id}/convertir-venta`);
    return response.data;
  } catch (error: any) {
    console.error('❌ Error al convertir cotización a venta:', error.response?.data || error);
    throw error;
  }
};

// ============================================
// OBTENER COTIZACIONES PRÓXIMAS A VENCER
// ============================================
export const getCotizacionesProximasVencer = async (dias: number = 7) => {
  try {
    const response = await api.get('/cotizaciones/proximas-vencer', {
      params: { dias }
    });
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Error al obtener cotizaciones próximas a vencer:', error);
    throw error;
  }
};

// ============================================
// OBTENER ESTADÍSTICAS DE COTIZACIONES
// ============================================
export const getEstadisticasCotizaciones = async (desde?: string, hasta?: string): Promise<CotizacionEstadisticas> => {
  try {
    const response = await api.get('/cotizaciones/estadisticas', {
      params: { desde, hasta }
    });
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Error al obtener estadísticas:', error);
    throw error;
  }
};
