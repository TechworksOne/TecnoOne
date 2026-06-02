/**
 * Obtiene el nombre completo de un cliente desde cualquier forma en que llegue.
 * Soporta objetos del backend (nombre/apellido) y del frontend (firstName/lastName).
 */
export const getNombreCompletoCliente = (cliente: any): string => {
  if (!cliente) return 'Cliente';

  // 1. nombre_completo ya calculado
  if (cliente.nombre_completo && cliente.nombre_completo.trim()) {
    return cliente.nombre_completo.replace(/\s+/g, ' ').trim();
  }

  // 2. nombre + apellido (campos BD)
  const fromBD = [cliente.nombre, cliente.apellido]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (fromBD) return fromBD;

  // 3. firstName + lastName (campos frontend)
  const fromFE = [cliente.firstName, cliente.lastName]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (fromFE) return fromFE;

  // 4. name (campo compuesto, si ya viene del store/servicio)
  if (cliente.name && cliente.name.trim()) {
    return cliente.name.replace(/\s+/g, ' ').trim();
  }

  // 5. cliente_nombre (campo histórico desnormalizado)
  if (cliente.cliente_nombre && cliente.cliente_nombre.trim()) {
    return cliente.cliente_nombre.replace(/\s+/g, ' ').trim();
  }

  // 6. fallback: teléfono
  if (cliente.telefono || cliente.phone) {
    return cliente.telefono || cliente.phone;
  }

  return 'Cliente';
};
