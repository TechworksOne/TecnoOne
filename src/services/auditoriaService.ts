import axios from 'axios';
import API_URL from './config';

const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface AuditoriaLog {
  id: number;
  empresa_id: number;
  usuario_id: number | null;
  usuario_nombre: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  descripcion: string;
  datos_anteriores?: unknown;
  datos_nuevos?: unknown;
  metodo_http: string | null;
  ruta: string | null;
  ip: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AuditoriaFilters {
  page?: number;
  limit?: number;
  search?: string;
  usuario_id?: string;
  accion?: string;
  entidad?: string;
  entidad_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export const auditoriaService = {
  async getLogs(params: AuditoriaFilters) {
    const { data } = await api.get('/auditoria', { params });
    return data as {
      success: boolean;
      data: AuditoriaLog[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };
  },

  async getLog(id: number): Promise<AuditoriaLog> {
    const { data } = await api.get(`/auditoria/${id}`);
    return data.data;
  },
};
