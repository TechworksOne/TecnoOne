import axios from 'axios';
import type { OrdenTrabajo, Tecnico, AsignarTecnicoPayload, ResumenOT } from '../types/ot';
import API_URL from './config';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Filtros OT activas ─────────────────────────────────────────────────────
export interface OTFilters {
  estado?: string;
  tecnico_id?: number;
  busqueda?: string;
}

// ── Filtros historial ──────────────────────────────────────────────────────
export interface HistorialFilters {
  busqueda?: string;
  tecnico_id?: number;
}

// ── Obtener OTs activas ────────────────────────────────────────────────────
export async function getOrdenesTrabajo(filters?: OTFilters): Promise<OrdenTrabajo[]> {
  const params = new URLSearchParams();
  if (filters?.estado)     params.set('estado',     filters.estado);
  if (filters?.tecnico_id !== undefined) params.set('tecnico_id', String(filters.tecnico_id));
  if (filters?.busqueda)   params.set('busqueda',   filters.busqueda);

  const { data } = await api.get<{ success: boolean; data: OrdenTrabajo[] }>(
    `/ot?${params.toString()}`
  );
  return data.data;
}

// ── Obtener historial (canceladas + entregadas) ────────────────────────────
export async function getHistorialOT(filters?: HistorialFilters): Promise<OrdenTrabajo[]> {
  const params = new URLSearchParams();
  if (filters?.busqueda)   params.set('busqueda',   filters.busqueda);
  if (filters?.tecnico_id !== undefined) params.set('tecnico_id', String(filters.tecnico_id));

  const { data } = await api.get<{ success: boolean; data: OrdenTrabajo[] }>(
    `/ot/historial?${params.toString()}`
  );
  return data.data;
}

// ── Obtener resumen para dashboard ────────────────────────────────────────
export async function getResumenOT(): Promise<ResumenOT> {
  const { data } = await api.get<{ success: boolean; data: ResumenOT }>('/ot/resumen');
  return data.data;
}

// ── Obtener técnicos disponibles ──────────────────────────────────────────
export async function getTecnicos(): Promise<Tecnico[]> {
  const { data } = await api.get<{ success: boolean; data: Tecnico[] }>('/ot/tecnicos');
  return data.data;
}

// ── Asignar técnico a reparación ──────────────────────────────────────────
export async function asignarTecnico(
  reparacionId: string,
  payload: AsignarTecnicoPayload
): Promise<void> {
  await api.patch(`/reparaciones/${reparacionId}/asignar-tecnico`, payload);
}

// ── Quitar asignación técnica ─────────────────────────────────────────────
export async function quitarAsignacion(reparacionId: string): Promise<void> {
  await api.delete(`/reparaciones/${reparacionId}/asignar-tecnico`);
}

