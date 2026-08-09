-- Sprint 2A.1
-- Garantiza una caja PRINCIPAL para cada sucursal existente.
-- Idempotente: no duplica cajas que ya tengan codigo PRINCIPAL.

INSERT INTO cajas (
  empresa_id,
  sucursal_id,
  nombre,
  codigo,
  descripcion,
  activa
)
SELECT
  s.empresa_id,
  s.id,
  'Caja principal',
  'PRINCIPAL',
  'Caja principal creada automaticamente para la sucursal',
  1
FROM sucursales s
WHERE NOT EXISTS (
  SELECT 1
  FROM cajas c
  WHERE c.empresa_id = s.empresa_id
    AND c.sucursal_id = s.id
    AND c.codigo = 'PRINCIPAL'
)
ON DUPLICATE KEY UPDATE
  codigo = VALUES(codigo);
