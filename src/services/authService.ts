import API_URL from './config';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    name: string;
    email: string;
    role: string;
    roles: string[];
    perfil: {
      nombres?: string;
      apellidos?: string;
      foto_perfil?: string | null;
    } | null;
  };
}

export interface ApiError {
  message: string;
}

/**
 * Servicio de autenticación
 */
export const authService = {
  /**
   * Iniciar sesión
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      let data: LoginResponse | ApiError;

      try {
        data = await response.json();
      } catch {
        throw new Error('Respuesta inválida del servidor');
      }

      if (!response.ok) {
        const error = data as ApiError;
        throw new Error(error.message || 'Error al iniciar sesión');
      }

      const loginData = data as LoginResponse;

      if (!loginData.token) {
        throw new Error('El servidor no devolvió token de autenticación');
      }

      const user = loginData.user;

      // Guardar sesión en sessionStorage (se borra al cerrar el navegador)
      // Limpiar datos viejos de localStorage si los hubiera
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userName');
      localStorage.removeItem('role');

      sessionStorage.setItem('token', loginData.token);
      sessionStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('userName', user?.name || user?.username || user?.email || 'Usuario');
      sessionStorage.setItem('role', user?.role || '');

      window.dispatchEvent(new Event('auth-change'));

      return loginData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Error de conexión con el servidor');
    }
  },

  /**
   * Cerrar sesión
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userName');
    localStorage.removeItem('role');

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('role');

    window.dispatchEvent(new Event('auth-change'));
  },

  /**
   * Obtener token almacenado
   */
  getToken(): string | null {
    return sessionStorage.getItem('token');
  },

  /**
   * Obtener usuario almacenado
   */
  getUser(): LoginResponse['user'] | null {
    const userStr = sessionStorage.getItem('user');

    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  },
};