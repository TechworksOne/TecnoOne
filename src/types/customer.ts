export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  nit?: string;
  email?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  totalVisits: number;
  lastVisit?: string;
  customerSince: string;
  loyaltyPoints: number;
  preferredPaymentMethod?: "efectivo" | "tarjeta" | "transferencia";
  notes?: string;
  // Campos de la BD
  nombre?: string;
  apellido?: string;
  telefono?: string;
  correo?: string;
  frecuente?: boolean;
  reparacionesAnteriores?: number;
  ultimaReparacion?: string;
}

export interface CustomerVisit {
  id: string;
  customerId: string;
  date: string;
  time: string;
  type: "quote" | "purchase" | "inquiry" | "visit";
  description: string;
  amount?: number;
  products?: string[];
}

export interface CustomerPurchase {
  id: string;
  type: "quote" | "sale";
  date: string;
  total: number;
  items: number;
  status?: "open" | "won" | "lost" | "completed";
  reference?: string;
  paymentMethod?: string;
  discount?: number;
  products: {
    name: string;
    quantity: number;
    price: number;
  }[];
}

export interface CustomerSummary {
  totalQuotes: number;
  totalSales: number;
  totalSpent: number;
  lastPurchase?: string;
  activeQuotes: number;
  averageOrderValue: number;
  totalVisits: number;
  loyaltyLevel: "Nuevo" | "Regular" | "Frecuente" | "VIP";
  monthlyPurchases: number;
  favoriteProducts: string[];
}