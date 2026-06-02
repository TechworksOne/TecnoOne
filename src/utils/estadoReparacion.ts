const ESTADO_BACKEND_MAP: Record<string, string> = {
  recibida: 'RECIBIDA',
  recibido: 'RECIBIDA',

  diagnostico: 'EN_DIAGNOSTICO',
  diagnosticar: 'EN_DIAGNOSTICO',
  en_diagnostico: 'EN_DIAGNOSTICO',

  esperando_autorizacion: 'ESPERANDO_AUTORIZACION',
  autorizacion: 'ESPERANDO_AUTORIZACION',

  autorizada: 'AUTORIZADA',
  autorizado: 'AUTORIZADA',

  reparacion: 'EN_REPARACION',
  en_reparacion: 'EN_REPARACION',

  proceso: 'EN_PROCESO',
  en_proceso: 'EN_PROCESO',

  esperando_pieza: 'ESPERANDO_PIEZA',
  pieza: 'ESPERANDO_PIEZA',

  completada: 'COMPLETADA',
  completado: 'COMPLETADA',
  terminada: 'COMPLETADA',
  terminado: 'COMPLETADA',

  entregada: 'ENTREGADA',
  entregado: 'ENTREGADA',

  cancelada: 'CANCELADA',
  cancelado: 'CANCELADA',

  stand_by: 'STAND_BY',
  standby: 'STAND_BY',

  anticipo_registrado: 'ANTICIPO_REGISTRADO',
  anticipo: 'ANTICIPO_REGISTRADO',
};

export const normalizeEstadoKey = (estado: string): string => {
  return String(estado || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .toLowerCase();
};

export const toBackendEstado = (estado: string): string => {
  const key = normalizeEstadoKey(estado);

  if (ESTADO_BACKEND_MAP[key]) {
    return ESTADO_BACKEND_MAP[key];
  }

  return String(estado || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .toUpperCase();
};

export const ESTADOS_REPARACION_VALIDOS = [
  'RECIBIDA',
  'EN_DIAGNOSTICO',
  'ESPERANDO_AUTORIZACION',
  'AUTORIZADA',
  'EN_REPARACION',
  'EN_PROCESO',
  'ESPERANDO_PIEZA',
  'COMPLETADA',
  'ENTREGADA',
  'CANCELADA',
  'STAND_BY',
  'ANTICIPO_REGISTRADO',
];
