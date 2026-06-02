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

export interface CustomerData {
  nombre: string;
  apellido?: string;
  telefono?: string;
  nit?: string;
  email?: string;
  direccion?: string;
  metodo_pago_preferido?: 'efectivo' | 'tarjeta' | 'credito-tecnocell';
  notas?: string;
}

// Obtener todos los clientes
export const getAllCustomers = async (params?: { search?: string; limit?: number }) => {
  const response = await api.get('/customers', { params });
  return response.data;
};

// Buscar clientes
export const searchCustomers = async (query: string) => {
  const response = await api.get('/customers/search', { params: { query } });
  return response.data;
};

// Obtener cliente por ID
export const getCustomerById = async (id: string) => {
  const response = await api.get(`/customers/${id}`);
  return response.data;
};

// Crear cliente
export const createCustomer = async (data: CustomerData) => {
  const response = await api.post('/customers', data);
  return response.data;
};

// Actualizar cliente
export const updateCustomer = async (id: string, data: Partial<CustomerData>) => {
  const response = await api.put(`/customers/${id}`, data);
  return response.data;
};

// Eliminar cliente
export const deleteCustomer = async (id: string) => {
  const response = await api.delete(`/customers/${id}`);
  return response.data;
};

// Obtener compras/ventas del cliente
export const getCustomerPurchases = async (id: string) => {
  const response = await api.get(`/customers/${id}/purchases`);
  return response.data;
};
