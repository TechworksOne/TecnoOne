import axios from 'axios';
import API_URL from './config';

const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Permiso {
  id: number;
  codigo: string;
  modulo: string;
  accion: string;
  nombre: string;
  descripcion: string | null;
}

export interface RolPermisos {
  role: { id: number; nombre: string; descripcion: string | null };
  permisos: string[];
}

export interface RolConfigurable {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  total_usuarios: number;
}

export interface PlanInfo {
  id: number;
  codigo: string;
  nombre: string;
  max_usuarios: number | null;
  max_sucursales: number | null;
}

export interface PlanConsumption {
  usuarios_totales: number;
  usuarios_activos: number;
  usuarios_inactivos: number;
  usuarios_limite: number | null;
  usuarios_disponibles: number | null;
  porcentaje_usuarios: number | null;
  sucursales_usadas: number | null;
  sucursales_limite: number | null;
}

export interface MisModulosResponse {
  plan: PlanInfo | null;
  modulos: string[];
  consumo: PlanConsumption | null;
}

export const permisoService = {
  async getMisPermisos(): Promise<string[]> {
    const { data } = await api.get('/permisos/mis-permisos');
    return data.data;
  },

    async getMisModulos(): Promise<MisModulosResponse> {
      const { data } = await api.get('/permisos/mis-modulos');

      return {
        plan: data?.data?.plan ?? null,
        modulos: Array.isArray(data?.data?.modulos)
          ? data.data.modulos
          : [],
        consumo: data?.data?.consumo ?? null,
      };
    },
  async getCatalogo(): Promise<Permiso[]> {
    const { data } = await api.get('/permisos');
    return data.data;
  },
  async getRoles(): Promise<RolConfigurable[]> {
    const { data } = await api.get('/permisos/roles');
    return data.data;
  },
  async getRolPermisos(rolId: number): Promise<RolPermisos> {
    const { data } = await api.get(`/permisos/roles/${rolId}`);
    return data.data;
  },
  async updateRolPermisos(rolId: number, permisos: string[]): Promise<void> {
    await api.put(`/permisos/roles/${rolId}`, { permisos });
  },
};
