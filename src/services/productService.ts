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

export interface ProductImage {
  id?: number;
  url: string;
  orden?: number;
  descripcion?: string;
}

export interface ProductData {
  sku?: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  subcategoria?: string;
  precio_costo: number;
  precio_venta: number;
  stock?: number;
  stock_minimo?: number;
  aplica_serie?: boolean;
  imagenes?: ProductImage[];
}

export interface StockAdjustment {
  cantidad: number;
  tipo?: 'compra' | 'venta' | 'ajuste' | 'devolucion';
  nota?: string;
  usuario_id?: number;
}

// Obtener todos los productos con paginación
export const getAllProducts = async (params?: { 
  categoria?: string; 
  activo?: boolean; 
  conStock?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const response = await api.get('/products', { params });
  return response.data;
};

// Obtener productos con stock crítico
export const getCriticalStockProducts = async () => {
  const response = await api.get('/products/alerts/critical-stock');
  return response.data;
};

// Obtener producto por ID
export const getProductById = async (id: number | string) => {
  const response = await api.get(`/products/${id}`);
  return response.data;
};

// Crear producto
export const createProduct = async (productData: ProductData) => {
  const response = await api.post('/products', productData);
  return response.data;
};

// Actualizar producto
export const updateProduct = async (id: number | string, updates: Partial<ProductData>) => {
  const response = await api.put(`/products/${id}`, updates);
  return response.data;
};

// Eliminar producto (soft delete)
export const deleteProduct = async (id: number | string) => {
  const response = await api.delete(`/products/${id}`);
  return response.data;
};

// Ajustar stock
export const adjustStock = async (id: number | string, adjustment: StockAdjustment) => {
  const response = await api.patch(`/products/${id}/stock`, adjustment);
  return response.data;
};

// Obtener kardex de un producto
export const getProductKardex = async (id: number | string, limit?: number) => {
  const response = await api.get(`/products/${id}/kardex`, { params: { limit } });
  return response.data;
};

// Buscar productos
export const searchProducts = async (query: string) => {
  const response = await api.get('/products/search', { params: { q: query } });
  return response.data;
};
