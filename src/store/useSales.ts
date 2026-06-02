import { create } from 'zustand';
import { Sale, SaleStatus } from '../types/sale';
import * as ventaService from '../services/ventaService';

interface SalesState {
  sales: Sale[];
  loading: boolean;
  loadSales: () => Promise<void>;
  upsertSale: (sale: Omit<Sale, 'id' | 'numero' | 'createdAt' | 'updatedAt'>, id?: string) => Sale;
  removeSale: (id: string) => void;
  getSaleById: (id: string) => Sale | undefined;
  updateSaleStatus: (id: string, estado: SaleStatus) => void;
  getTodaySales: () => Sale[];
  getCompletedSales: () => Sale[];
  getTotalRevenue: () => number;
}

export const useSales = create<SalesState>((set, get) => ({
  sales: [],
  loading: false,

  loadSales: async () => {
    set({ loading: true });
    try {
      const ventasData = await ventaService.getAllVentas();
      
      // Mapear ventas del backend al formato del frontend
      const salesMapped: Sale[] = ventasData.map((venta): Sale => ({
        id: venta.id?.toString() || '',
        numero: venta.numero_venta || '',
        cliente: {
          id: venta.cliente_id.toString(),
          name: venta.cliente_nombre,
          phone: venta.cliente_telefono || '',
          email: venta.cliente_email || '',
          nit: venta.cliente_nit || '',
          address: venta.cliente_direccion || ''
        },
        items: venta.items.map(item => ({
          id: item.id,
          source: item.source,
          refId: item.refId,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precioUnit: ventaService.centavosAQuetzales(item.precioUnit || item.precio || item.precioUnitario || 0),
          subtotal: ventaService.centavosAQuetzales(item.subtotal)
        })),
        subtotal: ventaService.centavosAQuetzales(venta.subtotal),
        impuestos: ventaService.centavosAQuetzales(venta.impuestos || 0),
        descuento: ventaService.centavosAQuetzales(venta.descuento || 0),
        total: ventaService.centavosAQuetzales(venta.total),
        estado: venta.estado as SaleStatus || 'PENDIENTE',
        payments: (venta.pagos || []).map(pago => ({
          metodo: pago.metodo,
          monto: ventaService.centavosAQuetzales(pago.monto),
          referencia: pago.referencia,
          fecha: pago.fecha || venta.fecha_venta || venta.created_at || new Date().toISOString()
        })),
        observaciones: venta.observaciones,
        createdAt: venta.fecha_venta || venta.created_at || new Date().toISOString(),
        updatedAt: venta.updated_at || venta.created_at || new Date().toISOString()
      }));
      
      set({ sales: salesMapped, loading: false });
    } catch (error) {
      console.error('Error al cargar ventas:', error);
      set({ loading: false });
    }
  },

  upsertSale: (saleData, id) => {
    const now = new Date().toISOString();
    
    if (id) {
      // Actualizar existente
      const updatedSale = {
        ...saleData,
        id,
        updatedAt: now,
        createdAt: get().sales.find(s => s.id === id)?.createdAt || now,
        numero: get().sales.find(s => s.id === id)?.numero || `V${String(get().sales.length + 1).padStart(3, '0')}`,
      } as Sale;

      set((state) => ({
        sales: state.sales.map(s => s.id === id ? updatedSale : s),
      }));
      
      return updatedSale;
    } else {
      // Crear nuevo
      const newSale: Sale = {
        ...saleData,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        numero: `V${String(get().sales.length + 1).padStart(3, '0')}`,
        createdAt: now,
        updatedAt: now,
      };
      
      set((state) => ({
        sales: [newSale, ...state.sales],
      }));
      
      return newSale;
    }
  },

  removeSale: (id) => {
    set((state) => ({
      sales: state.sales.filter(s => s.id !== id),
    }));
  },

  getSaleById: (id) => {
    return get().sales.find(s => s.id === id);
  },

  updateSaleStatus: (id, estado) => {
    set((state) => ({
      sales: state.sales.map(s => 
        s.id === id 
          ? { ...s, estado, updatedAt: new Date().toISOString() }
          : s
      ),
    }));
  },

  getTodaySales: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    return get().sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      saleDate.setHours(0, 0, 0, 0); // Normalizar a medianoche
      
      return saleDate.getTime() === today.getTime() && s.estado === 'PAGADA';
    });
  },

  getCompletedSales: () => {
    return get().sales.filter(s => s.estado === 'PAGADA');
  },

  getTotalRevenue: () => {
    return get().sales
      .filter(s => s.estado === 'PAGADA')
      .reduce((sum, sale) => sum + sale.total, 0);
  },
}));