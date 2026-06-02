import axios from 'axios';
import API_URL from './config';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoGeneracion =
  | 'correlativo'
  | 'con_prefijo'
  | 'estructura'
  | 'aleatorio'
  | 'manual';

export interface LoteConfig {
  tipo: TipoGeneracion;
  cantidad: number;
  numeroInicial: number;
  digitos: number;
  prefijo: string;
  estructura: string;
  codigosManual: string;
  diasGarantia: number;
  tipoGarantia: string;
  notas: string;
  guardarComoDisponibles: boolean;
}

export interface StickerGarantia {
  id: number;
  numero_sticker: string;
  estado: 'DISPONIBLE' | 'ASIGNADO' | 'ANULADO' | 'USADO';
  lote_id?: number | null;
  tipo_garantia?: string | null;
  dias_garantia?: number | null;
  notas?: string | null;
  reparacion_id?: number | null;
  fecha_asignacion?: string | null;
  created_at: string;
  codigo_lote?: string | null;
  tipo_generacion?: string | null;
}

export interface StickerLote {
  id: number;
  codigo_lote: string;
  tipo_generacion: string;
  estructura?: string | null;
  prefijo?: string | null;
  cantidad: number;
  numero_inicial: number;
  digitos: number;
  dias_garantia: number;
  tipo_garantia?: string | null;
  notas?: string | null;
  created_at: string;
  total_generados: number;
  disponibles: number;
  asignados: number;
  anulados: number;
}

export interface PreviewResult {
  success: boolean;
  codigos: string[];
  total: number;
  message?: string;
  duplicados?: string[];
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const previewLote = async (config: LoteConfig): Promise<PreviewResult> => {
  const response = await api.post('/stickers/lotes/preview', config);
  return response.data;
};

export const createLote = async (config: LoteConfig): Promise<{ success: boolean; message: string; data: any }> => {
  const response = await api.post('/stickers/lotes', config);
  return response.data;
};

export const getLotes = async (): Promise<StickerLote[]> => {
  const response = await api.get('/stickers/lotes');
  return response.data.data ?? [];
};

export const getStickers = async (filters?: {
  estado?: string;
  lote_id?: number;
  codigo?: string;
}): Promise<StickerGarantia[]> => {
  const response = await api.get('/stickers/lista', { params: filters });
  return response.data.data ?? [];
};

export const anularSticker = async (id: number): Promise<{ success: boolean; message: string }> => {
  const response = await api.put(`/stickers/${id}/anular`);
  return response.data;
};

export const getEstadisticas = async (): Promise<{
  total: number;
  disponibles: number;
  asignados: number;
  usados: number;
}> => {
  const response = await api.get('/stickers/estadisticas');
  return response.data.data ?? {};
};
