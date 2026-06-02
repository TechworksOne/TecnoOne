import axios, { InternalAxiosRequestConfig } from 'axios';
import API_URL from './config';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para agregar el token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

export interface SupplierData {
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  nit?: string;
  empresa?: string;
  sitio_web?: string;
  notas?: string;
  activo?: boolean;
}

// Obtener todos los proveedores
export const getAllSuppliers = async (params?: { search?: string; activo?: boolean; limit?: number }) => {
  const response = await api.get('/suppliers', { params });
  return response.data;
};

// Buscar proveedores
export const searchSuppliers = async (query: string) => {
  const response = await api.get('/suppliers/search', { params: { query } });
  return response.data;
};

// Obtener proveedor por ID
export const getSupplierById = async (id: string) => {
  const response = await api.get(`/suppliers/${id}`);
  return response.data;
};

// Obtener compras de un proveedor
export const getSupplierPurchases = async (id: string) => {
  const response = await api.get(`/suppliers/${id}/purchases`);
  return response.data;
};

// Crear proveedor
export const createSupplier = async (data: SupplierData) => {
  const response = await api.post('/suppliers', data);
  return response.data;
};

// Actualizar proveedor
export const updateSupplier = async (id: string, data: Partial<SupplierData>) => {
  const response = await api.put(`/suppliers/${id}`, data);
  return response.data;
};

// Eliminar proveedor (soft delete)
export const deleteSupplier = async (id: string) => {
  const response = await api.delete(`/suppliers/${id}`);
  return response.data;
};

export default api;
