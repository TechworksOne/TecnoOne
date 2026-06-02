export interface Repuesto {
  id: string;
  sku?: string;                  // SKU generado automáticamente
  codigo?: string;               // Código opcional manual
  nombre: string;                // p.ej. "Pantalla iPhone 12 Pro Max Original"
  tipo: string;
  marca: string;
  linea?: string;                // iPhone 12 / Galaxy S23 / etc.
  modelo?: string;               // A2407 / SM-S911B / etc. (opcional)
  compatibilidad?: string[];     // lista de modelos compatibles
  condicion: 'Original' | 'OEM' | 'Genérico' | 'Usado';
  color?: string;
  notas?: string;
  precio: number;                // Q - Precio público de venta
  precioCosto: number;           // Q - Precio que nos costó (nuevo campo)
  proveedor?: string;            // Nombre del proveedor (nuevo campo)
  stock: number;                 // unidades
  stockMinimo?: number;
  imagenes: string[];            // URLs locales/mock
  tags?: string[];               // "OLED", "Incell", "Amoled", etc.
  activo: boolean;
  createdAt: string; 
  updatedAt: string;
}

export interface RepuestoFilters {
  searchTerm?: string;
  tipo?: string;
  marca?: string;
  linea?: string;
  soloConStock?: boolean;
  precioMin?: number;
  precioMax?: number;
}

export interface RepuestoFormData {
  nombre: string;
  tipo: Repuesto['tipo'];
  marca: Repuesto['marca'];
  linea?: string;
  modelo?: string;
  compatibilidad?: string[];
  condicion: Repuesto['condicion'];
  color?: string;
  notas?: string;
  precio: number;                // Precio público
  precioCosto: number;           // Precio de costo (nuevo campo)
  proveedor?: string;            // Proveedor (nuevo campo)
  stock: number;
  stockMinimo?: number;
  imagenes: string[];
  tags?: string[];
  activo: boolean;
}

export interface RepuestoSeleccionado {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
}

// Datos para selects dependientes
export const MARCAS_LINEAS = {
  Apple: [
    'iPhone SE', 'iPhone 7', 'iPhone 8', 'iPhone X', 'iPhone XR', 'iPhone XS',
    'iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15',
    'iPad', 'MacBook', 'iMac', 'Apple Watch'
  ],
  Samsung: [
    'Galaxy A', 'Galaxy S20', 'Galaxy S21', 'Galaxy S22', 'Galaxy S23', 'Galaxy S24',
    'Galaxy Note', 'Galaxy Z Flip', 'Galaxy Z Fold', 'Galaxy Tab'
  ],
  Xiaomi: [
    'Redmi Note', 'Mi 11', 'Mi 12', 'Mi 13', 'POCO X', 'POCO F', 'Redmi'
  ],
  Motorola: [
    'Moto G', 'Moto E', 'Edge', 'One', 'Razr'
  ],
  Huawei: [
    'P Series', 'Mate Series', 'Nova', 'Y Series', 'Honor'
  ],
  Otra: []
} as const;