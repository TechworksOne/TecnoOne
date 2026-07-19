-- Sprint 1.19 - Limite de sucursales configurable por empresa.
-- Idempotente. Cuenta todas las sucursales, incluidas las inactivas.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS limite_sucursales INT NULL AFTER plan;

UPDATE empresas e
LEFT JOIN (
  SELECT empresa_id, COUNT(*) AS total
  FROM sucursales
  GROUP BY empresa_id
) s ON s.empresa_id = e.id
SET e.limite_sucursales = GREATEST(1, COALESCE(s.total, 0))
WHERE e.limite_sucursales IS NULL
   OR e.limite_sucursales < GREATEST(1, COALESCE(s.total, 0));

ALTER TABLE empresas
  MODIFY COLUMN limite_sucursales INT NOT NULL DEFAULT 1;

ALTER TABLE empresas
  ADD CONSTRAINT IF NOT EXISTS chk_empresas_limite_sucursales
  CHECK (limite_sucursales >= 1);

