-- Sprint 1.16.1
-- Endurecimiento uniforme de permisos empresariales.
-- Migración idempotente.

INSERT INTO permisos (
  codigo,
  modulo,
  accion,
  nombre,
  descripcion
) VALUES
(
  'productos.administrar',
  'Productos',
  'administrar',
  'Administrar productos',
  'Crear, editar, ajustar stock y desactivar productos'
),
(
  'repuestos.administrar',
  'Repuestos',
  'administrar',
  'Administrar repuestos',
  'Crear, editar, eliminar y registrar movimientos de repuestos'
),
(
  'flujo_reparaciones.editar',
  'Flujo de reparaciones',
  'editar',
  'Gestionar flujo de reparaciones',
  'Actualizar estados, técnicos, prioridades y reingresos por garantía'
),
(
  'agenda.editar',
  'Agenda',
  'editar',
  'Gestionar agenda',
  'Crear, editar y eliminar eventos de agenda'
),
(
  'stickers.administrar',
  'Stickers',
  'administrar',
  'Administrar stickers',
  'Crear lotes, asignar, anular y liberar stickers'
),
(
  'proveedores.administrar',
  'Proveedores',
  'administrar',
  'Administrar proveedores',
  'Crear, editar y desactivar proveedores'
),
(
  'deudores.administrar',
  'Deudores',
  'administrar',
  'Administrar deudores',
  'Crear deudas, registrar pagos y anular registros'
),
(
  'tarjetas.ver',
  'Tarjetas de crédito',
  'ver',
  'Ver tarjetas de crédito',
  'Consultar tarjetas y movimientos'
),
(
  'tarjetas.administrar',
  'Tarjetas de crédito',
  'administrar',
  'Administrar tarjetas de crédito',
  'Crear, editar, desactivar, pagar y ajustar tarjetas'
),
(
  'catalogos.administrar',
  'Catálogos',
  'administrar',
  'Administrar catálogos',
  'Gestionar categorías, marcas, líneas y modelos'
)
ON DUPLICATE KEY UPDATE
  modulo = VALUES(modulo),
  accion = VALUES(accion),
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion);

-- Conserva para todos los roles actualmente utilizados los módulos que
-- antes permitían escritura a cualquier usuario autenticado.
INSERT IGNORE INTO rol_permisos (
  empresa_id,
  rol_id,
  permiso_id
)
SELECT DISTINCT
  u.empresa_id,
  ur.role_id,
  p.id
FROM users u
INNER JOIN user_roles ur
  ON ur.user_id = u.id
INNER JOIN permisos p
  ON p.codigo IN (
    'agenda.editar',
    'flujo_reparaciones.editar',
    'repuestos.administrar'
  )
WHERE u.empresa_id IS NOT NULL;

-- Todo ADMINISTRADOR conserva acceso completo a los permisos nuevos,
-- incluso en empresas que todavía no tengan otros usuarios creados.
INSERT IGNORE INTO rol_permisos (
  empresa_id,
  rol_id,
  permiso_id
)
SELECT
  e.id,
  r.id,
  p.id
FROM empresas e
CROSS JOIN roles r
CROSS JOIN permisos p
WHERE UPPER(r.nombre) = 'ADMINISTRADOR'
  AND p.codigo IN (
    'productos.administrar',
    'repuestos.administrar',
    'flujo_reparaciones.editar',
    'agenda.editar',
    'stickers.administrar',
    'proveedores.administrar',
    'deudores.administrar',
    'tarjetas.ver',
    'tarjetas.administrar',
    'catalogos.administrar'
  );

-- VENTAS conserva la capacidad previa de crear y modificar productos.
INSERT IGNORE INTO rol_permisos (
  empresa_id,
  rol_id,
  permiso_id
)
SELECT DISTINCT
  u.empresa_id,
  r.id,
  p.id
FROM users u
INNER JOIN user_roles ur
  ON ur.user_id = u.id
INNER JOIN roles r
  ON r.id = ur.role_id
 AND UPPER(r.nombre) = 'VENTAS'
INNER JOIN permisos p
  ON p.codigo = 'productos.administrar'
WHERE u.empresa_id IS NOT NULL;
