-- Sprint 1.20 - Permiso para consultas consolidadas multisucursal.
-- Idempotente. No modifica tablas operativas.

START TRANSACTION;

INSERT INTO permisos (codigo, modulo, accion, nombre, descripcion) VALUES
(
  'sucursales.contexto_consolidado',
  'Sucursales',
  'contexto_consolidado',
  'Consultar todas las sucursales asignadas',
  'Permite usar el contexto consolidado de solo consulta sobre las sucursales asignadas al usuario'
)
ON DUPLICATE KEY UPDATE
  modulo = VALUES(modulo),
  accion = VALUES(accion),
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion);

-- Compatibilidad inicial: los administradores empresariales reciben el permiso.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT
  e.id,
  r.id,
  p.id
FROM empresas e
CROSS JOIN roles r
CROSS JOIN permisos p
WHERE UPPER(r.nombre) = 'ADMINISTRADOR'
  AND p.codigo = 'sucursales.contexto_consolidado';

COMMIT;
