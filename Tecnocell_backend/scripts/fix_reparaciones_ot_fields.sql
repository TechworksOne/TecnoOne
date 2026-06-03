-- TecnoOne - Campos requeridos por órdenes de trabajo / asignación técnica

ALTER TABLE reparaciones
  ADD COLUMN IF NOT EXISTS tecnico_asignado_id INT NULL,
  ADD COLUMN IF NOT EXISTS asignado_por INT NULL,
  ADD COLUMN IF NOT EXISTS fecha_asignacion DATETIME NULL,
  ADD COLUMN IF NOT EXISTS asignado_en DATETIME NULL,
  ADD COLUMN IF NOT EXISTS fecha_entrega_programada DATE NULL AFTER fecha_estimada_entrega;

UPDATE reparaciones
SET fecha_entrega_programada = fecha_estimada_entrega
WHERE fecha_entrega_programada IS NULL
  AND fecha_estimada_entrega IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reparaciones_tecnico_asignado
  ON reparaciones(tecnico_asignado_id);

CREATE INDEX IF NOT EXISTS idx_reparaciones_asignado_por
  ON reparaciones(asignado_por);
