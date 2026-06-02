export type QuoteType = 'VENTA' | 'REPARACION';
export type QuoteStatus = 'ABIERTA' | 'CERRADA' | 'PERDIDA' | 'REPARANDO';
export type QuoteItemSource = 'PRODUCTO' | 'REPUESTO';

export interface QuoteCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  nit?: string;
  address?: string;
}

export interface QuoteItem {
  id?: string;
  source: QuoteItemSource;
  refId: string;
  nombre: string;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
  notas?: string;
  aplicarImpuestos?: boolean;
}

export interface Quote {
  id: string;
  tipo: QuoteType;
  cliente: QuoteCustomer;
  vigenciaDias: number;
  items: QuoteItem[];
  manoDeObra?: number;
  subtotal: number;
  impuestos?: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  estado: QuoteStatus;
  aplicarImpuestos?: boolean;
  observaciones?: string;
  numero?: string; // Número de cotización para impresión
  repairId?: string; // ID de la reparación vinculada (cuando se convierte)
}

// Legacy types for backwards compatibility
export interface QuoteItemLegacy {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

export interface QuoteLegacy {
  id: string;
  customerName: string;
  validDays: number;
  date: string;
  items: QuoteItemLegacy[];
  total: number;
  status: "open" | "won" | "lost";
}
