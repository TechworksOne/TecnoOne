// ======================================================
// Tipos para el sistema de Ventas desde Cotización
// ======================================================

export type PaymentMethod =
  | 'EFECTIVO'
  | 'TRANSFERENCIA'
  | 'TARJETA'          // legado — mantener compatibilidad con registros existentes
  | 'TARJETA_BAC'
  | 'TARJETA_NEONET'
  | 'TARJETA_OTRA'
  | 'MIXTO';
export type SaleStatus = 'PENDIENTE' | 'PAGADA' | 'ANULADA';
export type SaleItemSource = 'PRODUCTO' | 'REPUESTO';

export interface SaleItem {
  refId: string;
  source: SaleItemSource;
  nombre: string;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
}

export interface Payment {
  metodo: PaymentMethod;
  monto: number;
  referencia?: string; // #voucher / últimos 4 tarjeta
  comprobanteUrl?: string; // imagen transferencia (preview local)
  fecha: string; // ISO
}

export interface SaleCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  nit?: string;
  address?: string;
}

export interface Sale {
  id: string;
  numero: string; // V001, V002, etc.
  quoteId: string; // origen
  cliente: SaleCustomer;
  items: SaleItem[];
  subtotal: number;
  impuestos?: number; // opcional: si tu catálogo maneja toggle por línea
  total: number;
  payments: Payment[];
  estado: SaleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SaleSummary {
  totalSales: number;
  totalRevenue: number;
  averageOrderValue: number;
  todaySales: number;
  monthSales: number;
}
