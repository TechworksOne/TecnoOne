import { toBackendEstado } from "../utils/estadoReparacion";
import API_URL from './config';
import axios from 'axios';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para agregar token
api.interceptors.request.use(
  (config) => {
    // authService guarda en sessionStorage; también busca en localStorage por compatibilidad
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Debug: URL, método, presencia de token (NO imprime el token completo)
    console.debug(
      `[flujoReparacionService] ${(config.method ?? 'GET').toUpperCase()} ${config.baseURL ?? ''}${config.url ?? ''}`,
      { hasToken: !!token }
    );
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(
        `[flujoReparacionService] Error HTTP ${error.response.status}:`,
        error.response.data
      );
    }
    return Promise.reject(error);
  }
);

// ========== INGRESO DE EQUIPO (CHECKLIST) ==========

export interface ChecklistData {
  checks: {
    // Teléfono
    equipoEnciende?: boolean;
    daFlash?: boolean;
    bocinaSuperior?: boolean;
    bocinaInferior?: boolean;
    faceId?: boolean;
    touchId?: boolean;
    camara05x?: boolean;
    camara10x?: boolean;
    camara30x?: boolean;
    camaraFrontal?: boolean;
    microfono?: boolean;
    vibracion?: boolean;
    wifi?: boolean;
    bluetooth?: boolean;
    pantallaCompleta?: boolean;
    tactil?: boolean;
    botonSubirVolumen?: boolean;
    botonBajarVolumen?: boolean;
    botonPower?: boolean;
    puertoCarga?: boolean;
    cargaInalambrica?: boolean;
    entradaAudifono?: boolean;
    
    // Tablet
    bocinas?: boolean;
    bateria?: boolean;
    
    // Computadora
    pantalla?: boolean;
    teclado?: boolean;
    touchpad?: boolean;
    puertosUSB?: boolean;
    puertoHDMI?: boolean;
    camara?: boolean;
    cargador?: boolean;
    ventilador?: boolean;
  };
  observaciones?: string;
}

export const saveIngresoEquipo = async (reparacionId: string, data: ChecklistData, fotos?: File[]) => {
  const formData = new FormData();
  formData.append('checks', JSON.stringify(data.checks));
  
  if (data.observaciones) {
    formData.append('observaciones', data.observaciones);
  }
  
  if (fotos && fotos.length > 0) {
    fotos.forEach(foto => {
      formData.append('fotos', foto);
    });
  }
  
  // No establecer Content-Type manualmente — el browser/axios lo genera con el boundary correcto
  const response = await api.post(`/flujo-reparaciones/${reparacionId}/ingreso-equipo`, formData);
  return response.data;
};

export const getIngresoEquipo = async (reparacionId: string) => {
  const response = await api.get(`/flujo-reparaciones/${reparacionId}/ingreso-equipo`);
  return response.data;
};

// ========== GESTIÓN DE ESTADOS ==========

export const cambiarEstado = async (
  reparacionId: string, 
  nuevoEstado: string, 
  nota?: string,
  userId?: number,
  userName?: string
) => {
  const response = await api.put(`/flujo-reparaciones/${reparacionId}/estado`, {
    nuevoEstado: toBackendEstado(nuevoEstado),
    nota,
    userId,
    userName
  });
  return response.data;
};

export const getHistorial = async (reparacionId: string) => {
  const response = await api.get(`/flujo-reparaciones/${reparacionId}/historial`);
  return response.data;
};

// ========== ASIGNACIONES ==========

export const asignarTecnico = async (reparacionId: string, tecnicoId: number, tecnicoNombre: string) => {
  const response = await api.put(`/flujo-reparaciones/${reparacionId}/tecnico`, {
    tecnicoId,
    tecnicoNombre
  });
  return response.data;
};

export const cambiarPrioridad = async (reparacionId: string, prioridad: 'BAJA' | 'MEDIA' | 'ALTA') => {
  const response = await api.put(`/flujo-reparaciones/${reparacionId}/prioridad`, {
    prioridad
  });
  return response.data;
};

// ========== FLUJO ACTIVO (excluye ENTREGADA, CANCELADA, etc.) ==========
export const getReparacionesFlujoActivo = async (params?: {
  search?: string;
  prioridad?: string;
  limit?: number;
}) => {
  const response = await api.get('/flujo-reparaciones/activas', { params });
  return response.data;
};

// ========== HISTORIAL DE ENTREGADAS ==========
export const getEntregadas = async (params?: {
  search?: string;
  estado_garantia?: 'vigente' | 'vencida' | 'sin_garantia';
  fecha_inicio?: string;
  fecha_fin?: string;
  limit?: number;
}) => {
  const response = await api.get('/flujo-reparaciones/entregadas', { params });
  return response.data;
};

// ========== REINGRESAR POR GARANTÍA ==========
export interface ReingresarGarantiaData {
  motivo: string;
  repuesto: string;
  observaciones?: string;
  tecnico?: string;
  userId?: number;
  userName?: string;
}

export const reingresarGarantia = async (reparacionId: string, data: ReingresarGarantiaData) => {
  const response = await api.post(`/flujo-reparaciones/${reparacionId}/reingresar-garantia`, data);
  return response.data;
};
