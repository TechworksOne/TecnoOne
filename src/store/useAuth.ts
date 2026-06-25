import { create } from "zustand";
import { authService, LoginCredentials } from "../services/authService";
import {
  permisoService,
  type PlanConsumption,
  type PlanInfo,
} from "../services/permisoService";

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

  modules: string[];
  modulesLoaded: boolean;
  plan: PlanInfo | null;
  planConsumption: PlanConsumption | null;

  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setRole: (role: User["role"]) => void;
  initAuth: () => void;
  hasRole: (role: string) => boolean;
  loadPermissions: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasModule: (moduleCode: string) => boolean;
}

function readStoredAuth() {
  const user = authService.getUser();
  const token = authService.getToken();

  if (user && token) {
    return {
      user: user as User,
      role: user.role as User["role"],
      token,
    };
  }

  return {
    user: null,
    role: null,
    token: null,
  };
}

export const useAuth = create<AuthState>((set, get) => ({
  ...readStoredAuth(),

  isLoading: false,
  error: null,

  permissions: [],
  permissionsLoaded: false,

  modules: [],
  modulesLoaded: false,
  plan: null,
  planConsumption: null,

  login: async (credentials: LoginCredentials) => {
    set({
      isLoading: true,
      error: null,
    });

    try {
      const response =
        await authService.login(credentials);

      set({
        user: response.user as User,
        role: response.user.role as User["role"],
        token: response.token,
        isLoading: false,
        error: null,
      });

      if (
        response.user.es_super_admin ||
        response.user.role === "superadmin"
      ) {
        set({
          permissions: ["*"],
          permissionsLoaded: true,
          modules: ["*"],
          modulesLoaded: true,
          plan: null,
          planConsumption: null,
        });
      } else {
        await get().loadPermissions();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error al iniciar sesión";

      // Eliminar cualquier sesión anterior si el nuevo login falla.
      authService.logout();

      set({
        user: null,
        role: null,
        token: null,
        isLoading: false,
        error: errorMessage,
        permissions: [],
        permissionsLoaded: false,
        modules: [],
        modulesLoaded: false,
        plan: null,
        planConsumption: null,
      });

      throw error;
    }
  },

  logout: () => {
    authService.logout();

    set({
      user: null,
      role: null,
      token: null,
      error: null,
      permissions: [],
      permissionsLoaded: false,
      modules: [],
      modulesLoaded: false,
      plan: null,
      planConsumption: null,
    });
  },

  setRole: (role) => set({ role }),

  initAuth: () => {
    const user = authService.getUser();
    const token = authService.getToken();

    if (!user || !token) {
      return;
    }

    set({
      user: user as User,
      role: user.role as User["role"],
      token,
    });

    if (
      user.es_super_admin ||
      user.role === "superadmin"
    ) {
      set({
        permissions: ["*"],
        permissionsLoaded: true,
        modules: ["*"],
        modulesLoaded: true,
        plan: null,
        planConsumption: null,
      });
    } else {
      void get().loadPermissions();
    }
  },

  hasRole: (role: string) => {
    const state = get();

    return Boolean(
      state.user?.roles?.includes(role) ||
      state.user?.role === role
    );
  },

  loadPermissions: async () => {
    const state = get();

    if (!state.token) {
      set({
        permissions: [],
        permissionsLoaded: true,
        modules: [],
        modulesLoaded: true,
        plan: null,
        planConsumption: null,
      });

      return;
    }

    const isInitialAccessLoad =
      !state.permissionsLoaded ||
      !state.modulesLoaded;

    // Durante una actualización en segundo plano no se deben cambiar
    // estos indicadores a false, porque ProtectedRoute desmontaría
    // la pantalla actual y provocaría un ciclo de recargas.
    if (isInitialAccessLoad) {
      set({
        permissionsLoaded: false,
        modulesLoaded: false,
      });
    }

    try {
      const [permissions, modulesResponse] =
        await Promise.all([
          permisoService.getMisPermisos(),
          permisoService.getMisModulos(),
        ]);

      set({
        permissions,
        permissionsLoaded: true,
        modules: modulesResponse.modulos,
        modulesLoaded: true,
        plan: modulesResponse.plan,
        planConsumption: modulesResponse.consumo,
      });
    } catch {
      if (isInitialAccessLoad) {
        set({
          permissions: [],
          permissionsLoaded: true,
          modules: [],
          modulesLoaded: true,
          plan: null,
          planConsumption: null,
        });
      } else {
        // Conservar los permisos y módulos previamente cargados cuando
        // únicamente falla una actualización en segundo plano.
        set({
          permissionsLoaded: true,
          modulesLoaded: true,
        });
      }
    }
  },

  hasPermission: (permission: string) => {
    const state = get();

    if (state.user?.role === "superadmin") {
      return true;
    }

    return (
      state.permissions.includes("*") ||
      state.permissions.includes(permission)
    );
  },

  hasModule: (moduleCode: string) => {
    const state = get();

    if (state.user?.role === "superadmin") {
      return true;
    }

    return (
      state.modules.includes("*") ||
      state.modules.includes(moduleCode)
    );
  },
}));
