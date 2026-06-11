import API_URL from "./config";
import { authService } from "./authService";

export interface EmpresaConfig {
  id: number;
  nombre: string;
  nombre_comercial?: string | null;
  razon_social?: string | null;
  nit?: string | null;
  slug?: string;
  estado?: string;
  plan?: string;
  telefono?: string | null;
  email?: string | null;
  correo?: string | null;
  direccion?: string | null;
  logo_url?: string | null;
  color_primario?: string | null;
  color_principal?: string | null;
  moneda_codigo?: string | null;
  moneda_simbolo?: string | null;
  zona_horaria?: string | null;
}

export interface EmpresaUpdatePayload {
  nombre?: string | null;
  nombre_comercial?: string | null;
  razon_social?: string | null;
  nit?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  logo_url?: string | null;
  color_principal?: string | null;
  moneda_codigo?: string | null;
  moneda_simbolo?: string | null;
  zona_horaria?: string | null;
}

interface EmpresaResponse {
  success: boolean;
  message?: string;
  data: EmpresaConfig;
}

const authHeaders = () => {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function parseEmpresaResponse(response: Response): Promise<EmpresaConfig> {
  const data = await response.json().catch(() => null) as EmpresaResponse | null;

  if (!response.ok) {
    throw new Error(data?.message || "No se pudo procesar la empresa");
  }

  if (!data?.data) {
    throw new Error("Respuesta inválida del servidor");
  }

  return data.data;
}

export const empresaService = {
  async getMe(): Promise<EmpresaConfig> {
    const response = await fetch(`${API_URL}/empresa/me`, {
      headers: authHeaders(),
    });

    return parseEmpresaResponse(response);
  },

  async updateMe(payload: EmpresaUpdatePayload): Promise<EmpresaConfig> {
    const response = await fetch(`${API_URL}/empresa/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });

    return parseEmpresaResponse(response);
  },

  async uploadLogo(file: File): Promise<EmpresaConfig> {
    const formData = new FormData();
    formData.append("logo", file);

    const response = await fetch(`${API_URL}/empresa/logo`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });

    return parseEmpresaResponse(response);
  },
};
