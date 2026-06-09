-- ============================================================
-- Sprint 1.9.10 - Firmas en reparaciones
-- Segura para re-ejecutar en MariaDB/MySQL compatible.
-- ============================================================

ALTER TABLE reparaciones
  ADD COLUMN IF NOT EXISTS firma_cliente_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS firma_receptor_url VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS firma_estado VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS firmado_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS firmado_en DATETIME NULL,
  ADD COLUMN IF NOT EXISTS firmado_por_usuario_id INT NULL;
