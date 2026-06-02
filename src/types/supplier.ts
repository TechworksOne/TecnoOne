export interface Supplier {
  id: string;
  nombre: string;
  contacto?: string; // Persona de contacto
  telefono: string;
  email?: string;
  direccion?: string;
  nit?: string;
  empresa?: string;
  sitio_web?: string;
  notas?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  totalCompras?: number;
  ultimaCompra?: string;
}

export interface SupplierPurchase {
  id: string;
  numero_compra: string;
  fecha_compra: string;
  subtotal: number;
  impuestos: number;
  total: number;
  total_items: number;
  estado: 'BORRADOR' | 'CONFIRMADA' | 'RECIBIDA' | 'CANCELADA';
  usuario_nombre?: string;
  notas?: string;
  created_at: string;
}
