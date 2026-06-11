import { create } from "zustand";
import { empresaService, EmpresaConfig, EmpresaUpdatePayload } from "../services/empresaService";

interface EmpresaState {
  empresa: EmpresaConfig | null;
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  loadEmpresa: (force?: boolean) => Promise<EmpresaConfig | null>;
  updateEmpresa: (payload: EmpresaUpdatePayload) => Promise<EmpresaConfig>;
  uploadLogo: (file: File) => Promise<EmpresaConfig>;
  clearEmpresa: () => void;
}

export const useEmpresa = create<EmpresaState>((set, get) => ({
  empresa: null,
  isLoading: false,
  error: null,
  hasLoaded: false,

  loadEmpresa: async (force = false) => {
    const state = get();
    if (!force && state.hasLoaded && state.empresa) return state.empresa;

    set({ isLoading: true, error: null });
    try {
      const empresa = await empresaService.getMe();
      set({ empresa, isLoading: false, error: null, hasLoaded: true });
      return empresa;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar la empresa";
      set({ isLoading: false, error: message, hasLoaded: true });
      return null;
    }
  },

  updateEmpresa: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const empresa = await empresaService.updateMe(payload);
      set({ empresa, isLoading: false, error: null, hasLoaded: true });
      return empresa;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la empresa";
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  uploadLogo: async (file) => {
    set({ isLoading: true, error: null });
    try {
      const empresa = await empresaService.uploadLogo(file);
      set({ empresa, isLoading: false, error: null, hasLoaded: true });
      return empresa;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el logo";
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  clearEmpresa: () => set({ empresa: null, isLoading: false, error: null, hasLoaded: false }),
}));
