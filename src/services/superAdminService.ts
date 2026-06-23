import axios from 'axios';
import API_URL from './config';

const api = axios.create({ baseURL: `${API_URL}/superadmin` });
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface SuperAdminSummary {
  empresas_totales: number;
  empresas_activas: number;
  empresas_demo: number;
  empresas_suspendidas: number;
  empresas_canceladas: number;
  usuarios_totales: number;
}

export interface EmpresaGlobal {
  id: number;
  nombre: string;
  nombre_comercial: string | null;
  razon_social: string | null;
  nit: string | null;
  slug: string;
  estado: string;
  plan: string;
  fecha_inicio: string | null;
  fecha_vencimiento: string | null;
  suscripcion_id?: number | null;
  tipo_suscripcion?: 'prueba' | 'comercial' | null;
  estado_suscripcion?: 'prueba' | 'vigente' | 'gracia' | 'vencida' | null;
  suscripcion_plan?: string | null;
  suscripcion_fecha_inicio?: string | null;
  suscripcion_fecha_vencimiento?: string | null;
  dias_gracia?: number | null;
  fecha_fin_gracia?: string | null;
  dias_restantes?: number | null;
  proxima_a_vencer?: boolean | number;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  total_usuarios: number;
  created_at: string;
  administrador_principal?: {
    id: number;
    username: string;
    email: string;
    name: string;
    active: boolean;
  } | null;
}

export interface Suscripcion {
  id: number;
  empresa_id: number;
  plan: string;
  tipo: 'prueba' | 'comercial';
  estado: 'prueba' | 'vigente' | 'gracia' | 'vencida';
  fecha_inicio: string;
  fecha_vencimiento: string | null;
  dias_gracia: number;
  fecha_fin_gracia: string | null;
  duracion_meses: number | null;
  proxima_a_vencer_dias: number;
  dias_restantes: number | null;
  proxima_a_vencer: boolean;
  estado_empresa: string;
  requiere_reactivacion_explicita?: boolean;
}

export interface HistorialSuscripcion {
  id: number;
  tipo_evento: string;
  estado_suscripcion_anterior: string | null;
  estado_suscripcion_nuevo: string | null;
  fecha_vencimiento_anterior: string | null;
  fecha_vencimiento_nueva: string | null;
  meses_renovados: number | null;
  motivo: string | null;
  origen: string;
  super_admin_username: string | null;
  created_at: string;
}

export const superAdminService = {
  async getMe() {
    const { data } = await api.get('/me');
    return data.data as {
      id: number;
      username: string;
      email: string;
      name: string;
      resumen: SuperAdminSummary;
    };
  },
  async getEmpresas(params: Record<string, string | number | undefined>) {
    const { data } = await api.get('/empresas', { params });
    return data as {
      data: EmpresaGlobal[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };
  },
  async getEmpresa(id: string | number): Promise<EmpresaGlobal> {
    const { data } = await api.get(`/empresas/${id}`);
    return data.data;
  },
  async createEmpresa(payload: Record<string, unknown>) {
    const { data } = await api.post('/empresas', payload);
    return data.data as { id: number };
  },
  async updateEmpresa(id: string | number, payload: Record<string, unknown>) {
    const { data } = await api.put(`/empresas/${id}`, payload);
    return data.data;
  },
  async updateEstado(id: string | number, estado: string) {
    await api.patch(`/empresas/${id}/estado`, { estado });
  },
  async createAdministrador(id: string | number, payload: Record<string, unknown>) {
    const { data } = await api.post(`/empresas/${id}/administrador`, payload);
    return data.data;
  },
  async getSuscripcion(id: string | number): Promise<Suscripcion> {
    const { data } = await api.get(`/empresas/${id}/suscripcion`);
    return data.data;
  },
  async updateSuscripcion(id: string | number, payload: Record<string, unknown>): Promise<Suscripcion> {
    const { data } = await api.patch(`/empresas/${id}/suscripcion`, payload);
    return data.data;
  },
  async renovarSuscripcion(
    id: string | number,
    payload: { meses: 1 | 3 | 6 | 12; dias_gracia: number; motivo?: string; plan?: string }
  ): Promise<Suscripcion> {
    const { data } = await api.post(`/empresas/${id}/suscripcion/renovar`, payload);
    return data.data;
  },
  async getHistorialSuscripcion(id: string | number): Promise<HistorialSuscripcion[]> {
    const { data } = await api.get(`/empresas/${id}/suscripcion/historial`, { params: { limit: 20 } });
    return data.data;
  },
};
