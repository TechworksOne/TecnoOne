import { Customer } from './customer';

export interface RepairItem {
  id: string;
  productId?: string; // Opcional para items manuales
  nombre: string;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
}

export type RepairStatus = "RECIBIDA" | "EN_PROCESO" | "ESPERANDO_PIEZA" | "COMPLETADA" | "ENTREGADA" | "CANCELADA" | "EN_DIAGNOSTICO" | "ESPERANDO_AUTORIZACION" | "AUTORIZADA" | "EN_REPARACION" | "STAND_BY";
export type RepairPriority = "BAJA" | "MEDIA" | "ALTA";
export type EquipmentType = "Telefono" | "Tablet" | "Laptop" | "Consola" | "Otro";
export type SubStage = "DIAGNOSTICO" | "DESARMADO" | "REPARACION" | "ARMADO" | "PRUEBAS" | "CALIBRACION";
export type StickerLocation = "chasis" | "bandeja_sim" | "bateria" | "otro";

export interface AccessoriesReceived {
  chip: boolean;
  estuche: boolean;
  memoriaSD: boolean;
  cargador: boolean;
  otrosAccesorios?: string;
  otros?: string; // Alias para compatibilidad
}

export interface RepairReception {
  tipoEquipo: EquipmentType;
  marca?: string;
  modelo?: string;
  color?: string;
  imeiSerie?: string;
  imei?: string;           // alias mapped from API (imei_serie)
  patronContraseña?: string;
  contraseña?: string;     // alias mapped from API (patron_contrasena)
  accesoTipo?: 'ninguno' | 'pin' | 'patron';
  accesoValor?: string | null;
  accesoriosRecibidos: AccessoriesReceived;
  estadoFisico?: string;
  diagnosticoInicial?: string;
  fotosRecepcion: string[];
  fechaRecepcion: string;
  userRecepcion?: string;
  recepcionConfirmada?: boolean; // Para bloquear edición
  
  // Anticipo
  montoAnticipo?: number;
  metodoAnticipo?: 'efectivo' | 'transferencia' | 'tarjeta' | 'tarjeta_bac' | 'tarjeta_neonet' | 'tarjeta_otra';
  comprobanteTransferencia?: string; // Para transferencias
}

export interface StateHistoryEntry {
  id: string;
  estado: RepairStatus;
  subEtapa?: SubStage;
  nota: string;
  fotos: string[];
  timestamp: string;
  user?: string;
  piezaNecesaria?: string; // Para ESPERANDO_PIEZAS
  proveedor?: string; // Para ESPERANDO_PIEZAS
}

export interface Repair {
  id: string;
  // Cliente
  clienteNombre: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  
  // Recepción del equipo
  recepcion: RepairReception;
  
  // Estado y flujo
  estado: RepairStatus;
  subEtapa?: SubStage;
  prioridad: RepairPriority;
  tecnicoAsignado?: string;
  fechaIngreso: string;
  fechaCierre?: string;
  garantiaDias: number;
  
  // Historial de estados
  historialEstados: StateHistoryEntry[];
  
  // Relaciones
  cotizacionId?: string; // Relación con cotización
  
  // Items y costos
  items: RepairItem[];
  manoDeObra: number;
  subtotal: number;
  impuestos: number;
  total: number;
  
  // Anticipo y saldo
  saldoAnticipo?: number; // Saldo restante del anticipo después de descontar repuestos
  montoPagadoAdicional?: number; // Pago del saldo pendiente
  metodoPagoAdicional?: 'efectivo' | 'tarjeta'; // Método del pago adicional
  diferenciaReparacion?: number; // Diferencia adicional cobrada al entregar
  totalInvertido?: number; // Total gastado en repuestos
  totalGanancia?: number; // Ganancia total de la reparación
  
  // Control y entrega
  stickerSerieInterna?: string; // Único
  stickerUbicacion?: StickerLocation;
  fotosFinales: string[];
  
  // Observaciones generales
  observaciones?: string;
  
  // Cancelación
  fechaCancelacion?: string;
  motivoCancelacion?: string;
  devolucionMonto?: number;
  montoRetenido?: number;
  motivoRetencion?: string;

  // Entrega programada (Agenda)
  fechaEntregaProgramada?: string;
  notaEntregaProgramada?: string;

  // Orden de Trabajo — asignación técnica
  tecnicoAsignadoId?: number | null;
  asignadoPor?: number | null;
  asignadoEn?: string | null;
  tecnicoNombre?: string | null;
  tecnicoUsername?: string | null;
  asignadoPorNombre?: string | null;

  // Auditoría
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface RepairFormData {
  // Datos del cliente (usando tipo unificado)
  cliente?: Customer;  // Changed from Cliente to Customer
  
  // Campos legacy (mantener por compatibilidad por ahora)
  clienteNombre: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  clienteId?: string;
  clienteFrecuente?: boolean;
  
  // Recepción del equipo
  recepcion: RepairReception;
  
  // Estado y progreso
  estado: RepairStatus;
  subEtapa?: SubStage;
  prioridad: RepairPriority;
  garantiaMeses: number; // Cambiar de días a meses (máximo 5)
  historialEstados: StateHistoryEntry[]; // Añadir historial
  
  // Sticker (solo cuando está completada)
  stickerNumero?: string;
  stickerUbicacion?: StickerLocation;
  
  // Garantía calculada
  fechaEntrega?: string;
  garantiaHasta?: string;
  
  // Items y servicios (sin IVA automático)
  items: RepairItem[];
  manoDeObra: number;
  observaciones?: string;
  tecnicoAsignado?: string;
  
  // Fotos opcionales del equipo
  fotosEquipo?: string[];
  
  // ID de cotización si aplica
  cotizacionId?: string;
  fotosFinales: string[];
}

export interface RepairFilters {
  estado?: RepairStatus;
  prioridad?: RepairPriority;
  tipoEquipo?: EquipmentType;
  searchQuery?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  tecnico?: string;
}

export interface StateChangeRequest {
  estado: RepairStatus;
  subEtapa?: SubStage;
  nota: string;
  fotos?: string[];
  piezaNecesaria?: string;
  proveedor?: string;
  costoRepuesto?: number; // Costo del repuesto para descontar del anticipo
  stickerNumero?: string; // Número de serie del sticker
  stickerUbicacion?: StickerLocation; // Ubicación del sticker
  diferenciaReparacion?: number; // Diferencia adicional a cobrar en la entrega
}