-- ============================================================
-- Sprint 1.9.10 - Columnas de cancelación en reparaciones
-- Segura para re-ejecutar en MariaDB/MySQL compatible.
-- ============================================================

ALTER TABLE reparaciones
  ADD COLUMN IF NOT EXISTS fecha_cancelacion DATE NULL,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT NULL,
  ADD COLUMN IF NOT EXISTS devolucion_monto DECIMAL(10,2) NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_retenido DECIMAL(10,2) NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_retencion TEXT NULL,
  ADD COLUMN IF NOT EXISTS anticipo_movimiento_id INT NULL,
  ADD COLUMN IF NOT EXISTS devolucion_movimiento_id INT NULL;
