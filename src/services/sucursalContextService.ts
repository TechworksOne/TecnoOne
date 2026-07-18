import axios from 'axios';
import API_URL from './config';

export const ACTIVE_BRANCH_STORAGE_KEY = 'tecnoone.sucursalActivaId';

export interface MiSucursal {
  id: number;
  empresa_id: number;
  codigo: string;
  nombre: string;
  direccion?: string | null;
  es_principal: boolean | number;
  es_predeterminada: boolean | number;
}

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const sucursalId = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
  if (sucursalId) config.headers['X-Sucursal-Id'] = sucursalId;
  return config;
});

export const sucursalContextService = {
  async getMisSucursales(): Promise<MiSucursal[]> {
    const { data } = await api.get('/auth/mis-sucursales');
    return data.data;
  },
};
