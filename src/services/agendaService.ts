import axios from 'axios';
import type { EntregaAgenda, AgendaEvento } from '../types/agenda';
import API_URL from './config';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Obtener entregas para la Agenda ─────────────────────────────────────────
export interface GetEntregasParams {
  fecha_inicio?: string; // YYYY-MM-DD
  fecha_fin?: string;    // YYYY-MM-DD
  estado?: string;       // coma-separado si múltiple
}

export const getEntregas = async (params?: GetEntregasParams): Promise<EntregaAgenda[]> => {
  const response = await api.get('/agenda/entregas', { params });
  return response.data.data as EntregaAgenda[];
};

// ─── Asignar / actualizar fecha de entrega en una reparación ─────────────────
export interface PatchFechaEntregaPayload {
  fecha_entrega_programada: string; // ISO datetime  e.g. "2026-05-25T14:00:00"
  nota_entrega_programada?: string;
}

export const patchFechaEntrega = async (
  reparacionId: string,
  payload: PatchFechaEntregaPayload
): Promise<void> => {
  await api.patch(`/reparaciones/${reparacionId}/fecha-entrega`, payload);
};

// ─── Eliminar fecha de entrega programada ────────────────────────────────────
export const deleteFechaEntrega = async (reparacionId: string): Promise<void> => {
  await api.delete(`/reparaciones/${reparacionId}/fecha-entrega`);
};

// ─── Reparaciones pendientes (selector en modal Programar nueva entrega) ──────
export interface ReparacionPendiente {
  id: string;
  cliente_nombre: string;
  tipo_equipo?: string;
  marca?: string;
  modelo?: string;
  estado: string;
}

export const searchReparacionesPendientes = async (search?: string): Promise<ReparacionPendiente[]> => {
  const response = await api.get('/reparaciones', {
    params: { search: search || undefined, limit: 20 },
  });
  return (response.data.data as any[])
    .filter((r) => r.estado !== 'ENTREGADA' && r.estado !== 'CANCELADA')
    .map((r) => ({
      id: r.id,
      cliente_nombre: r.cliente_nombre,
      tipo_equipo: r.tipo_equipo ?? undefined,
      marca: r.marca ?? undefined,
      modelo: r.modelo ?? undefined,
      estado: r.estado,
    }));
};

// ─── Eventos libres de la agenda ─────────────────────────────────────────────
export interface AgendaEventoPayload {
  titulo: string;
  fecha: string;
  hora?: string;
  descripcion?: string;
  tipo?: 'nota' | 'cita' | 'recordatorio' | 'otro';
  para_rol?: string;
  para_usuario_id?: number;
  para_usuario_nombre?: string;
}

export interface UsuarioSimple {
  id: number;
  nombre: string;
  roles: string[];
}

export const getUsuariosParaAgenda = async (): Promise<UsuarioSimple[]> => {
  const response = await api.get('/agenda/usuarios');
  return response.data.data as UsuarioSimple[];
};

export const getEventos = async (params?: { fecha_inicio?: string; fecha_fin?: string }): Promise<AgendaEvento[]> => {
  const response = await api.get('/agenda/eventos', { params });
  return response.data.data as AgendaEvento[];
};

export const createEvento = async (payload: AgendaEventoPayload): Promise<AgendaEvento> => {
  const response = await api.post('/agenda/eventos', payload);
  return response.data.data as AgendaEvento;
};

export const updateEvento = async (id: number, payload: AgendaEventoPayload): Promise<AgendaEvento> => {
  const response = await api.put(`/agenda/eventos/${id}`, payload);
  return response.data.data as AgendaEvento;
};

export const deleteEvento = async (id: number): Promise<void> => {
  await api.delete(`/agenda/eventos/${id}`);
};
