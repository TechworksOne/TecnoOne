-- Sprint 2B
-- Vincula cada movimiento de efectivo con la sesión operativa exacta.
--
-- Los movimientos históricos permanecen con caja_sesion_id NULL.
-- Los movimientos nuevos son validados por backend.
--
-- La FK compuesta garantiza:
-- empresa + sucursal + caja + sesión coherentes.

CREATE UNIQUE INDEX IF NOT EXISTS uk_caja_sesiones_movimiento_scope
  ON caja_sesiones (empresa_id, sucursal_id, caja_id, id);

ALTER TABLE venta_movimientos_financieros
  ADD COLUMN IF NOT EXISTS caja_sesion_id BIGINT UNSIGNED NULL
  AFTER caja_id;

CREATE INDEX IF NOT EXISTS idx_venta_fin_caja_sesion
  ON venta_movimientos_financieros
     (empresa_id, sucursal_id, caja_id, caja_sesion_id);

ALTER TABLE reparacion_movimientos_financieros
  MODIFY COLUMN caja_id BIGINT UNSIGNED NULL;

ALTER TABLE reparacion_movimientos_financieros
  ADD COLUMN IF NOT EXISTS caja_sesion_id BIGINT UNSIGNED NULL
  AFTER caja_id;

CREATE INDEX IF NOT EXISTS idx_reparacion_fin_caja_sesion
  ON reparacion_movimientos_financieros
     (empresa_id, sucursal_id, caja_id, caja_sesion_id);

DROP PROCEDURE IF EXISTS migration_caja_sesion_fks_2b;

DELIMITER //

CREATE PROCEDURE migration_caja_sesion_fks_2b()
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'venta_movimientos_financieros'
      AND CONSTRAINT_NAME = 'fk_venta_fin_caja_sesion'
  ) THEN
    ALTER TABLE venta_movimientos_financieros
      ADD CONSTRAINT fk_venta_fin_caja_sesion
      FOREIGN KEY (
        empresa_id,
        sucursal_id,
        caja_id,
        caja_sesion_id
      )
      REFERENCES caja_sesiones (
        empresa_id,
        sucursal_id,
        caja_id,
        id
      )
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'reparacion_movimientos_financieros'
      AND CONSTRAINT_NAME = 'fk_reparacion_fin_caja_sesion'
  ) THEN
    ALTER TABLE reparacion_movimientos_financieros
      ADD CONSTRAINT fk_reparacion_fin_caja_sesion
      FOREIGN KEY (
        empresa_id,
        sucursal_id,
        caja_id,
        caja_sesion_id
      )
      REFERENCES caja_sesiones (
        empresa_id,
        sucursal_id,
        caja_id,
        id
      )
      ON DELETE RESTRICT;
  END IF;

END//

DELIMITER ;

CALL migration_caja_sesion_fks_2b();

DROP PROCEDURE IF EXISTS migration_caja_sesion_fks_2b;
