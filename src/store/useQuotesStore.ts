import { create } from 'zustand';
import { Quote, QuoteItem, QuoteType, QuoteStatus } from '../types/quote';
import * as cotizacionService from '../services/cotizacionService';

interface QuotesState {
  quotes: Quote[];
  isLoading: boolean;
  loadQuotes: () => Promise<void>;
  upsertQuote: (quote: Omit<Quote, 'id' | 'createdAt' | 'updatedAt' | 'numero'>, id?: string) => Quote;
  removeQuote: (id: string) => void;
  getQuoteById: (id: string) => Quote | undefined;
  updateQuoteStatus: (id: string, estado: QuoteStatus) => void;
}

export const useQuotesStore = create<QuotesState>((set, get) => ({
  quotes: [],
  isLoading: false,

  loadQuotes: async () => {
    set({ isLoading: true });
    try {
      const response = await cotizacionService.getAllCotizaciones({ limit: 100 });
      
      if (response.success) {
        // Mapear cotizaciones de BD a formato frontend
        const mappedQuotes: Quote[] = response.data.map((cot: any) => ({
          id: cot.id.toString(),
          numero: cot.numero_cotizacion,
          tipo: cot.tipo as QuoteType,
          cliente: {
            id: cot.cliente_id.toString(),
            name: cot.cliente_nombre,
            phone: cot.cliente_telefono || '',
            email: cot.cliente_email || '',
            nit: cot.cliente_nit || '',
            address: cot.cliente_direccion || '',
          },
          vigenciaDias: cot.vigencia_dias,
          items: typeof cot.items === 'string' ? JSON.parse(cot.items) : (Array.isArray(cot.items) ? cot.items : []),
          manoDeObra: cot.mano_de_obra || 0,
          subtotal: parseFloat(cot.subtotal),
          impuestos: parseFloat(cot.impuestos),
          total: parseFloat(cot.total),
          estado: mapEstadoBDtoFrontend(cot.estado),
          aplicarImpuestos: cot.aplicar_impuestos,
          observaciones: cot.observaciones || '',
          createdAt: cot.created_at,
          updatedAt: cot.updated_at,
        }));
        
        set({ quotes: mappedQuotes, isLoading: false });
      }
    } catch (error) {
      console.error('Error al cargar cotizaciones:', error);
      set({ isLoading: false });
    }
  },

  upsertQuote: (quoteData, id) => {
    const now = new Date().toISOString();
    
    if (id) {
      // Actualizar existente
      const updatedQuote = {
        ...quoteData,
        id,
        updatedAt: now,
        createdAt: get().quotes.find(q => q.id === id)?.createdAt || now,
        numero: get().quotes.find(q => q.id === id)?.numero || `COT-${new Date().getFullYear()}-${String(get().quotes.length + 1).padStart(3, '0')}`,
      } as Quote;

      set((state) => ({
        quotes: state.quotes.map(q => q.id === id ? updatedQuote : q),
      }));
      
      return updatedQuote;
    } else {
      // Crear nuevo
      const newQuote: Quote = {
        ...quoteData,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        numero: `COT-${new Date().getFullYear()}-${String(get().quotes.length + 1).padStart(3, '0')}`,
        createdAt: now,
        updatedAt: now,
      };
      
      set((state) => ({
        quotes: [newQuote, ...state.quotes],
      }));
      
      return newQuote;
    }
  },

  removeQuote: (id) => {
    set((state) => ({
      quotes: state.quotes.filter(q => q.id !== id),
    }));
  },

  getQuoteById: (id) => {
    return get().quotes.find(q => q.id === id);
  },

  updateQuoteStatus: (id, estado) => {
    set((state) => ({
      quotes: state.quotes.map(q => 
        q.id === id 
          ? { ...q, estado, updatedAt: new Date().toISOString() }
          : q
      ),
    }));
  },
}));

// Función helper para mapear estados de BD a frontend
function mapEstadoBDtoFrontend(estadoBD: string): QuoteStatus {
  const mapping: Record<string, QuoteStatus> = {
    'BORRADOR': 'ABIERTA',
    'ENVIADA': 'ABIERTA',
    'APROBADA': 'ABIERTA',
    'RECHAZADA': 'PERDIDA',
    'VENCIDA': 'PERDIDA',
    'CONVERTIDA': 'CERRADA',
  };
  return mapping[estadoBD] || 'ABIERTA';
}
