import axios from 'axios';
import API_URL from './config';

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_URL
});

// Interceptor para agregar el token JWT
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface Marca {
  id: number;
  nombre: string;
  descripcion?: string;
  logo_url?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Linea {
  id: number;
  marca_id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface LineaConMarca extends Linea {
  marca_nombre: string;
}

export interface MarcaConLineas extends Marca {
  total_lineas: number;
  lineas?: string; // Comma-separated string de nombres de líneas
}

// ============================================
// FUNCIONES DE MARCAS
// ============================================

/**
 * Obtener todas las marcas
 */
export const getAllMarcas = async (activo?: boolean): Promise<Marca[]> => {
  const params = activo !== undefined ? { activo } : {};
  const response = await api.get('/marcas', { params });
  return response.data;
};

/**
 * Obtener una marca por ID
 */
export const getMarcaById = async (id: number): Promise<Marca> => {
  const response = await api.get(`/marcas/${id}`);
  return response.data;
};

/**
 * Crear una nueva marca
 */
export const createMarca = async (data: {
  nombre: string;
  descripcion?: string;
  logo_url?: string;
}): Promise<Marca> => {
  const response = await api.post('/marcas', data);
  return response.data;
};

/**
 * Actualizar una marca
 */
export const updateMarca = async (
  id: number,
  data: Partial<Marca>
): Promise<Marca> => {
  const response = await api.put(`/marcas/${id}`, data);
  return response.data;
};

/**
 * Eliminar una marca
 */
export const deleteMarca = async (id: number): Promise<{ message: string }> => {
  const response = await api.delete(`/marcas/${id}`);
  return response.data;
};

/**
 * Obtener marcas con conteo de líneas
 */
export const getMarcasConLineas = async (): Promise<MarcaConLineas[]> => {
  const response = await api.get('/marcas/con-lineas');
  return response.data;
};

// ============================================
// FUNCIONES DE LÍNEAS
// ============================================

/**
 * Obtener todas las líneas
 */
export const getAllLineas = async (params?: {
  marca_id?: number;
  activo?: boolean;
}): Promise<Linea[]> => {
  const response = await api.get('/lineas', { params });
  return response.data;
};

/**
 * Obtener líneas por marca
 */
export const getLineasByMarca = async (
  marcaId: number,
  activo?: boolean
): Promise<Linea[]> => {
  const params = activo !== undefined ? { activo } : {};
  const response = await api.get(`/marcas/${marcaId}/lineas`, { params });
  return response.data;
};

/**
 * Obtener líneas con información de marca
 */
export const getLineasConMarca = async (): Promise<LineaConMarca[]> => {
  const response = await api.get('/lineas/con-marca');
  return response.data;
};

/**
 * Crear una nueva línea
 */
export const createLinea = async (data: {
  marca_id: number;
  nombre: string;
  descripcion?: string;
}): Promise<Linea> => {
  const response = await api.post('/lineas', data);
  return response.data;
};

/**
 * Actualizar una línea
 */
export const updateLinea = async (
  id: number,
  data: Partial<Linea>
): Promise<Linea> => {
  const response = await api.put(`/lineas/${id}`, data);
  return response.data;
};

/**
 * Eliminar una línea
 */
export const deleteLinea = async (id: number): Promise<{ message: string }> => {
  const response = await api.delete(`/lineas/${id}`);
  return response.data;
};

// ============================================
// CATÁLOGOS JERÁRQUICOS DE REPUESTOS
// GET/POST /api/repuestos/tipos
// GET/POST /api/repuestos/marcas
// GET/POST /api/repuestos/modelos
// ============================================

export interface RepuestoTipo {
  id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepuestoMarca {
  id: number;
  tipo_id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepuestoModelo {
  id: number;
  tipo_id: number;
  marca_id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export const getRepuestoTipos = async (): Promise<RepuestoTipo[]> => {
  const response = await api.get('/repuestos/tipos');
  return response.data;
};

export const createRepuestoTipo = async (data: { nombre: string }): Promise<RepuestoTipo> => {
  const response = await api.post('/repuestos/tipos', data);
  return response.data;
};

export const getRepuestoMarcas = async (tipo_id: number): Promise<RepuestoMarca[]> => {
  const response = await api.get('/repuestos/marcas', { params: { tipo_id } });
  return response.data;
};

export const createRepuestoMarca = async (data: {
  tipo_id: number;
  nombre: string;
}): Promise<RepuestoMarca> => {
  const response = await api.post('/repuestos/marcas', data);
  return response.data;
};

export const getRepuestoModelos = async (
  tipo_id: number,
  marca_id: number,
): Promise<RepuestoModelo[]> => {
  const response = await api.get('/repuestos/modelos', { params: { tipo_id, marca_id } });
  return response.data;
};

export const createRepuestoModelo = async (data: {
  tipo_id: number;
  marca_id: number;
  nombre: string;
}): Promise<RepuestoModelo> => {
  const response = await api.post('/repuestos/modelos', data);
  return response.data;
};
