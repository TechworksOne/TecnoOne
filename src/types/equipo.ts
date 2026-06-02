// Tipos para marcas y modelos de equipos
export type TipoEquipo = 'Telefono' | 'Laptop' | 'Tablet' | 'Consola' | 'Otro';

export interface EquipoMarca {
  id: number;
  nombre: string;
  tipo_equipo: TipoEquipo;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipoModelo {
  id: number;
  marca_id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  marca_nombre?: string;
  tipo_equipo?: TipoEquipo;
}

export interface CreateMarcaRequest {
  nombre: string;
  tipo_equipo: TipoEquipo;
}

export interface CreateModeloRequest {
  marca_id: number;
  nombre: string;
}
