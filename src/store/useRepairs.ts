import { create } from 'zustand';
import { Repair, RepairFormData, RepairStatus, RepairPriority, StateChangeRequest, StateHistoryEntry } from '../types/repair';
import { useAuth } from './useAuth';

interface RepairState {
  repairs: Repair[];
  selectedRepair: Repair | null;
  isLoading: boolean;
  error: string | null;
  usedStickerNumbers: Set<string>; // Para validar unicidad
  
  // Actions
  setRepairs: (repairs: Repair[]) => void;
  addRepair: (repairData: RepairFormData) => Promise<string>;
  updateRepair: (id: string, updates: Partial<Repair>) => Promise<void>;
  deleteRepair: (id: string) => Promise<void>;
  setSelectedRepair: (repair: Repair | null) => void;
  changeRepairState: (id: string, stateChange: StateChangeRequest) => Promise<void>;
  validateStickerUniqueness: (sticker: string, excludeId?: string) => boolean;
  
  // Getters
  getRepairsByStatus: (status: RepairStatus) => Repair[];
  getRepairsByTechnician: (technicianId: string) => Repair[];
  searchRepairs: (query: string) => Repair[];
}

export const useRepairs = create<RepairState>((set, get) => ({
  repairs: [],
  selectedRepair: null,
  isLoading: false,
  error: null,
  usedStickerNumbers: new Set(),

  setRepairs: (repairs) => {
    // Actualizar set de stickers usados
    const usedStickers = new Set(
      repairs
        .filter(r => r.stickerSerieInterna)
        .map(r => r.stickerSerieInterna!)
    );
    set({ repairs, usedStickerNumbers: usedStickers });
  },

  addRepair: async (repairData) => {
    set({ isLoading: true, error: null });
    
    try {
      const newRepair: Repair = {
        id: `REP${Date.now()}`,
        ...repairData,
        fechaIngreso: new Date().toISOString().split('T')[0],
        garantiaDias: repairData.garantiaMeses * 30, // Convertir meses a días
        subtotal: repairData.items.reduce((sum, item) => sum + item.subtotal, 0),
        impuestos: (repairData.items.reduce((sum, item) => sum + item.subtotal, 0) + repairData.manoDeObra) * 0.12,
        total: (repairData.items.reduce((sum, item) => sum + item.subtotal, 0) + repairData.manoDeObra) * 1.12,
        saldoAnticipo: repairData.recepcion.montoAnticipo || 0, // Inicializar saldo del anticipo
        totalInvertido: 0, // Inicializar sin inversión
        totalGanancia: undefined, // Se calculará al entregar
        historialEstados: repairData.historialEstados && repairData.historialEstados.length > 0 
          ? repairData.historialEstados 
          : [{
              id: `hist-${Date.now()}`,
              estado: repairData.estado,
              subEtapa: repairData.subEtapa,
              nota: repairData.recepcion.montoAnticipo 
                ? `Reparación creada. Anticipo recibido: Q${repairData.recepcion.montoAnticipo.toFixed(2)} (${repairData.recepcion.metodoAnticipo})`
                : "Reparación creada",
              fotos: [],
              timestamp: new Date().toISOString(),
              user: useAuth.getState().user?.username || useAuth.getState().user?.name || 'Sistema'
            }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      set(state => ({
        repairs: [newRepair, ...state.repairs],
        isLoading: false
      }));

      return newRepair.id;
    } catch (error) {
      set({ error: 'Error al crear la reparación', isLoading: false });
      throw error;
    }
  },

  updateRepair: async (id, updates) => {
    set({ isLoading: true, error: null });
    
    try {
      set(state => {
        const repairToUpdate = state.repairs.find(r => r.id === id);
        const newUsedStickers = new Set(state.usedStickerNumbers);
        
        // Actualizar stickers usados si hay cambio
        if (updates.stickerSerieInterna && repairToUpdate) {
          if (repairToUpdate.stickerSerieInterna) {
            newUsedStickers.delete(repairToUpdate.stickerSerieInterna);
          }
          newUsedStickers.add(updates.stickerSerieInterna);
        }
        
        const updatedRepairs = state.repairs.map(repair => {
          if (repair.id === id) {
            return {
              ...repair,
              ...updates,
              updatedAt: new Date().toISOString()
            };
          }
          return repair;
        });
        
        return { 
          repairs: updatedRepairs, 
          usedStickerNumbers: newUsedStickers,
          isLoading: false 
        };
      });
    } catch (error) {
      set({ error: 'Error al actualizar la reparación', isLoading: false });
      throw error;
    }
  },

  deleteRepair: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      set(state => {
        const repairToDelete = state.repairs.find(r => r.id === id);
        const updatedStickers = new Set(state.usedStickerNumbers);
        
        if (repairToDelete?.stickerSerieInterna) {
          updatedStickers.delete(repairToDelete.stickerSerieInterna);
        }
        
        return {
          repairs: state.repairs.filter(repair => repair.id !== id),
          selectedRepair: state.selectedRepair?.id === id ? null : state.selectedRepair,
          usedStickerNumbers: updatedStickers,
          isLoading: false
        };
      });
    } catch (error) {
      set({ error: 'Error al eliminar la reparación', isLoading: false });
      throw error;
    }
  },

  setSelectedRepair: (repair) => set({ selectedRepair: repair }),

  changeRepairState: async (id, stateChange) => {
    const { estado, subEtapa, nota, fotos = [], piezaNecesaria, proveedor, costoRepuesto, stickerNumero, stickerUbicacion, diferenciaReparacion } = stateChange;
    
    const currentRepair = get().repairs.find(r => r.id === id);
    if (!currentRepair) return;
    
    const newHistoryEntry: StateHistoryEntry = {
      id: `hist-${Date.now()}`,
      estado,
      subEtapa,
      nota,
      fotos,
      timestamp: new Date().toISOString(),
      user: useAuth.getState().user?.username || useAuth.getState().user?.name || 'Sistema',
      piezaNecesaria,
      proveedor
    };
    
    const updates: Partial<Repair> = {
      estado,
      subEtapa,
      historialEstados: [...currentRepair.historialEstados, newHistoryEntry]
    };
    
    // Si hay costo de repuesto, actualizar el saldo del anticipo y total invertido
    if (costoRepuesto && costoRepuesto > 0) {
      const saldoActual = currentRepair.saldoAnticipo ?? currentRepair.recepcion.montoAnticipo ?? 0;
      const totalInvertidoActual = currentRepair.totalInvertido || 0;
      
      updates.saldoAnticipo = saldoActual - costoRepuesto;
      updates.totalInvertido = totalInvertidoActual + costoRepuesto;
      
      // Agregar información del costo al historial
      newHistoryEntry.nota += ` | Costo repuesto: Q${costoRepuesto.toFixed(2)} - Nuevo saldo: Q${updates.saldoAnticipo.toFixed(2)} - Total invertido: Q${updates.totalInvertido.toFixed(2)}`;
    }
    
    // Si se está completando la reparación, agregar información del sticker
    if (estado === "COMPLETADA" && stickerNumero) {
      updates.stickerSerieInterna = stickerNumero;
      updates.stickerUbicacion = stickerUbicacion;
      
      // Agregar el sticker al conjunto de stickers usados
      const newUsedStickers = new Set(get().usedStickerNumbers);
      newUsedStickers.add(stickerNumero);
      
      // Agregar información del sticker al historial
      newHistoryEntry.nota += ` | Sticker asignado: ${stickerNumero} (${stickerUbicacion})`;
      
      // Actualizar el conjunto de stickers usados
      set(state => ({
        ...state,
        usedStickerNumbers: newUsedStickers
      }));
    }
    
    // Si se está entregando la reparación, manejar la diferencia y calcular ganancia
    if (estado === "ENTREGADA") {
      updates.fechaCierre = new Date().toISOString().split('T')[0];
      
      if (diferenciaReparacion !== undefined) {
        updates.diferenciaReparacion = diferenciaReparacion;
        
        // Calcular el saldo final: saldo actual + diferencia de reparación
        const saldoActual = currentRepair.saldoAnticipo ?? (currentRepair.recepcion.montoAnticipo || 0);
        const saldoFinal = saldoActual + diferenciaReparacion;
        
        // Calcular ganancia total: (Anticipo + Diferencia) - Total Invertido
        const anticipoOriginal = currentRepair.recepcion.montoAnticipo || 0;
        const totalInvertido = currentRepair.totalInvertido || 0;
        const totalGanancia = (anticipoOriginal + diferenciaReparacion) - totalInvertido;
        
        updates.totalGanancia = totalGanancia;
        
        // Agregar información de la entrega al historial
        newHistoryEntry.nota += ` | Diferencia: +Q${diferenciaReparacion.toFixed(2)}`;
        newHistoryEntry.nota += ` | Saldo final: Q${saldoFinal.toFixed(2)}`;
        newHistoryEntry.nota += ` | Ganancia total: Q${totalGanancia.toFixed(2)}`;
        
        if (saldoFinal > 0) {
          newHistoryEntry.nota += ` - Saldo a favor del cliente`;
        } else if (saldoFinal < 0) {
          newHistoryEntry.nota += ` - Cobrar adicional: Q${Math.abs(saldoFinal).toFixed(2)}`;
        } else {
          newHistoryEntry.nota += ` - Cuenta saldada`;
        }
        
        // Actualizar el saldo final en la reparación
        updates.saldoAnticipo = saldoFinal;
      }
    }
    
    await get().updateRepair(id, updates);
  },

  validateStickerUniqueness: (sticker, excludeId) => {
    const state = get();
    
    // Si estamos editando, excluir el ID actual
    if (excludeId) {
      const currentRepair = state.repairs.find(r => r.id === excludeId);
      if (currentRepair?.stickerSerieInterna === sticker) {
        return true; // Es el mismo sticker del mismo repair
      }
    }
    
    return !state.usedStickerNumbers.has(sticker);
  },

  getRepairsByStatus: (status) => {
    return get().repairs.filter(repair => repair.estado === status);
  },

  getRepairsByTechnician: (technicianId) => {
    return get().repairs.filter(repair => repair.tecnicoAsignado === technicianId);
  },

  searchRepairs: (query) => {
    const lowerQuery = query.toLowerCase();
    return get().repairs.filter(repair =>
      repair.clienteNombre.toLowerCase().includes(lowerQuery) ||
      repair.recepcion.marca?.toLowerCase().includes(lowerQuery) ||
      repair.recepcion.modelo?.toLowerCase().includes(lowerQuery) ||
      repair.recepcion.imeiSerie?.toLowerCase().includes(lowerQuery) ||
      repair.id.toLowerCase().includes(lowerQuery) ||
      repair.stickerSerieInterna?.toLowerCase().includes(lowerQuery)
    );
  }
}));