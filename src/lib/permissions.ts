/** Roles del sistema usados como clasificación funcional o presentación. */
export const ROLES = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  TECNICO: 'TECNICO',
  VENTAS: 'VENTAS',
} as const;

/** Catálogo frontend de permisos existentes en el backend. */
export const PERMISSIONS = {
  COMPRAS_VER: 'compras.ver',
  VENTAS_VER: 'ventas.ver',
  VENTAS_CREAR: 'ventas.crear',
  REPARACIONES_VER: 'reparaciones.ver',
  USUARIOS_ADMINISTRAR: 'usuarios.administrar',
  PERMISOS_ADMINISTRAR: 'permisos.administrar',
  EMPRESA_EDITAR: 'empresa.editar',
  AUDITORIA_VER: 'auditoria.ver',
  REPORTES_VER: 'reportes.ver',
  CAJA_VER: 'caja.ver',
  CAJAS_VER: 'cajas.ver',
  COSTOS_VER: 'costos.ver',
  ORDENES_TRABAJO_VER_TODAS: 'ordenes_trabajo.ver_todas',
  REPARACIONES_ASIGNAR_TECNICO: 'reparaciones.asignar_tecnico',
  FLUJO_REPARACIONES_EDITAR: 'flujo_reparaciones.editar',
  AGENDA_EDITAR: 'agenda.editar',
  BANCOS_ADMINISTRAR: 'bancos.administrar',
  TARJETAS_VER: 'tarjetas.ver',
  TARJETAS_ADMINISTRAR: 'tarjetas.administrar',
} as const;

/** Helpers de roles: no conceden capacidades empresariales. */
export function hasRole(roles: string[] | undefined, role: string): boolean {
  return Array.isArray(roles) && roles.includes(role);
}

export function hasAnyRole(roles: string[] | undefined, allowedRoles: string[]): boolean {
  return Array.isArray(roles) && allowedRoles.some(role => roles.includes(role));
}
