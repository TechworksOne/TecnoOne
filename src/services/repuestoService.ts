import axios from 'axios';
import API_URL from './config';

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_URL
});

// Interceptor para agregar el token JWT
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface RepuestoData {
  id?: number;
  sku?: string;
  codigo?: string;
  nombre: string;
  tipo: string;
  marca: string;
  linea?: string;
  modelo?: string;
  compatibilidad?: string[];
  condicion: 'Original' | 'OEM' | 'Genérico' | 'Usado';
  color?: string;
  notas?: string;
  precio_publico: number; // En centavos
  precio_costo: number;   // En centavos
  proveedor?: string;
  stock: number;
  stock_minimo?: number;
  imagenes?: string[];
  imagenesFiles?: File[]; // Archivos nuevos a subir
  tags?: string[];
  activo?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RepuestoFilters {
  tipo?: string;
  marca?: string;
  linea?: string;
  activo?: boolean;
  soloConStock?: boolean;
  precioMin?: number;
  precioMax?: number;
  searchTerm?: string;
  page?: number;
  limit?: number;
}

export interface MovimientoStock {
  tipo_movimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'VENTA' | 'REPARACION' | 'DEVOLUCION';
  cantidad: number;
  precio_unitario?: number;
  referencia_tipo?: 'COMPRA' | 'VENTA' | 'REPARACION' | 'AJUSTE_MANUAL';
  referencia_id?: number;
  usuario_id?: number;
  notas?: string;
}

// ============================================
// HELPER FORMDATA
// ============================================

function buildRepuestoFormData(data: Record<string, unknown>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (key === 'imagenesFiles') {
      for (const file of value as File[]) {
        formData.append('imagenes', file);
      }
    } else if (key === 'imagenes') {
      formData.append('imagenes', JSON.stringify(value));
    } else if (key === 'compatibilidad' || key === 'tags') {
      formData.append(key, JSON.stringify(value));
    } else if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof File))) {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  }
  return formData;
}

// ============================================
// FUNCIONES DEL SERVICIO
// ============================================

/**
 * Crear un nuevo repuesto
 */
export const createRepuesto = async (data: Omit<RepuestoData, 'id'>): Promise<RepuestoData> => {
  const token = sessionStorage.getItem('token');
  const formData = buildRepuestoFormData(data as Record<string, unknown>);
  const response = await fetch(`${API_URL}/repuestos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? ''}` },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Error al crear repuesto' }));
    throw { response: { data: err } };
  }
  return response.json();
};

/**
 * Obtener todos los repuestos con filtros
 */
export const getAllRepuestos = async (filters?: RepuestoFilters): Promise<RepuestoData[]> => {
  const response = await api.get('/repuestos', { params: filters });
  return response.data;
};

/**
 * Obtener un repuesto por ID
 */
export const getRepuestoById = async (id: number): Promise<RepuestoData> => {
  const response = await api.get(`/repuestos/${id}`);
  return response.data;
};

/**
 * Actualizar un repuesto
 */
export const updateRepuesto = async (id: number, data: Partial<RepuestoData>): Promise<RepuestoData> => {
  const token = sessionStorage.getItem('token');
  const formData = buildRepuestoFormData(data as Record<string, unknown>);
  const response = await fetch(`${API_URL}/repuestos/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token ?? ''}` },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Error al actualizar repuesto' }));
    throw { response: { data: err } };
  }
  return response.json();
};

/**
 * Eliminar un repuesto
 */
export const deleteRepuesto = async (id: number): Promise<{ message: string }> => {
  const response = await api.delete(`/repuestos/${id}`);
  return response.data;
};

/**
 * Obtener repuestos con stock bajo
 */
export const getRepuestosStockBajo = async (): Promise<any[]> => {
  const response = await api.get('/repuestos/stock-bajo');
  return response.data;
};

/**
 * Obtener estadísticas de repuestos
 */
export const getEstadisticasRepuestos = async (): Promise<any> => {
  const response = await api.get('/repuestos/estadisticas');
  return response.data;
};

/**
 * Registrar movimiento de stock
 */
export const registrarMovimientoStock = async (
  repuestoId: number, 
  movimiento: MovimientoStock
): Promise<any> => {
  const response = await api.post(`/repuestos/${repuestoId}/movimiento`, movimiento);
  return response.data;
};

/**
 * Obtener historial de movimientos de un repuesto
 */
export const getMovimientosRepuesto = async (repuestoId: number): Promise<any[]> => {
  const response = await api.get(`/repuestos/${repuestoId}/movimientos`);
  return response.data;
};

// ============================================
// FUNCIONES HELPER
// ============================================

/**
 * Convertir precio de centavos a quetzales
 */
export const centavosAQuetzales = (centavos: number): number => {
  return centavos / 100;
};

/**
 * Convertir precio de quetzales a centavos
 */
export const quetzalesACentavos = (quetzales: number): number => {
  return Math.round(quetzales * 100);
};

/**
 * Formatear precio en centavos como string de quetzales
 */
export const formatearPrecio = (centavos: number): string => {
  const quetzales = centavosAQuetzales(centavos);
  return `Q${quetzales.toFixed(2)}`;
};
