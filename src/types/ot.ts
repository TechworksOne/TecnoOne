import { RepairStatus } from './repair';

export interface Tecnico {
  id: number;
  username: string;
  email: string;
  nombre_completo: string;
  roles: string[];
}

export interface OrdenTrabajo {
  id: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  tipo_equipo: string;
  marca?: string;
  modelo?: string;
  estado: RepairStatus;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA';
  fecha_ingreso: string;
  fecha_entrega_programada?: string | null;

  // Asignación técnica
  tecnico_asignado_id: number | null;
  asignado_por: number | null;
  asignado_en: string | null;

  // Nombres resueltos por JOIN
  tecnico_nombre?: string;
  tecnico_username?: string;
  asignado_por_nombre?: string;
  asignado_por_username?: string;
}

export interface AsignarTecnicoPayload {
  tecnico_id: number;
}

// ── Dashboard: carga por técnico ───────────────────────────────────────────
export interface CargaTecnico {
  id: number;
  nombre: string;
  username: string;
  foto_perfil?: string | null;
  total_activas: number;
  en_reparacion: number;
  esperando_pieza: number;
  listas: number;
  en_diagnostico: number;
}

// ── Dashboard: resumen para administrador ─────────────────────────────────
export interface ResumenAdmin {
  porEstado: Partial<Record<string, number>>;
  sinAsignar: number;
  tecnicos: CargaTecnico[];
}

// ── Dashboard: resumen para técnico ───────────────────────────────────────
export interface ResumenTecnico {
  porEstado: Partial<Record<string, number>>;
  vencidas: number;
}

export type ResumenOT = ResumenAdmin | ResumenTecnico;

