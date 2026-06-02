// Tipos para el módulo Agenda de Entregas

export interface EntregaAgenda {
  id: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  cliente_email?: string;
  tipo_equipo?: string;
  marca?: string;
  modelo?: string;
  color?: string;
  estado: string;
  prioridad: string;
  fecha_ingreso: string;
  fecha_entrega_programada: string; // ISO datetime
  nota_entrega_programada?: string;
  fecha_entrega?: string; // fecha real de entrega (cuando ya se entregó)
}

export type FiltroAgenda = 'hoy' | 'semana' | 'mes' | 'pendientes' | 'todas';

export type TipoEvento = 'nota' | 'cita' | 'recordatorio' | 'otro';

export interface AgendaEvento {
  id: number;
  titulo: string;
  fecha: string;        // YYYY-MM-DD
  hora?: string | null; // HH:MM:SS
  descripcion?: string | null;
  tipo: TipoEvento;
  color?: string | null;
  creado_por?: string | null;
  creado_por_id?: number | null;
  para_rol?: string | null;
  para_usuario_id?: number | null;
  para_usuario_nombre?: string | null;
  created_at: string;
  updated_at: string;
}
