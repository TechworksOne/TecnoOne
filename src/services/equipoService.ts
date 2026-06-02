// Servicio para gestionar marcas y modelos de equipos
import axios from 'axios';
import type { EquipoMarca, EquipoModelo, CreateMarcaRequest, CreateModeloRequest, TipoEquipo } from '../types/equipo';
import API_URL from './config';

const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ========== MARCAS ==========

export const getAllMarcas = async (tipoEquipo?: TipoEquipo): Promise<EquipoMarca[]> => {
  try {
    const params = tipoEquipo ? { tipo_equipo: tipoEquipo } : {};
    const response = await api.get('/equipos/marcas', { params });
    return response.data.data;
  } catch (error) {
    console.error('Error al obtener marcas:', error);
    throw error;
  }
};

export const createMarca = async (marca: CreateMarcaRequest): Promise<EquipoMarca> => {
  try {
    const response = await api.post('/equipos/marcas', marca);
    return response.data.data;
  } catch (error) {
    console.error('Error al crear marca:', error);
    throw error;
  }
};

export const updateMarca = async (id: number, updates: Partial<EquipoMarca>): Promise<EquipoMarca> => {
  try {
    const response = await api.put(`/equipos/marcas/${id}`, updates);
    return response.data.data;
  } catch (error) {
    console.error('Error al actualizar marca:', error);
    throw error;
  }
};

export const deleteMarca = async (id: number): Promise<void> => {
  try {
    await api.delete(`/equipos/marcas/${id}`);
  } catch (error) {
    console.error('Error al eliminar marca:', error);
    throw error;
  }
};

// ========== MODELOS ==========

export const getAllModelos = async (): Promise<EquipoModelo[]> => {
  try {
    const response = await api.get('/equipos/modelos');
    return response.data.data;
  } catch (error) {
    console.error('Error al obtener modelos:', error);
    throw error;
  }
};

export const getModelosByMarca = async (marcaId: number): Promise<EquipoModelo[]> => {
  try {
    const response = await api.get(`/equipos/marcas/${marcaId}/modelos`);
    return response.data.data;
  } catch (error) {
    console.error('Error al obtener modelos de la marca:', error);
    throw error;
  }
};

export const createModelo = async (modelo: CreateModeloRequest): Promise<EquipoModelo> => {
  try {
    const response = await api.post('/equipos/modelos', modelo);
    return response.data.data;
  } catch (error) {
    console.error('Error al crear modelo:', error);
    throw error;
  }
};

export const updateModelo = async (id: number, updates: Partial<EquipoModelo>): Promise<EquipoModelo> => {
  try {
    const response = await api.put(`/equipos/modelos/${id}`, updates);
    return response.data.data;
  } catch (error) {
    console.error('Error al actualizar modelo:', error);
    throw error;
  }
};

export const deleteModelo = async (id: number): Promise<void> => {
  try {
    await api.delete(`/equipos/modelos/${id}`);
  } catch (error) {
    console.error('Error al eliminar modelo:', error);
    throw error;
  }
};

const equipoService = {
  getAllMarcas,
  createMarca,
  updateMarca,
  deleteMarca,
  getAllModelos,
  getModelosByMarca,
  createModelo,
  updateModelo,
  deleteModelo
};

export default equipoService;
