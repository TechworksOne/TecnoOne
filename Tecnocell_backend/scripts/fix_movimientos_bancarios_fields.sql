-- TecnoOne - Campos requeridos por movimientos bancarios

ALTER TABLE movimientos_bancarios
  ADD COLUMN IF NOT EXISTS confirmado_por INT NULL,
  ADD COLUMN IF NOT EXISTS confirmado_en DATETIME NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_bancarios_confirmado_por
  ON movimientos_bancarios(confirmado_por);
