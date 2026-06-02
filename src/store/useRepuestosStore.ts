import { create } from 'zustand';
import { Repuesto, RepuestoFilters, RepuestoFormData } from '../types/repuesto';
import * as repuestoService from '../services/repuestoService';

interface RepuestosState {
  repuestos: Repuesto[];
  filteredRepuestos: Repuesto[];
  filters: RepuestoFilters;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadRepuestos: () => Promise<void>;
  setRepuestos: (repuestos: Repuesto[]) => void;
  upsertRepuesto: (repuesto: RepuestoFormData, id?: string) => void;
  removeRepuesto: (id: string) => void;
  duplicateRepuesto: (id: string) => Repuesto | undefined;
  setFilters: (filters: Partial<RepuestoFilters>) => void;
  clearFilters: () => void;
  getRepuestoById: (id: string) => Repuesto | undefined;
  applyFilters: () => void;
}

export const useRepuestosStore = create<RepuestosState>((set, get) => ({
  repuestos: [],
  filteredRepuestos: [],
  filters: {},
  isLoading: false,
  error: null,

  loadRepuestos: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await repuestoService.getAllRepuestos({ limit: 500 });
      
      // Mapear datos de BD a formato frontend
      const repuestosMapped: Repuesto[] = data.map(rep => ({
        id: rep.id!.toString(),
        sku: rep.sku,
        codigo: rep.codigo,
        nombre: rep.nombre,
        tipo: rep.tipo,
        marca: rep.marca,
        linea: rep.linea || '',
        modelo: rep.modelo || '',
        compatibilidad: rep.compatibilidad || [],
        condicion: rep.condicion,
        color: rep.color || '',
        notas: rep.notas || '',
        precio: repuestoService.centavosAQuetzales(rep.precio_publico ?? 0),
        precioCosto: repuestoService.centavosAQuetzales(rep.precio_costo ?? 0),
        proveedor: rep.proveedor || '',
        stock: rep.stock ?? 0,
        stockMinimo: rep.stock_minimo ?? 1,
        imagenes: rep.imagenes || [],
        tags: rep.tags || [],
        activo: rep.activo !== false,
        createdAt: rep.created_at || new Date().toISOString(),
        updatedAt: rep.updated_at || new Date().toISOString()
      }));
      
      set({ repuestos: repuestosMapped, filteredRepuestos: repuestosMapped, isLoading: false });
      get().applyFilters();
    } catch (error: any) {
      console.error('Error al cargar repuestos:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  setRepuestos: (repuestos) => {
    set({ repuestos, filteredRepuestos: repuestos });
  },

  upsertRepuesto: (repuestoData, id) => {
    const now = new Date().toISOString();
    
    if (id) {
      // Actualizar existente
      set((state) => {
        const updatedRepuestos = state.repuestos.map(rep => 
          rep.id === id 
            ? { ...rep, ...repuestoData, updatedAt: now }
            : rep
        );
        return {
          repuestos: updatedRepuestos,
          filteredRepuestos: updatedRepuestos
        };
      });
    } else {
      // Verificar posibles duplicados antes de crear
      const { repuestos } = get();
      const posibleDuplicado = repuestos.find(rep => 
        rep.nombre.toLowerCase().trim() === repuestoData.nombre.toLowerCase().trim() &&
        rep.marca === repuestoData.marca &&
        rep.linea === repuestoData.linea &&
        rep.modelo === repuestoData.modelo
      );

      // Si hay un posible duplicado, aún permitir la creación (el usuario ya confirmaría en UI)
      const newRepuesto: Repuesto = {
        ...repuestoData,
        // Normalizar strings
        nombre: repuestoData.nombre.trim(),
        color: repuestoData.color?.trim() || '',
        notas: repuestoData.notas?.trim() || '',
        modelo: repuestoData.modelo?.trim() || '',
        linea: repuestoData.linea?.trim() || '',
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now
      };
      
      set((state) => {
        const updatedRepuestos = [...state.repuestos, newRepuesto];
        return {
          repuestos: updatedRepuestos,
          filteredRepuestos: updatedRepuestos
        };
      });
    }
    
    // Reaplicar filtros después de modificar
    get().applyFilters();
  },

  removeRepuesto: (id) => {
    set((state) => {
      const filteredRepuestos = state.repuestos.filter(rep => rep.id !== id);
      return {
        repuestos: filteredRepuestos,
        filteredRepuestos: filteredRepuestos
      };
    });
    get().applyFilters();
  },

  duplicateRepuesto: (id) => {
    const original = get().repuestos.find(rep => rep.id === id);
    if (original) {
      const now = new Date().toISOString();
      const duplicated: Repuesto = {
        ...original,
        id: Date.now().toString(),
        nombre: `${original.nombre} (Copia)`,
        createdAt: now,
        updatedAt: now
      };
      
      set((state) => {
        const updatedRepuestos = [...state.repuestos, duplicated];
        return {
          repuestos: updatedRepuestos,
          filteredRepuestos: updatedRepuestos
        };
      });
      get().applyFilters();
      return duplicated;
    }
    return undefined;
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    }));
    get().applyFilters();
  },

  clearFilters: () => {
    set({ filters: {} });
    get().applyFilters();
  },

  getRepuestoById: (id) => {
    return get().repuestos.find(rep => rep.id === id);
  },

  applyFilters: () => {
    const { repuestos, filters } = get();
    
    // Comenzar con todos los repuestos (NO filtrar por activo aquí)
    let filtered = [...repuestos];

    // Filtro de búsqueda (nombre, modelo, compatibilidad, tags)
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(rep => 
        rep.nombre.toLowerCase().includes(term) ||
        rep.modelo?.toLowerCase().includes(term) ||
        rep.compatibilidad?.some(comp => comp.toLowerCase().includes(term)) ||
        rep.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Filtro por tipo
    if (filters.tipo) {
      filtered = filtered.filter(rep => rep.tipo === filters.tipo);
    }

    // Filtro por marca
    if (filters.marca) {
      filtered = filtered.filter(rep => rep.marca === filters.marca);
    }

    // Filtro por línea
    if (filters.linea) {
      filtered = filtered.filter(rep => rep.linea === filters.linea);
    }

    // Filtro solo con stock
    if (filters.soloConStock) {
      filtered = filtered.filter(rep => rep.stock > 0);
    }

    // Filtro por rango de precio
    if (filters.precioMin !== undefined) {
      filtered = filtered.filter(rep => rep.precio >= filters.precioMin!);
    }
    if (filters.precioMax !== undefined) {
      filtered = filtered.filter(rep => rep.precio <= filters.precioMax!);
    }

    set({ filteredRepuestos: filtered });
  }
}));