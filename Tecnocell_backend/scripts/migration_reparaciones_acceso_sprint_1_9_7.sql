-- Sprint 1.9.7
-- Agrega campos de acceso al equipo para contrato de recepción y reparación.

ALTER TABLE reparaciones
  ADD COLUMN IF NOT EXISTS acceso_tipo VARCHAR(50) NULL DEFAULT 'ninguno' AFTER patron_contrasena;

ALTER TABLE reparaciones
  ADD COLUMN IF NOT EXISTS acceso_valor VARCHAR(255) NULL AFTER acceso_tipo;

UPDATE reparaciones
SET
  acceso_tipo = CASE
    WHEN patron_contrasena IS NOT NULL AND patron_contrasena <> '' THEN 'PATRON'
    ELSE COALESCE(acceso_tipo, 'ninguno')
  END,
  acceso_valor = CASE
    WHEN patron_contrasena IS NOT NULL AND patron_contrasena <> '' THEN patron_contrasena
    ELSE acceso_valor
  END
WHERE (acceso_tipo IS NULL OR acceso_tipo = 'ninguno')
  AND patron_contrasena IS NOT NULL
  AND patron_contrasena <> '';
