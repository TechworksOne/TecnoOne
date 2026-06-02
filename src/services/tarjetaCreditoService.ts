import axios from 'axios';
import API_URL from './config';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export interface TarjetaCredito {
  id: number;
  banco: string;
  alias: string | null;
  ultimos4: string;
  tasa_interes: number;
  dia_corte: number;
  dia_pago: number;
  /** En centavos */
  limite_credito: number;
  moneda: string;
  activo: 1 | 0;
  notas: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  /** Calculado por el backend — en centavos */
  saldo_centavos: number;
  creado_por_nombre?: string;
}

export interface TarjetaMovimiento {
  id: number;
  tarjeta_id: number;
  tipo: 'compra' | 'pago' | 'interes' | 'ajuste' | 'anulacion';
  monto: number;
  descripcion: string | null;
  referencia_tipo: string | null;
  referencia_id: number | null;
  cuenta_origen_id: number | null;
  fecha_movimiento: string;
  created_by: number | null;
  created_at: string;
  creado_por_nombre?: string;
}

export interface TarjetaForm {
  banco: string;
  alias?: string;
  ultimos4: string;
  tasa_interes: number;
  dia_corte: number;
  dia_pago: number;
  limite_credito?: number;
  moneda?: string;
  notas?: string;
}

export interface PagoTarjetaForm {
  cuenta_origen_id?: number;
  tipo_cuenta_origen: 'banco' | 'caja';
  monto: number;
  fecha?: string;
  observaciones?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
/** Formatea una tarjeta como "Banco ****1234" */
export const formatTarjeta = (t: Pick<TarjetaCredito, 'banco' | 'alias' | 'ultimos4'>) =>
  `${t.alias || t.banco} ****${t.ultimos4}`;

/** Convierte centavos a quetzales */
export const centsToQ = (cents: number) => Number(cents) / 100;

// ── API calls ──────────────────────────────────────────────────────────────
export const getTarjetas = async (): Promise<TarjetaCredito[]> => {
  const res = await api.get('/tarjetas-credito');
  return res.data.data;
};

export const createTarjeta = async (data: TarjetaForm) => {
  const res = await api.post('/tarjetas-credito', data);
  return res.data;
};

export const updateTarjeta = async (id: number, data: TarjetaForm) => {
  const res = await api.put(`/tarjetas-credito/${id}`, data);
  return res.data;
};

export const desactivarTarjeta = async (id: number) => {
  const res = await api.patch(`/tarjetas-credito/${id}/desactivar`);
  return res.data;
};

export const getMovimientos = async (id: number): Promise<TarjetaMovimiento[]> => {
  const res = await api.get(`/tarjetas-credito/${id}/movimientos`);
  return res.data.data;
};

export const registrarPago = async (id: number, data: PagoTarjetaForm) => {
  const res = await api.post(`/tarjetas-credito/${id}/pagos`, data);
  return res.data;
};

export const registrarAjuste = async (id: number, data: { monto: number; descripcion?: string; fecha?: string }) => {
  const res = await api.post(`/tarjetas-credito/${id}/ajustes`, data);
  return res.data;
};
