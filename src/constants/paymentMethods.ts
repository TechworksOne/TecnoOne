// ================================================================
// Métodos de pago centralizados para TECNOCELL
// Usar estos valores en todo el sistema (frontend + backend)
// ================================================================

export const PAYMENT_METHODS = [
  { value: 'EFECTIVO',      label: 'Efectivo',       icon: '💵' },
  { value: 'TARJETA_BAC',   label: 'Tarjeta BAC',    icon: '💳' },
  { value: 'TARJETA_NEONET',label: 'Tarjeta Neonet', icon: '💳' },
  { value: 'TARJETA_OTRA',  label: 'Otra tarjeta',   icon: '💳' },
  { value: 'TRANSFERENCIA', label: 'Transferencia',  icon: '🏦' },
  { value: 'MIXTO',         label: 'Pago mixto',     icon: '💰' },
] as const;

/** Solo los métodos seleccionables en una fila de pago mixto */
export const SINGLE_PAYMENT_METHODS = PAYMENT_METHODS.filter(
  (m) => m.value !== 'MIXTO'
);

/** Obtener el label visible a partir del valor interno */
export function getPaymentLabel(value: string): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

/** Obtener el emoji/icono a partir del valor interno */
export function getPaymentIcon(value: string): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.icon ?? '💵';
}

/**
 * Derivar `pos_seleccionado` a partir del método de pago.
 * Usado internamente para rutar el movimiento bancario al banco correcto.
 */
export function getPosFromMethod(method: string): string | null {
  switch (method) {
    case 'TARJETA_BAC':    return 'POS BAC';
    case 'TARJETA_NEONET': return 'POS NEONET';
    default:               return null;
  }
}

/** Retorna true si el método es cualquier tipo de tarjeta */
export function isCardMethod(method: string): boolean {
  return method === 'TARJETA_BAC' || method === 'TARJETA_NEONET' || method === 'TARJETA_OTRA' || method === 'TARJETA';
}
