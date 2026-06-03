-- TecnoOne - Fix de asignación de técnico en reparaciones

ALTER TABLE reparaciones
  ADD COLUMN IF NOT EXISTS tecnico_asignado_id INT NULL,
  ADD COLUMN IF NOT EXISTS asignado_por INT NULL,
  ADD COLUMN IF NOT EXISTS fecha_asignacion DATETIME NULL,
  ADD COLUMN IF NOT EXISTS asignado_en DATETIME NULL;

CREATE INDEX IF NOT EXISTS idx_reparaciones_tecnico_asignado
  ON reparaciones(tecnico_asignado_id);

CREATE INDEX IF NOT EXISTS idx_reparaciones_asignado_por
  ON reparaciones(asignado_por);
