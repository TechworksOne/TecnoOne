import axios from 'axios';
import API_URL from './config';
import { getImageUrl } from '../utils/getImageUrl';

const api = axios.create({ baseURL: API_URL });

// Attach token automatically
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface UsuarioListItem {
  id: number;
  username: string | null;
  email: string | null;
  active: boolean;
  ultimo_login: string | null;
  created_at: string;
  nombres: string;
  apellidos: string | null;
  telefono: string | null;
  dpi: string | null;
  direccion: string | null;
  foto_perfil: string | null;
  roles: string[];
}

export interface RolItem {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  total_usuarios: number;
}

export interface CreateUsuarioPayload {
  username?: string;
  email?: string;
  password: string;
  nombres: string;
  apellidos?: string;
  telefono?: string;
  dpi?: string;
  direccion?: string;
  roles: string[];
  foto?: File | null;
}

export interface UpdateUsuarioPayload {
  username?: string;
  email?: string;
  nombres?: string;
  apellidos?: string;
  telefono?: string;
  dpi?: string;
  direccion?: string;
  roles?: string[];
  active?: boolean;
  foto?: File | null;
}

export function fotoUrl(fotoPerfil: string | null | undefined): string | null {
  if (!fotoPerfil) return null;
  return getImageUrl(fotoPerfil) || null;
}

export const adminUsuarioService = {
  async getUsuarios(params?: { buscar?: string; rol?: string; estado?: string }): Promise<UsuarioListItem[]> {
    const { data } = await api.get('/admin/usuarios', { params });
    return data.data;
  },

  async getUsuarioById(id: number): Promise<UsuarioListItem> {
    const { data } = await api.get(`/admin/usuarios/${id}`);
    return data.data;
  },

  async createUsuario(payload: CreateUsuarioPayload): Promise<{ id: number }> {
    const form = new FormData();
    form.append('nombres', payload.nombres);
    if (payload.apellidos) form.append('apellidos', payload.apellidos);
    if (payload.username) form.append('username', payload.username);
    if (payload.email) form.append('email', payload.email);
    form.append('password', payload.password);
    if (payload.telefono) form.append('telefono', payload.telefono);
    if (payload.dpi) form.append('dpi', payload.dpi);
    if (payload.direccion) form.append('direccion', payload.direccion);
    payload.roles.forEach(r => form.append('roles', r));
    if (payload.foto) form.append('foto_perfil', payload.foto);
    const { data } = await api.post('/admin/usuarios', form);
    return data.data;
  },

  async updateUsuario(id: number, payload: UpdateUsuarioPayload): Promise<void> {
    const form = new FormData();
    if (payload.nombres !== undefined) form.append('nombres', payload.nombres);
    if (payload.apellidos !== undefined) form.append('apellidos', payload.apellidos ?? '');
    if (payload.username !== undefined) form.append('username', payload.username ?? '');
    if (payload.email !== undefined) form.append('email', payload.email ?? '');
    if (payload.telefono !== undefined) form.append('telefono', payload.telefono ?? '');
    if (payload.dpi !== undefined) form.append('dpi', payload.dpi ?? '');
    if (payload.direccion !== undefined) form.append('direccion', payload.direccion ?? '');
    if (payload.active !== undefined) form.append('active', String(payload.active));
    if (payload.roles) payload.roles.forEach(r => form.append('roles', r));
    if (payload.foto) form.append('foto_perfil', payload.foto);
    await api.put(`/admin/usuarios/${id}`, form);
  },

  async toggleEstado(id: number): Promise<{ active: boolean }> {
    const { data } = await api.patch(`/admin/usuarios/${id}/estado`);
    return data.data;
  },

  async changePassword(id: number, password: string): Promise<void> {
    await api.patch(`/admin/usuarios/${id}/password`, { password });
  },

  async getRoles(): Promise<RolItem[]> {
    const { data } = await api.get('/admin/roles');
    return data.data;
  },

  async createRol(nombre: string, descripcion?: string): Promise<{ id: number }> {
    const { data } = await api.post('/admin/roles', { nombre, descripcion });
    return data.data;
  },

  async updateRol(id: number, payload: { descripcion?: string; activo?: boolean }): Promise<void> {
    await api.put(`/admin/roles/${id}`, payload);
  },
};
