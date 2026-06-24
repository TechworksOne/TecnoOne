import axios from 'axios';
import API_URL from './config';
import type { TarjetaCredito } from './tarjetaCreditoService';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para agregar token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface CompraItem {
  producto_id: number;
  sku: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  aplica_serie: boolean;
  series?: string[];
  tipo_item?: 'producto' | 'repuesto'; // Nuevo campo para diferenciar tipo
}

export interface CompraData {
  fecha_compra: string;
  proveedor_id?: number; // ID del proveedor si viene de la tabla
  proveedor_nombre: string;
  proveedor_telefono?: string;
  proveedor_nit?: string;
  proveedor_direccion?: string;
  items: CompraItem[];
  notas?: string;
  estado?: 'BORRADOR' | 'CONFIRMADA' | 'RECIBIDA' | 'CANCELADA';
  metodo_pago?: 'efectivo' | 'transferencia' | 'tarjeta_credito';
  tarjeta_id?: number;
  cuenta_id?: number;
}

export interface CuentaPago {
  id: number;
  nombre: string;
  tipo_cuenta?: string;
  saldo_actual: number;
  activa: boolean;
}

export interface FuentesPago {
  saldo_caja: number;
  cuentas: CuentaPago[];
  tarjetas: TarjetaCredito[];
}

// Crear compra de PRODUCTOS
export const createCompraProductos = async (compraData: CompraData) => {
  const response = await api.post('/compras/productos', compraData);
  return response.data;
};

// Crear compra de REPUESTOS
export const createCompraRepuestos = async (compraData: CompraData) => {
  const response = await api.post('/compras/repuestos', compraData);
  return response.data;
};

// Crear compra (deprecado - mantener por compatibilidad)
export const createCompra = async (compraData: CompraData) => {
  const response = await api.post('/compras', compraData);
  return response.data;
};

// Obtener caja, cuentas y tarjetas disponibles para compras
export const getFuentesPago = async (): Promise<FuentesPago> => {
  const response = await api.get('/compras/fuentes-pago');
  return response.data.data;
};

// Obtener todas las compras
export const getAllCompras = async (params?: {
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  proveedor?: string;
  page?: number;
  limit?: number;
}) => {
  const response = await api.get('/compras', { params });
  return response.data;
};

// Obtener compra por ID
export const getCompraById = async (id: number) => {
  const response = await api.get(`/compras/${id}`);
  return response.data;
};

// Obtener series de un producto
export const getSeriesByProducto = async (productoId: number, estado?: string) => {
  const response = await api.get(`/compras/series/producto/${productoId}`, {
    params: { estado }
  });
  return response.data;
};

// Anular una compra (revierte el stock)
export const anularCompra = async (id: number, motivo: string) => {
  const response = await api.post(`/compras/${id}/anular`, { motivo });
  return response.data;
};
