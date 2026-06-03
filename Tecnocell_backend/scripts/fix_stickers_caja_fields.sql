-- TecnoOne - Campos requeridos por stickers y caja chica

ALTER TABLE stickers_garantia
  ADD COLUMN IF NOT EXISTS lote_id INT NULL,
  ADD COLUMN IF NOT EXISTS tipo_garantia VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS dias_garantia INT NULL,
  ADD COLUMN IF NOT EXISTS notas TEXT NULL,
  ADD COLUMN IF NOT EXISTS activo TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE caja_chica
  ADD COLUMN IF NOT EXISTS confirmado_por INT NULL,
  ADD COLUMN IF NOT EXISTS confirmado_en DATETIME NULL;

CREATE INDEX IF NOT EXISTS idx_stickers_garantia_lote_id
  ON stickers_garantia(lote_id);

CREATE INDEX IF NOT EXISTS idx_caja_chica_confirmado_por
  ON caja_chica(confirmado_por);
