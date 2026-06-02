import axios from 'axios';
import API_URL from './config';

const getConfig = () => {
  const token = sessionStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

export type TipoOrigen = 'VENTA' | 'REPARACION' | 'MANUAL';
export type FrecuenciaPago = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

export interface ItemCarritoVenta {
  id: number;
  nombre: string;
  sku?: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

export interface ReparacionBusqueda {
  id: string;
  numero_reparacion?: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  marca: string;
  modelo: string;
  estado?: string;
  total: number;
  monto_anticipo?: number;
}

export interface Deudor {
  id: number;
  numero_credito: string;
  cliente_id?: number;
  cliente_nombre: string;
  cliente_telefono?: string;
  descripcion?: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  fecha_vencimiento?: string;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'ANULADO';
  tipo_origen?: TipoOrigen;
  numero_cuotas?: number;
  monto_cuota?: number;
  frecuencia_pago?: FrecuenciaPago;
  fecha_primer_pago?: string;
  items_detalle?: string;
  referencia_venta_id?: number;
  referencia_reparacion_id?: string;
  notas?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  pagos?: DeudorPago[];
  cliente_nombre_actual?: string;
  cliente_telefono_actual?: string;
  motivo_anulacion?: string;
  fecha_anulacion?: string;
  anulado_por?: number;
}

export interface DeudorPago {
  id: number;
  deudor_id: number;
  numero_cuota?: number;
  monto: number;
  monto_programado?: number;
  metodo_pago: string;
  referencia?: string;
  notas?: string;
  realizado_por?: string;
  fecha_pago?: string;
  fecha_vencimiento?: string;
  estado_cuota?: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO' | 'ANULADA';
  porcentaje_recargo?: number;
  monto_recargo?: number;
  total_cobrado?: number;
}

export interface DeudoresResumen {
  total_creditos: number;
  pendientes: number;
  parciales: number;
  pagados: number;
  total_prestado: number;
  total_pendiente: number;
  total_cobrado: number;
}

export const deudoresService = {
  getAll: async (filters?: { estado?: string; search?: string; tipo_origen?: string }): Promise<Deudor[]> => {
    const params = new URLSearchParams();
    if (filters?.estado) params.append('estado', filters.estado);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.tipo_origen) params.append('tipo_origen', filters.tipo_origen);
    const { data } = await axios.get(`${API_URL}/deudores?${params}`, getConfig());
    return data.data;
  },

  getById: async (id: number): Promise<Deudor> => {
    const { data } = await axios.get(`${API_URL}/deudores/${id}`, getConfig());
    return data.data;
  },

  create: async (payload: {
    cliente_id?: number | null;
    cliente_nombre: string;
    cliente_telefono?: string;
    descripcion?: string;
    monto_total: number;
    fecha_vencimiento?: string;
    tipo_origen?: TipoOrigen;
    numero_cuotas?: number;
    frecuencia_pago?: FrecuenciaPago;
    fecha_primer_pago?: string;
    items_detalle?: ItemCarritoVenta[] | null;
    referencia_venta_id?: number;
    referencia_reparacion_id?: string;
    notas?: string;
    created_by?: string;
  }): Promise<Deudor> => {
    const { data } = await axios.post(`${API_URL}/deudores`, payload, getConfig());
    return data.data;
  },

  registrarPago: async (id: number, payload: {
    monto: number;
    metodo_pago: string;
    referencia?: string;
    notas?: string;
    realizado_por?: string;
    porcentaje_recargo?: number;
    usuario_id?: number;
    cuenta_id?: number;
  }): Promise<Deudor> => {
    const { data } = await axios.post(`${API_URL}/deudores/${id}/pago`, payload, getConfig());
    return data.data;
  },

  anular: async (id: number, motivo: string, anulado_por?: number): Promise<void> => {
    await axios.post(`${API_URL}/deudores/${id}/anular`, { motivo, anulado_por }, getConfig());
  },

  getResumen: async (): Promise<DeudoresResumen> => {
    const { data } = await axios.get(`${API_URL}/deudores/resumen`, getConfig());
    return data.data;
  },

  getCuentasBancarias: async (): Promise<Array<{ id: number; nombre: string; numero_cuenta?: string; tipo_cuenta?: string; activa: boolean }>> => {
    const { data } = await axios.get(`${API_URL}/caja/bancos`, getConfig());
    return (data.data || []).filter((c: any) => c.activa);
  },

  searchProductos: async (q: string) => {
    const { data } = await axios.get(
      `${API_URL}/products?search=${encodeURIComponent(q)}&activo=true&limit=8`,
      getConfig()
    );
    return (data.data || []) as Array<{
      id: number; nombre: string; sku?: string; precio_venta: number; stock: number;
    }>;
  },

  searchReparaciones: async (q: string): Promise<ReparacionBusqueda[]> => {
    const { data } = await axios.get(
      `${API_URL}/deudores/buscar/reparaciones?search=${encodeURIComponent(q)}&limit=15`,
      getConfig()
    );
    return data.data || [];
  },
};
