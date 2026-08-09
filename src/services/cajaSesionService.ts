import axios from 'axios';
import API_URL from './config';
import { ACTIVE_BRANCH_STORAGE_KEY } from '../lib/branchContext';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const branch = localStorage.getItem(
    ACTIVE_BRANCH_STORAGE_KEY,
  );

  if (branch) {
    config.headers['X-Sucursal-Id'] = branch;
  }

  return config;
});

export interface CajaSesion {
  id: number;
  empresa_id: number;
  sucursal_id: number;
  caja_id: number;
  usuario_apertura_id: number;

  fondo_inicial_centavos: number;
  fondo_sugerido_centavos?: number | null;
  diferencia_apertura_centavos?: number | null;

  fecha_apertura: string;
  fecha_cierre?: string | null;
  estado: 'ABIERTA' | 'CERRADA';

  efectivo_esperado_centavos?: number | null;
  efectivo_contado_centavos?: number | null;
  diferencia_centavos?: number | null;

  fondo_siguiente_centavos?: number | null;
  retiro_cierre_centavos?: number | null;

  notas_cierre?: string | null;

  caja_nombre: string;
  caja_codigo: string;
  sucursal_nombre: string;

  usuario_apertura_username?: string | null;
  cerrado_por_username?: string | null;

  ventas_ingresos_centavos?: number;
  ventas_reversas_centavos?: number;

  reparaciones_ingresos_centavos?: number;
  reparaciones_reversas_centavos?: number;

  movimientos_efectivo_centavos?: number;
}

export interface CajaSesionResumen
  extends CajaSesion {
  movimientos_efectivo_centavos: number;
  ventas_efectivo_centavos: number;
  reparaciones_efectivo_centavos: number;
  efectivo_esperado_actual_centavos: number;
}

export interface CajaSesionSugerenciaApertura {
  caja_id: number;
  sesion_anterior_id: number | null;
  fondo_sugerido_centavos: number | null;
  fecha_cierre_anterior: string | null;
}

export interface CajaSesionMovimientoDetalle {
  fuente: 'VENTA' | 'REPARACION';
  movimiento_id: number;
  entidad_id: string;

  documento?: string | null;
  cliente_nombre?: string | null;
  detalle_principal?: string | null;
  pago_indice: number;
  accion: 'INGRESO' | 'REVERSA';
  metodo: string;
  monto_centavos: number;
  referencia?: string | null;
  usuario_id?: number | null;
  usuario_username?: string | null;
  created_at: string;
}

export interface CajaSesionDetalle {
  sesion: CajaSesion;
  movimientos: CajaSesionMovimientoDetalle[];
}

export interface CierreCajaSesion {
  sesionId: number;
  diferencia: number;
  efectivoEsperado: number;
  efectivoContado: number;
  fondoSiguiente: number;
  retiroCierre: number;
}

export const cajaSesionApi = {
  async getActivas(): Promise<CajaSesion[]> {
    const { data } = await api.get(
      '/caja-sesiones/activa',
    );

    return Array.isArray(data?.data)
      ? data.data
      : [];
  },

  async getActiva(): Promise<CajaSesion | null> {
    const rows = await this.getActivas();
    return rows[0] ?? null;
  },

  async getResumenActiva(): Promise<CajaSesionResumen | null> {
    const { data } = await api.get(
      '/caja-sesiones/resumen-activa',
    );

    return data?.data ?? null;
  },

  async getSugerenciaApertura(
    cajaId: number,
  ): Promise<CajaSesionSugerenciaApertura> {
    const { data } = await api.get(
      '/caja-sesiones/sugerencia-apertura',
      {
        params: {
          caja_id: cajaId,
        },
      },
    );

    return data.data;
  },

  async getHistorial(
    limit = 25,
  ): Promise<CajaSesion[]> {
    const { data } = await api.get(
      '/caja-sesiones/historial',
      {
        params: {
          page: 1,
          limit,
        },
      },
    );

    return Array.isArray(data?.data)
      ? data.data
      : [];
  },

  async getDetalle(
    sesionId: number,
  ): Promise<CajaSesionDetalle> {
    const { data } = await api.get(
      `/caja-sesiones/${sesionId}/detalle`,
    );

    return data.data;
  },

  async abrir(payload: {
    cajaId: number;
    fondoInicialCentavos: number;
  }): Promise<CajaSesion> {
    const { data } = await api.post(
      '/caja-sesiones/abrir',
      {
        caja_id: payload.cajaId,
        fondo_inicial_centavos:
          payload.fondoInicialCentavos,
      },
    );

    return data.data;
  },

  async cerrar(
    sesionId: number,
    payload: {
      efectivoContadoCentavos: number;
      fondoSiguienteCentavos: number;
      notasCierre?: string | null;
    },
  ): Promise<CierreCajaSesion> {
    const { data } = await api.post(
      `/caja-sesiones/${sesionId}/cerrar`,
      {
        efectivo_contado_centavos:
          payload.efectivoContadoCentavos,

        fondo_siguiente_centavos:
          payload.fondoSiguienteCentavos,

        notas_cierre:
          payload.notasCierre ?? null,
      },
    );

    return data.data;
  },
};

export function cajaSesionError(
  error: any,
  fallback = 'No fue posible operar la sesión de caja',
): string {
  const data = error?.response?.data;

  switch (data?.code) {
    case 'CAJA_SESION_REQUERIDA':
      return 'Debes abrir una caja en la sucursal activa antes de cobrar en efectivo.';

    case 'CAJA_YA_TIENE_SESION_ABIERTA':
      return 'La caja seleccionada ya tiene una sesión abierta.';

    case 'USUARIO_YA_TIENE_SESION_ABIERTA':
      return 'Ya tienes una sesión de caja abierta.';

    case 'CAJA_NO_ENCONTRADA':
      return 'La caja no existe, está inactiva o pertenece a otra sucursal.';

    case 'SESION_NO_ENCONTRADA':
      return 'La sesión ya fue cerrada o no pertenece a esta sucursal.';

    case 'FONDO_SIGUIENTE_REQUERIDO':
      return 'Debes indicar cuánto efectivo quedará en caja para el próximo turno.';

    case 'FONDO_SIGUIENTE_INVALIDO':
      return 'El efectivo que quedará en caja debe ser un monto válido.';

    case 'FONDO_SIGUIENTE_SUPERA_CONTADO':
      return 'No puedes dejar en caja más efectivo del que fue contado físicamente.';

    case 'SIN_SUCURSALES':
      return 'No hay una sucursal disponible para operar caja.';

    default:
      return (
        data?.message ||
        data?.error ||
        fallback
      );
  }
}
