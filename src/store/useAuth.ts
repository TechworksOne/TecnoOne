import { create } from "zustand";
import { authService, LoginCredentials } from "../services/authService";
import { permisoService } from "../services/permisoService";

interface UserPerfil {
  nombres?: string;
  apellidos?: string;
  foto_perfil?: string | null;
}

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: "admin" | "employee" | "tecnico" | "superadmin";
  roles: string[];
  empresa_id: number | null;
  perfil: UserPerfil | null;
  tipo_usuario?: "EMPRESA" | "PLATAFORMA";
  es_super_admin?: boolean;
}

export interface AuthState {
  user: User | null;
  role: User["role"] | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  permissions: string[];
  permissionsLoaded: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setRole: (role: User["role"]) => void;
  initAuth: () => void;
  hasRole: (role: string) => boolean;
  loadPermissions: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

// ── Lectura síncrona de localStorage al crear el store ────────────────────────
// Esto evita que un F5 (refresh) redirija al login antes de que el useEffect
// restaure la sesión, porque el store ya nace con los datos correctos.
function readStoredAuth() {
  const user  = authService.getUser();
  const token = authService.getToken();
  if (user && token) {
    return { user: user as User, role: user.role as User["role"], token };
  }
  return { user: null, role: null, token: null };
}

export const useAuth = create<AuthState>((set, get) => ({
  // Estado inicial: leído SÍNCRONAMENTE desde localStorage
  ...readStoredAuth(),
  isLoading: false,
  error: null,
  permissions: [],
  permissionsLoaded: false,

  // Iniciar sesión con credenciales reales
  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      set({
        user: response.user as User,
        role: response.user.role as User["role"],
        token: response.token,
        isLoading: false,
        error: null,
      });
      if (response.user.es_super_admin || response.user.role === 'superadmin') {
        set({ permissions: [], permissionsLoaded: true });
      } else try {
        const permissions = await permisoService.getMisPermisos();
        set({ permissions, permissionsLoaded: true });
      } catch {
        set({ permissions: [], permissionsLoaded: true });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error al iniciar sesión";
      set({
        user: null,
        role: null,
        token: null,
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  // Cerrar sesión
  logout: () => {
    authService.logout();
    set({
      user: null,
      role: null,
      token: null,
      error: null,
      permissions: [],
      permissionsLoaded: false,
    });
  },

  // Mantener compatibilidad con el método anterior
  setRole: (role) => set({ role }),

  // initAuth sigue existiendo por compatibilidad, pero ahora es un no-op
  // porque el store ya se inicializó síncronamente
  initAuth: () => {
    const user  = authService.getUser();
    const token = authService.getToken();
    if (user && token) {
      set({ user: user as User, role: user.role as User["role"], token });
      if (user.es_super_admin || user.role === 'superadmin') {
        set({ permissions: [], permissionsLoaded: true });
      } else {
        void get().loadPermissions();
      }
    }
  },

  // Verificar si el usuario tiene un rol específico
  hasRole: (role: string) => {
    const state = get();
    return state.user?.roles?.includes(role) ?? state.user?.role === role;
  },

  loadPermissions: async () => {
    const state = get();
    if (!state.token) {
      set({ permissions: [], permissionsLoaded: true });
      return;
    }
    try {
      const permissions = await permisoService.getMisPermisos();
      set({ permissions, permissionsLoaded: true });
    } catch {
      set({ permissions: [], permissionsLoaded: true });
    }
  },

  hasPermission: (permission: string) => {
    const state = get();
    if (state.user?.role === 'superadmin') return true;
    return state.permissions.includes('*') || state.permissions.includes(permission);
  },
}));

