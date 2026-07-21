import { create } from 'zustand';
import {
  ACTIVE_BRANCH_STORAGE_KEY,
  CONSOLIDATED_BRANCH_VALUE,
  notifyBranchContextChanged,
  type BranchContextMode,
} from '../lib/branchContext';
import {
  sucursalContextService,
  type MiSucursal,
} from '../services/sucursalContextService';

interface SucursalContextState {
  sucursales: MiSucursal[];
  sucursalActiva: MiSucursal | null;
  mode: BranchContextMode;
  canUseConsolidated: boolean;
  defaultSucursalId: number | null;
  contextVersion: number;
  currentUserId: number | null;
  loading: boolean;
  error: string | null;
  cargar: (userId: number) => Promise<void>;
  seleccionar: (userId: number, value: number | 'ALL') => void;
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

function persistirEspecifico(userId: number, sucursal: MiSucursal | null) {
  if (!sucursal) {
    localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
    return;
  }
  const value = String(sucursal.id);
  localStorage.setItem(userStorageKey(userId), value);
  localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, value);
}

function persistirConsolidado(userId: number) {
  localStorage.setItem(userStorageKey(userId), CONSOLIDATED_BRANCH_VALUE);
  localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, CONSOLIDATED_BRANCH_VALUE);
}

let loadSequence = 0;

export const useSucursalContext = create<SucursalContextState>((set, get) => ({
  sucursales: [],
  sucursalActiva: null,
  mode: 'specific',
  canUseConsolidated: false,
  defaultSucursalId: null,
  contextVersion: 0,
  currentUserId: null,
  loading: false,
  error: null,

  cargar: async userId => {
    const sequence = ++loadSequence;
    set({ loading: true, error: null });
    try {
      const response = await sucursalContextService.getMisSucursales();
      if (sequence !== loadSequence) return;

      const { sucursales, canUseConsolidated, defaultSucursalId } = response;
      const storedValue = localStorage.getItem(userStorageKey(userId));
      const useConsolidated = storedValue === CONSOLIDATED_BRANCH_VALUE
        && canUseConsolidated;
      const sucursalActiva = elegirSucursalDisponible(
        sucursales,
        storedValue === CONSOLIDATED_BRANCH_VALUE
          ? String(defaultSucursalId ?? '')
          : storedValue,
      );

      if (useConsolidated) persistirConsolidado(userId);
      else persistirEspecifico(userId, sucursalActiva);

      set({
        sucursales,
        sucursalActiva: useConsolidated ? null : sucursalActiva,
        mode: useConsolidated ? 'consolidated' : 'specific',
        canUseConsolidated,
        defaultSucursalId,
        currentUserId: userId,
        loading: false,
        error: null,
      });
    } catch (error: unknown) {
      if (sequence !== loadSequence) return;
      localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
      set({
        sucursales: [],
        sucursalActiva: null,
        mode: 'specific',
        canUseConsolidated: false,
        defaultSucursalId: null,
        currentUserId: userId,
        loading: false,
        error: (error as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? 'No se pudieron cargar las sucursales asignadas',
      });
    }
  },

  seleccionar: (userId, value) => {
    const state = get();
    if (value === CONSOLIDATED_BRANCH_VALUE) {
      if (!state.canUseConsolidated) return;
      persistirConsolidado(userId);
      const contextVersion = state.contextVersion + 1;
      set({ mode: 'consolidated', sucursalActiva: null, contextVersion, error: null });
      notifyBranchContextChanged({ mode: 'consolidated', sucursalId: null, version: contextVersion });
      return;
    }

    const sucursal = state.sucursales.find(item => item.id === value);
    if (!sucursal) return;
    persistirEspecifico(userId, sucursal);
    const contextVersion = state.contextVersion + 1;
    set({ mode: 'specific', sucursalActiva: sucursal, contextVersion, error: null });
    notifyBranchContextChanged({ mode: 'specific', sucursalId: sucursal.id, version: contextVersion });
  },

  limpiar: () => {
    const state = get();
    loadSequence += 1;
    localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
    if (state.currentUserId) localStorage.removeItem(userStorageKey(state.currentUserId));
    set({
      sucursales: [],
      sucursalActiva: null,
      mode: 'specific',
      canUseConsolidated: false,
      defaultSucursalId: null,
      currentUserId: null,
      contextVersion: state.contextVersion + 1,
      loading: false,
      error: null,
    });
  },
}));
