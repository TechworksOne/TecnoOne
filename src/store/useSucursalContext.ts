import { create } from 'zustand';
import {
  ACTIVE_BRANCH_STORAGE_KEY,
  sucursalContextService,
  type MiSucursal,
} from '../services/sucursalContextService';

interface SucursalContextState {
  sucursales: MiSucursal[];
  sucursalActiva: MiSucursal | null;
  loading: boolean;
  error: string | null;
  cargar: (userId: number) => Promise<void>;
  seleccionar: (userId: number, sucursalId: number) => void;
  limpiar: () => void;
}

const userStorageKey = (userId: number) => `tecnoone.sucursalActivaId.${userId}`;

export function elegirSucursalDisponible(
  sucursales: MiSucursal[],
  storedId: string | null,
): MiSucursal | null {
  const stored = Number(storedId);
  return sucursales.find(item => item.id === stored)
    ?? sucursales.find(item => Boolean(item.es_predeterminada))
    ?? sucursales[0]
    ?? null;
}

function persistir(userId: number, sucursal: MiSucursal | null) {
  if (!sucursal) {
    localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
    return;
  }
  const value = String(sucursal.id);
  localStorage.setItem(userStorageKey(userId), value);
  localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, value);
}

export const useSucursalContext = create<SucursalContextState>((set, get) => ({
  sucursales: [],
  sucursalActiva: null,
  loading: false,
  error: null,

  cargar: async userId => {
    set({ loading: true, error: null });
    try {
      const sucursales = await sucursalContextService.getMisSucursales();
      const sucursalActiva = elegirSucursalDisponible(
        sucursales,
        localStorage.getItem(userStorageKey(userId)),
      );
      persistir(userId, sucursalActiva);
      set({ sucursales, sucursalActiva, loading: false, error: null });
    } catch (error: unknown) {
      localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
      set({
        sucursales: [],
        sucursalActiva: null,
        loading: false,
        error: (error as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? 'No se pudieron cargar las sucursales asignadas',
      });
    }
  },

  seleccionar: (userId, sucursalId) => {
    const sucursal = get().sucursales.find(item => item.id === sucursalId);
    if (!sucursal) return;
    persistir(userId, sucursal);
    set({ sucursalActiva: sucursal, error: null });
  },

  limpiar: () => {
    localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
    set({ sucursales: [], sucursalActiva: null, loading: false, error: null });
  },
}));
