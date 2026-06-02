import axios, { InternalAxiosRequestConfig } from 'axios';
import API_URL from './config';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para agregar el token en cada petición
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

// Obtener todas las categorías con subcategorías
export const getAllCategories = async () => {
  const response = await api.get('/categories');
  return response.data;
};

// Crear nueva categoría
export const createCategory = async (categoryData: { nombre: string; icono?: string; orden?: number }) => {
  const response = await api.post('/categories', categoryData);
  return response.data;
};

// Crear nueva subcategoría
export const createSubcategory = async (subcategoryData: { categoria_id: number; nombre: string; orden?: number }) => {
  const response = await api.post('/categories/subcategories', subcategoryData);
  return response.data;
};

// Obtener subcategorías de una categoría
export const getSubcategories = async (categoryId: number) => {
  const response = await api.get(`/categories/${categoryId}/subcategories`);
  return response.data;
};

// Actualizar categoría
export const updateCategory = async (id: number, updates: { nombre?: string; icono?: string; orden?: number; activo?: boolean }) => {
  const response = await api.put(`/categories/${id}`, updates);
  return response.data;
};

// Actualizar subcategoría
export const updateSubcategory = async (id: number, updates: { nombre?: string; orden?: number; activo?: boolean }) => {
  const response = await api.put(`/categories/subcategories/${id}`, updates);
  return response.data;
};

// Eliminar categoría (soft delete)
export const deleteCategory = async (id: number) => {
  const response = await api.delete(`/categories/${id}`);
  return response.data;
};

// Eliminar subcategoría (soft delete)
export const deleteSubcategory = async (id: number) => {
  const response = await api.delete(`/categories/subcategories/${id}`);
  return response.data;
};
