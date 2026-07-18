import axios from 'axios';
import API_URL from './config';
import { ACTIVE_BRANCH_STORAGE_KEY } from './sucursalContextService';

export interface CajaCatalogo {
  id: number; empresa_id: number; sucursal_id: number; nombre: string; codigo: string;
  descripcion: string | null; activa: boolean | number; sucursal_nombre?: string;
  created_at?: string; updated_at?: string;
}
export interface CajaPayload { nombre: string; codigo: string; descripcion?: string | null; sucursal_id?: number; }
export interface CajaApi {
  listar(sucursalId?: number): Promise<CajaCatalogo[]>;
  crear(payload: CajaPayload): Promise<CajaCatalogo>;
  editar(row: CajaCatalogo, payload: CajaPayload): Promise<CajaCatalogo>;
  cambiarEstado(row: CajaCatalogo, activa: boolean): Promise<CajaCatalogo>;
  eliminar(row: CajaCatalogo): Promise<void>;
}

function makeApi(baseURL: string, platform = false): CajaApi {
  const api = axios.create({ baseURL });
  api.interceptors.request.use(config => {
    const token = sessionStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (!platform) {
      const branch = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
      if (branch) config.headers['X-Sucursal-Id'] = branch;
    }
    return config;
  });
  const branchParams = (row: CajaCatalogo) => platform ? { params: { sucursal_id: row.sucursal_id } } : undefined;
  return {
    async listar(sucursalId) { const { data } = await api.get('', platform && sucursalId ? { params: { sucursal_id: sucursalId } } : undefined); return data.data; },
    async crear(payload) { const { data } = await api.post('', payload); return data.data; },
    async editar(row, payload) { const { data } = await api.put(`/${row.id}`, payload, branchParams(row)); return data.data; },
    async cambiarEstado(row, activa) { const { data } = await api.patch(`/${row.id}/estado`, { activa }, branchParams(row)); return data.data; },
    async eliminar(row) { await api.delete(`/${row.id}`, branchParams(row)); },
  };
}

export const empresaCajaApi = makeApi(`${API_URL}/cajas`);
export const superAdminCajaApi = (empresaId: number | string) => makeApi(`${API_URL}/superadmin/empresas/${empresaId}/cajas`, true);

export function cajaError(error: any, fallback: string) {
  const data = error?.response?.data;
  if (data?.code === 'DUPLICATE_CASH_REGISTER_CODE') return 'Ya existe una caja con ese código en esta sucursal.';
  if (data?.code === 'CASH_REGISTER_NOT_FOUND') return 'La caja no existe en la empresa o sucursal seleccionada.';
  return data?.message || fallback;
}

