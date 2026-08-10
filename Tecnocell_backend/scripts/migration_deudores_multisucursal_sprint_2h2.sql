-- Sprint 2H-2: scope multisucursal autoritativo para deudores.
ALTER TABLE deudores
  ADD COLUMN IF NOT EXISTS sucursal_id BIGINT UNSIGNED NULL AFTER empresa_id;

UPDATE deudores d
INNER JOIN ventas v
  ON v.id = d.referencia_venta_id AND v.empresa_id = d.empresa_id
SET d.sucursal_id = v.sucursal_id
WHERE d.sucursal_id IS NULL AND v.sucursal_id IS NOT NULL;

UPDATE deudores d
INNER JOIN reparaciones r
  ON r.id = d.referencia_reparacion_id AND r.empresa_id = d.empresa_id
SET d.sucursal_id = r.sucursal_id
WHERE d.sucursal_id IS NULL AND r.sucursal_id IS NOT NULL;

UPDATE deudores d
INNER JOIN sucursales s
  ON s.empresa_id = d.empresa_id AND s.es_principal = 1
SET d.sucursal_id = s.id
WHERE d.sucursal_id IS NULL;

DROP PROCEDURE IF EXISTS validar_deudores_sucursal_2h2;
DELIMITER $$
CREATE PROCEDURE validar_deudores_sucursal_2h2()
BEGIN
  IF EXISTS (SELECT 1 FROM deudores WHERE sucursal_id IS NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No se pudo determinar sucursal para todos los deudores';
  END IF;
END$$
DELIMITER ;
CALL validar_deudores_sucursal_2h2();
DROP PROCEDURE validar_deudores_sucursal_2h2;

ALTER TABLE deudores
  MODIFY COLUMN sucursal_id BIGINT UNSIGNED NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deudores_empresa_sucursal_estado
  ON deudores (empresa_id, sucursal_id, estado, id);

SET @fk_deudores_empresa_sucursal_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'deudores'
    AND CONSTRAINT_NAME = 'fk_deudores_empresa_sucursal'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @fk_deudores_empresa_sucursal_sql := IF(
  @fk_deudores_empresa_sucursal_exists = 0,
  'ALTER TABLE deudores ADD CONSTRAINT fk_deudores_empresa_sucursal FOREIGN KEY (empresa_id, sucursal_id) REFERENCES sucursales (empresa_id, id) ON DELETE RESTRICT',
  'SELECT 1'
);

PREPARE stmt_fk_deudores_empresa_sucursal
FROM @fk_deudores_empresa_sucursal_sql;

EXECUTE stmt_fk_deudores_empresa_sucursal;

DEALLOCATE PREPARE stmt_fk_deudores_empresa_sucursal;