-- Sprint 1.9.2 - SaaS readiness: datos comerciales/configuracion de empresa
-- Ejecutar sobre la base de datos tecnoone_db.
-- Migracion idempotente para MariaDB 10.6.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS razon_social VARCHAR(180) NULL AFTER nombre,
  ADD COLUMN IF NOT EXISTS nit VARCHAR(30) NULL AFTER razon_social,
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL AFTER direccion,
  ADD COLUMN IF NOT EXISTS color_primario VARCHAR(20) NULL AFTER logo_url,
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE NULL AFTER plan,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE NULL AFTER fecha_inicio;

UPDATE empresas
SET
  razon_social = COALESCE(razon_social, nombre),
  color_primario = COALESCE(color_primario, '#2563eb')
WHERE id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_empresas_estado_plan ON empresas (estado, plan);
