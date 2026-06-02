import { create } from 'zustand';
import { Supplier, SupplierPurchase } from '../types/supplier';
import * as supplierService from '../services/supplierService';

interface SuppliersState {
  suppliers: Supplier[];
  selectedSupplier: Supplier | null;
  supplierPurchases: SupplierPurchase[];
  isLoading: boolean;
  loadSuppliers: (params?: { search?: string; activo?: boolean }) => Promise<void>;
  getSupplierById: (id: string) => Promise<void>;
  getSupplierPurchases: (id: string) => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  setSelectedSupplier: (supplier: Supplier | null) => void;
  clearSelectedSupplier: () => void;
}

export const useSuppliersStore = create<SuppliersState>((set, get) => ({
  suppliers: [],
  selectedSupplier: null,
  supplierPurchases: [],
  isLoading: false,

  loadSuppliers: async (params) => {
    set({ isLoading: true });
    try {
      const response = await supplierService.getAllSuppliers(params);
      if (response.success) {
        const mappedSuppliers = response.data.map((s: any) => ({
          id: s.id.toString(),
          nombre: s.nombre,
          contacto: s.contacto,
          telefono: s.telefono,
          email: s.email,
          direccion: s.direccion,
          nit: s.nit,
          empresa: s.empresa,
          sitio_web: s.sitio_web,
          notas: s.notas,
          activo: s.activo === 1 || s.activo === true,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          totalCompras: s.total_compras || 0,
          ultimaCompra: s.ultima_compra,
        }));
        set({ suppliers: mappedSuppliers, isLoading: false });
      }
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      set({ isLoading: false });
    }
  },

  getSupplierById: async (id) => {
    set({ isLoading: true });
    try {
      const response = await supplierService.getSupplierById(id);
      if (response.success) {
        const supplier = {
          id: response.data.id.toString(),
          nombre: response.data.nombre,
          contacto: response.data.contacto,
          telefono: response.data.telefono,
          email: response.data.email,
          direccion: response.data.direccion,
          nit: response.data.nit,
          empresa: response.data.empresa,
          sitio_web: response.data.sitio_web,
          notas: response.data.notas,
          activo: response.data.activo === 1 || response.data.activo === true,
          createdAt: response.data.created_at,
          updatedAt: response.data.updated_at,
          totalCompras: response.data.total_compras || 0,
          ultimaCompra: response.data.ultima_compra,
        };
        set({ selectedSupplier: supplier, isLoading: false });
      }
    } catch (error) {
      console.error('Error al obtener proveedor:', error);
      set({ isLoading: false });
    }
  },

  getSupplierPurchases: async (id) => {
    try {
      const response = await supplierService.getSupplierPurchases(id);
      if (response.success) {
        set({ supplierPurchases: response.data });
      }
    } catch (error) {
      console.error('Error al cargar compras del proveedor:', error);
    }
  },

  addSupplier: async (supplier) => {
    try {
      const supplierData = {
        nombre: supplier.nombre,
        contacto: supplier.contacto,
        telefono: supplier.telefono,
        email: supplier.email,
        direccion: supplier.direccion,
        nit: supplier.nit,
        empresa: supplier.empresa,
        sitio_web: supplier.sitio_web,
        notas: supplier.notas,
        activo: supplier.activo !== false,
      };

      const response = await supplierService.createSupplier(supplierData);
      
      if (response.success) {
        await get().loadSuppliers();
      }
    } catch (error) {
      console.error('Error al crear proveedor:', error);
      throw error;
    }
  },

  updateSupplier: async (id, updates) => {
    try {
      const supplierData: any = {};
      if (updates.nombre !== undefined) supplierData.nombre = updates.nombre;
      if (updates.contacto !== undefined) supplierData.contacto = updates.contacto;
      if (updates.telefono !== undefined) supplierData.telefono = updates.telefono;
      if (updates.email !== undefined) supplierData.email = updates.email;
      if (updates.direccion !== undefined) supplierData.direccion = updates.direccion;
      if (updates.nit !== undefined) supplierData.nit = updates.nit;
      if (updates.empresa !== undefined) supplierData.empresa = updates.empresa;
      if (updates.sitio_web !== undefined) supplierData.sitio_web = updates.sitio_web;
      if (updates.notas !== undefined) supplierData.notas = updates.notas;
      if (updates.activo !== undefined) supplierData.activo = updates.activo;

      const response = await supplierService.updateSupplier(id, supplierData);
      
      if (response.success) {
        set((state) => ({
          suppliers: state.suppliers.map((s) => 
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      }
    } catch (error) {
      console.error('Error al actualizar proveedor:', error);
      throw error;
    }
  },

  deleteSupplier: async (id) => {
    try {
      const response = await supplierService.deleteSupplier(id);
      
      if (response.success) {
        await get().loadSuppliers();
      }
    } catch (error) {
      console.error('Error al eliminar proveedor:', error);
      throw error;
    }
  },

  setSelectedSupplier: (supplier) => {
    set({ selectedSupplier: supplier });
  },

  clearSelectedSupplier: () => {
    set({ selectedSupplier: null, supplierPurchases: [] });
  },
}));
