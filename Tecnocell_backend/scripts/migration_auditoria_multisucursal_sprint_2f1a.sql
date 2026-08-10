-- Sprint 2F.1A - Auditoría empresarial multisucursal.
-- Idempotente y compatible con los registros históricos existentes.

ALTER TABLE auditoria_logs
  ADD COLUMN IF NOT EXISTS sucursal_id BIGINT UNSIGNED NULL AFTER empresa_id,
  ADD COLUMN IF NOT EXISTS metadata JSON NULL AFTER datos_nuevos;

CREATE INDEX IF NOT EXISTS idx_auditoria_empresa_sucursal_fecha
  ON auditoria_logs (empresa_id, sucursal_id, created_at);

-- No se agrega FK a sucursales: un log histórico debe sobrevivir a cualquier
-- mantenimiento o eliminación futura de la sucursal referenciada.
-- La tabla es append-only; no existen consumidores actuales que la actualicen
-- o eliminen. Los triggers se recrean para conservar idempotencia.
DROP TRIGGER IF EXISTS trg_auditoria_logs_append_only_update;
DROP TRIGGER IF EXISTS trg_auditoria_logs_append_only_delete;

DELIMITER $$

CREATE TRIGGER trg_auditoria_logs_append_only_update
BEFORE UPDATE ON auditoria_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'auditoria_logs es append-only: UPDATE no permitido';
END$$

CREATE TRIGGER trg_auditoria_logs_append_only_delete
BEFORE DELETE ON auditoria_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'auditoria_logs es append-only: DELETE no permitido';
END$$

DELIMITER ;
