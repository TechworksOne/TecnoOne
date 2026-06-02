import { create } from "zustand";
import { authService, LoginCredentials } from "../services/authService";

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
  role: "admin" | "employee" | "tecnico";
  roles: string[];
  perfil: UserPerfil | null;
}

interface AuthState {
  user: User | null;
  role: "admin" | "employee" | "tecnico" | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setRole: (role: "admin" | "employee" | "tecnico") => void;
  initAuth: () => void;
  hasRole: (role: string) => boolean;
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

export const useAuth = create<AuthState>((set) => ({
  // Estado inicial: leído SÍNCRONAMENTE desde localStorage
  ...readStoredAuth(),
  isLoading: false,
  error: null,

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
    }
  },

  // Verificar si el usuario tiene un rol específico
  hasRole: (role: string) => {
    const state = useAuth.getState();
    return state.user?.roles?.includes(role) ?? state.user?.role === role;
  },
}));

