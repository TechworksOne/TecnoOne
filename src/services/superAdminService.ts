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
};
