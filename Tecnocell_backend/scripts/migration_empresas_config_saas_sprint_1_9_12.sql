-- Sprint 1.9.12 - Configuracion editable de empresa SaaS
-- Migracion idempotente: agrega solo columnas faltantes.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS nombre_comercial VARCHAR(150) NULL AFTER nombre,
  ADD COLUMN IF NOT EXISTS correo VARCHAR(150) NULL AFTER email,
  ADD COLUMN IF NOT EXISTS color_principal VARCHAR(20) NULL DEFAULT '#2563eb' AFTER color_primario,
  ADD COLUMN IF NOT EXISTS moneda_codigo VARCHAR(10) NULL DEFAULT 'GTQ' AFTER color_principal,
  ADD COLUMN IF NOT EXISTS moneda_simbolo VARCHAR(10) NULL DEFAULT 'Q' AFTER moneda_codigo,
  ADD COLUMN IF NOT EXISTS zona_horaria VARCHAR(80) NULL DEFAULT 'America/Guatemala' AFTER moneda_simbolo;

UPDATE empresas
SET
  nombre_comercial = COALESCE(NULLIF(nombre_comercial, ''), nombre),
  correo = COALESCE(NULLIF(correo, ''), email),
  color_principal = COALESCE(NULLIF(color_principal, ''), NULLIF(color_primario, ''), '#2563eb'),
  moneda_codigo = COALESCE(NULLIF(moneda_codigo, ''), 'GTQ'),
  moneda_simbolo = COALESCE(NULLIF(moneda_simbolo, ''), 'Q'),
  zona_horaria = COALESCE(NULLIF(zona_horaria, ''), 'America/Guatemala');
