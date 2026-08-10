-- Sprint 2E.2 - Capacidades backend que sustituyen autorización por nombre de rol.
-- Requiere roles empresariales 2E.1. Idempotente y sin producto cartesiano empresas/roles.

INSERT INTO permisos (codigo, modulo, accion, nombre, descripcion) VALUES
  ('ordenes_trabajo.ver_todas', 'Órdenes de trabajo', 'ver_todas', 'Ver todas las órdenes de trabajo', 'Consultar órdenes asignadas a cualquier técnico dentro de las sucursales permitidas'),
  ('costos.ver', 'Productos', 'ver_costos', 'Ver costos', 'Consultar costos, inversión y margen de productos'),
  ('dashboard.ver_financiero', 'Dashboard', 'ver_financiero', 'Ver dashboard financiero', 'Consultar indicadores financieros del dashboard'),
  ('dashboard.ver_ventas', 'Dashboard', 'ver_ventas', 'Ver dashboard de ventas', 'Consultar indicadores comerciales del dashboard'),
  ('dashboard.ver_tecnico', 'Dashboard', 'ver_tecnico', 'Ver dashboard técnico', 'Consultar indicadores técnicos propios del dashboard')
ON DUPLICATE KEY UPDATE
  modulo = VALUES(modulo),
  accion = VALUES(accion),
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion);

-- ADMINISTRADOR era la capacidad histórica para vista global de OT.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT r.empresa_id, r.id, target.id
FROM roles r
INNER JOIN rol_permisos existing ON existing.empresa_id = r.empresa_id AND existing.rol_id = r.id
INNER JOIN permisos base ON base.id = existing.permiso_id AND base.codigo = 'ordenes_trabajo.ver'
INNER JOIN permisos target ON target.codigo = 'ordenes_trabajo.ver_todas'
WHERE UPPER(r.nombre) = 'ADMINISTRADOR';

-- La exposición histórica de costos estaba reservada a ADMINISTRADOR.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT r.empresa_id, r.id, target.id
FROM roles r
INNER JOIN rol_permisos existing ON existing.empresa_id = r.empresa_id AND existing.rol_id = r.id
INNER JOIN permisos base ON base.id = existing.permiso_id AND base.codigo = 'productos.ver'
INNER JOIN permisos target ON target.codigo = 'costos.ver'
WHERE UPPER(r.nombre) = 'ADMINISTRADOR';

-- Las tres vistas conservan la capacidad equivalente previa, pero ahora por permiso efectivo.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT r.empresa_id, r.id, target.id
FROM roles r
INNER JOIN rol_permisos existing ON existing.empresa_id = r.empresa_id AND existing.rol_id = r.id
INNER JOIN permisos base ON base.id = existing.permiso_id AND base.codigo = 'dashboard.ver'
INNER JOIN permisos target ON target.codigo = CASE UPPER(r.nombre)
  WHEN 'ADMINISTRADOR' THEN 'dashboard.ver_financiero'
  WHEN 'VENTAS' THEN 'dashboard.ver_ventas'
  WHEN 'TECNICO' THEN 'dashboard.ver_tecnico'
END
WHERE UPPER(r.nombre) IN ('ADMINISTRADOR', 'VENTAS', 'TECNICO');
