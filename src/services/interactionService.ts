import axios, { InternalAxiosRequestConfig } from 'axios';
import API_URL from './config';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para agregar el token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

export interface InteractionData {
  cliente_id: number;
  tipo: 'cotizacion' | 'venta' | 'reparacion' | 'visita';
  referencia_id?: number;
  monto?: number;
  notas?: string;
}

export interface CustomerSummary {
  cliente_id: number;
  nombre: string;
  apellido: string;
  total_interacciones: number;
  total_cotizaciones: number;
  total_ventas: number;
  total_reparaciones: number;
  total_visitas: number;
  total_gastado: number;
  ultima_interaccion: string;
}

// Crear nueva interacción
export const createInteraction = async (data: InteractionData) => {
  const response = await api.post('/interactions', data);
  return response.data;
};

// Obtener interacciones de un cliente
export const getCustomerInteractions = async (clienteId: string, tipo?: string) => {
  const params = tipo ? { tipo } : {};
  const response = await api.get(`/interactions/cliente/${clienteId}`, { params });
  return response.data;
};

// Obtener resumen de un cliente
export const getCustomerSummary = async (clienteId: string) => {
  const response = await api.get(`/interactions/cliente/${clienteId}/resumen`);
  return response.data;
};

// Obtener estadísticas de interacciones
export const getInteractionStats = async (desde?: string, hasta?: string) => {
  const params: any = {};
  if (desde) params.desde = desde;
  if (hasta) params.hasta = hasta;
  const response = await api.get('/interactions/stats', { params });
  return response.data;
};
