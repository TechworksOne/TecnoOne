import axios from 'axios';
import API_URL from './config';

export interface Sucursal {
  id: number;
  empresa_id: number;
  codigo: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  activa: boolean | number;
  es_principal: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export interface SucursalPayload {
  codigo: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  es_principal?: boolean;
}

export interface SucursalApi {
  listar(): Promise<Sucursal[]>;
  crear(payload: SucursalPayload): Promise<Sucursal>;
  editar(id: number, payload: Partial<SucursalPayload>): Promise<Sucursal>;
  cambiarEstado(id: number, activa: boolean): Promise<Sucursal>;
}

function client(baseURL: string) {
  const api = axios.create({ baseURL });
  api.interceptors.request.use(config => {
    const token = sessionStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return api;
}

function createSucursalApi(baseURL: string): SucursalApi {
  const api = client(baseURL);
  return {
    async listar() {
      const { data } = await api.get('');
      return data.data;
    },
    async crear(payload) {
      const { data } = await api.post('', payload);
      return data.data;
    },
    async editar(id, payload) {
      const { data } = await api.put(`/${id}`, payload);
      return data.data;
    },
    async cambiarEstado(id, activa) {
      const { data } = await api.patch(`/${id}/estado`, { activa });
      return data.data;
    },
  };
}

export const adminSucursalApi = createSucursalApi(`${API_URL}/admin/sucursales`);

export function superAdminSucursalApi(empresaId: string | number) {
  return createSucursalApi(`${API_URL}/superadmin/empresas/${empresaId}/sucursales`);
}

export function sucursalErrorMessage(error: any, fallback: string) {
  const response = error?.response?.data;
  const code = response?.code;
  if (code === 'PLAN_LIMIT_CONFLICT') {
    return `Se alcanzó el límite de sucursales del plan. Uso: ${response.used ?? '—'} de ${response.limit ?? '—'}.`;
  }
  if (code === 'BRANCH_NOT_FOUND') return 'La sucursal ya no existe o no pertenece a esta empresa.';
  if (code === 'DUPLICATE_BRANCH_CODE' || code === 'BRANCH_CODE_CONFLICT') {
    return 'Ya existe una sucursal con ese código.';
  }
  if (code === 'PRIMARY_BRANCH_REQUIRED') {
    return response.message || 'No se puede desactivar la sucursal principal.';
  }
  return response?.message || fallback;
}
