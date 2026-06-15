import { create } from 'zustand';
import { Customer, CustomerPurchase, CustomerSummary, CustomerVisit } from '../types/customer';
import { Quote } from '../types/quote';
import * as customerService from '../services/customerService';

interface CustomerStore {
  customers: Customer[];
  visits: CustomerVisit[];
  isLoading: boolean;
  loadCustomers: (params?: { search?: string; limit?: number }) => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalVisits' | 'customerSince' | 'loyaltyPoints'>) => Promise<void>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  getCustomerById: (id: string) => Customer | undefined;
  getCustomerPurchases: (customerId: string) => CustomerPurchase[];
  loadCustomerPurchases: (customerId: string) => Promise<CustomerPurchase[]>;
  getCustomerVisits: (customerId: string) => CustomerVisit[];
  getCustomerSummary: (customerId: string) => CustomerSummary;
  searchCustomers: (query: string) => Customer[];
  addVisit: (visit: Omit<CustomerVisit, 'id'>) => void;
  getLoyaltyLevel: (totalSpent: number, totalVisits: number) => "Nuevo" | "Regular" | "Frecuente" | "VIP";
}

export const useCustomers = create<CustomerStore>((set, get) => ({
  customers: [],
  visits: [],
  isLoading: false,

  loadCustomers: async (params) => {
    set({ isLoading: true });
    try {
      const response = params
        ? await customerService.searchCustomers(params.search ?? '', params.limit ?? 5)
        : await customerService.getAllCustomers();
      if (response.success) {
        // Mapear de BD a formato frontend
        const mappedCustomers = response.data.map((c: any) => {
          const nombreCompleto = [c.nombre, c.apellido]
            .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
          return {
          id: c.id.toString(),
          firstName: c.nombre || '',
          lastName: c.apellido || '',
          name: nombreCompleto || c.nombre || '',
          nombre_completo: nombreCompleto || c.nombre || '',
          phone: c.telefono || '',
          nit: c.nit || '',
          email: c.email || '',
          address: c.direccion || '',
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          // Estadísticas precargadas desde el backend
          totalVisits: Number(c.total_ventas) || 0,
          totalSpentPreloaded: (Number(c.total_gastado) || 0) / 100,
          totalCotizaciones: Number(c.total_cotizaciones) || 0,
          customerSince: c.created_at,
          loyaltyPoints: 0,
          preferredPaymentMethod: c.metodo_pago_preferido || 'efectivo',
          notes: c.notas || '',
          // Campos de BD
          nombre: c.nombre,
          apellido: c.apellido,
          telefono: c.telefono,
          correo: c.email,
          metodo_pago_preferido: c.metodo_pago_preferido
          };
        });
        set({ customers: mappedCustomers, isLoading: false });
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      set({ isLoading: false });
    }
  },

  addCustomer: async (customerData) => {
    try {
      const dataToSend = {
        nombre: customerData.firstName,
        apellido: customerData.lastName,
        telefono: customerData.phone,
        nit: customerData.nit || null,
        email: customerData.email || null,
        direccion: customerData.address || null,
        metodo_pago_preferido: customerData.preferredPaymentMethod || 'efectivo',
        notas: customerData.notes || null
      };
      
      console.log('📤 Enviando cliente:', dataToSend);
      
      const response = await customerService.createCustomer(dataToSend);
      
      console.log('✅ Respuesta del servidor:', response);
      
      if (response.success) {
        // Recargar clientes
        await get().loadCustomers();
      }
    } catch (error: any) {
      console.error('❌ Error completo:', error.response?.data || error);
      throw error;
    }
  },

  updateCustomer: async (id, data) => {
    try {
      const updateData: any = {};
      if (data.firstName) updateData.nombre = data.firstName;
      if (data.lastName) updateData.apellido = data.lastName;
      if (data.phone) updateData.telefono = data.phone;
      if (data.nit) updateData.nit = data.nit;
      if (data.email) updateData.email = data.email;
      if (data.address) updateData.direccion = data.address;
      if (data.preferredPaymentMethod) updateData.metodo_pago_preferido = data.preferredPaymentMethod;
      if (data.notes !== undefined) updateData.notas = data.notes;

      const response = await customerService.updateCustomer(id, updateData);
      
      if (response.success) {
        // Recargar clientes
        await get().loadCustomers();
      }
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
      throw error;
    }
  },

  deleteCustomer: async (id) => {
    try {
      const response = await customerService.deleteCustomer(id);
      if (response.success) {
        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
        }));
      }
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      throw error;
    }
  },

  getCustomerById: (id) => {
    return get().customers.find((customer) => customer.id === id);
  },

  getCustomerVisits: (customerId) => {
    return get().visits.filter((visit) => visit.customerId === customerId)
      .sort((a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime());
  },

  getCustomerPurchases: (customerId) => {
    // Función sincrónica que retorna las compras cacheadas si existen
    // Para uso en el modal, llamar loadCustomerPurchases primero
    const customer = get().customers.find(c => c.id === customerId);
    return (customer as any)?.purchases || [];
  },

  // Nueva función para cargar compras desde API
  loadCustomerPurchases: async (customerId: string) => {
    try {
      const response = await customerService.getCustomerPurchases(customerId);
      if (response.success) {
        // Cachear las compras en el objeto customer
        set((state) => ({
          customers: state.customers.map(c => 
            c.id === customerId 
              ? { ...c, purchases: response.data } 
              : c
          )
        }));
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error al cargar compras del cliente:', error);
      return [];
    }
  },

  getLoyaltyLevel: (totalSpent, totalVisits) => {
    if (totalSpent >= 5000 || totalVisits >= 20) return "VIP";
    if (totalSpent >= 2000 || totalVisits >= 10) return "Frecuente";
    if (totalSpent >= 500 || totalVisits >= 5) return "Regular";
    return "Nuevo";
  },

  getCustomerSummary: (customerId) => {
    const customer = get().getCustomerById(customerId);
    const purchases = get().getCustomerPurchases(customerId);
    
    if (!customer) return {
      totalQuotes: 0,
      totalSales: 0,
      totalSpent: 0,
      activeQuotes: 0,
      averageOrderValue: 0,
      totalVisits: 0,
      loyaltyLevel: "Nuevo" as const,
      monthlyPurchases: 0,
      favoriteProducts: [],
    };

    // Si hay compras cargadas en detalle, calcular desde ellas
    // Si no, usar los valores precargados del backend (para las tarjetas de la lista)
    const hasLoadedPurchases = purchases.length > 0;
    const customerAny = customer as any;

    let totalSpent: number;
    let totalQuotes: number;
    let totalVisitsCount: number;
    let activeQuotes: number;
    let averageOrderValue: number;
    let monthlyPurchases: number;
    let favoriteProducts: string[];

    if (hasLoadedPurchases) {
      const quotes = purchases.filter((p) => p.type === 'quote');
      const REPAIR_EXCLUDED = ['CANCELADA'];
      const SALE_INCLUDED = ['PAGADA', 'PARCIAL', 'won', 'completed'];
      const completedPurchases = purchases.filter((p) =>
        p.type === 'repair'
          ? !REPAIR_EXCLUDED.includes(p.status)
          : SALE_INCLUDED.includes(p.status)
      );
      totalSpent = completedPurchases.reduce((sum, p) => sum + (p.total || 0), 0);
      totalQuotes = customerAny.totalCotizaciones || quotes.length;
      activeQuotes = quotes.filter((q) => q.status === 'open').length;
      averageOrderValue = completedPurchases.length > 0 ? totalSpent / completedPurchases.length : 0;

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      monthlyPurchases = purchases.filter(p => new Date(p.date) >= lastMonth).length;

      const productCounts: Record<string, number> = {};
      purchases.forEach(purchase => {
        if (purchase.products && Array.isArray(purchase.products)) {
          purchase.products.forEach(product => {
            if (product.name) {
              productCounts[product.name] = (productCounts[product.name] || 0) + (product.quantity || 1);
            }
          });
        }
      });
      favoriteProducts = Object.entries(productCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([product]) => product);

      totalVisitsCount = customer.totalVisits || purchases.length;
    } else {
      // Usar datos precargados del backend (sin cargar detalle)
      totalSpent = customerAny.totalSpentPreloaded || 0;
      totalQuotes = customerAny.totalCotizaciones || 0;
      totalVisitsCount = customer.totalVisits || 0;
      activeQuotes = 0;
      averageOrderValue = totalVisitsCount > 0 ? totalSpent / totalVisitsCount : 0;
      monthlyPurchases = 0;
      favoriteProducts = [];
    }

    const lastPurchase = hasLoadedPurchases && purchases.length > 0
      ? purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
      : undefined;

    const loyaltyLevel = get().getLoyaltyLevel(totalSpent, totalVisitsCount);

    return {
      totalQuotes,
      totalSales: hasLoadedPurchases ? purchases.filter(p => p.type !== 'quote').length : totalVisitsCount,
      totalSpent,
      lastPurchase,
      activeQuotes,
      averageOrderValue,
      totalVisits: totalVisitsCount,
      loyaltyLevel,
      monthlyPurchases,
      favoriteProducts,
    };
  },

  searchCustomers: (query) => {
    const customers = get().customers;
    if (!query.trim()) return customers;

    const searchTerm = query.toLowerCase();
    return customers.filter(
      (customer) =>
        customer.firstName.toLowerCase().includes(searchTerm) ||
        customer.lastName.toLowerCase().includes(searchTerm) ||
        customer.phone.includes(searchTerm) ||
        customer.nit?.toLowerCase().includes(searchTerm) ||
        customer.email?.toLowerCase().includes(searchTerm)
    );
  },

  addVisit: (visitData) => {
    const newVisit: CustomerVisit = {
      ...visitData,
      id: Date.now().toString(),
    };
    
    set((state) => ({
      visits: [...state.visits, newVisit],
    }));

    // Incrementar contador de visitas del cliente
    const customer = get().getCustomerById(visitData.customerId);
    if (customer) {
      get().updateCustomer(visitData.customerId, {
        totalVisits: customer.totalVisits + 1,
        lastVisit: visitData.date,
      });
    }
  },
}));
