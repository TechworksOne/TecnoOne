-- Sprint 1.23 - Ventas por sucursal y ledger idempotente de inventario.
-- Conserva datos y columnas heredadas.

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS sucursal_id BIGINT UNSIGNED NULL AFTER empresa_id;

DROP PROCEDURE IF EXISTS validar_backfill_ventas_sprint_1_23;
DELIMITER $$
CREATE PROCEDURE validar_backfill_ventas_sprint_1_23()
BEGIN
  IF EXISTS (
    SELECT v.empresa_id
    FROM ventas v
    LEFT JOIN sucursales s
      ON s.empresa_id = v.empresa_id AND s.es_principal = 1 AND s.activa = 1
    WHERE v.sucursal_id IS NULL
    GROUP BY v.empresa_id
    HAVING COUNT(DISTINCT s.id) <> 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Backfill ventas ambiguo: empresa sin una única sucursal principal activa';
  END IF;
END$$
DELIMITER ;
CALL validar_backfill_ventas_sprint_1_23();
DROP PROCEDURE IF EXISTS validar_backfill_ventas_sprint_1_23;

UPDATE ventas v
INNER JOIN sucursales s
  ON s.empresa_id = v.empresa_id AND s.es_principal = 1 AND s.activa = 1
SET v.sucursal_id = s.id
WHERE v.sucursal_id IS NULL;

ALTER TABLE ventas MODIFY sucursal_id BIGINT UNSIGNED NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_ventas_empresa_sucursal_id
  ON ventas (empresa_id, sucursal_id, id);
CREATE INDEX IF NOT EXISTS idx_ventas_scope_fecha
  ON ventas (empresa_id, sucursal_id, fecha_venta, id);

DROP PROCEDURE IF EXISTS asegurar_fk_ventas_sucursal_sprint_1_23;
DELIMITER $$
CREATE PROCEDURE asegurar_fk_ventas_sucursal_sprint_1_23()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas'
      AND CONSTRAINT_NAME = 'fk_ventas_sucursal'
  ) THEN
    ALTER TABLE ventas ADD CONSTRAINT fk_ventas_sucursal
      FOREIGN KEY (empresa_id, sucursal_id)
      REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT;
  END IF;
END$$
DELIMITER ;
CALL asegurar_fk_ventas_sucursal_sprint_1_23();
DROP PROCEDURE IF EXISTS asegurar_fk_ventas_sucursal_sprint_1_23;

CREATE TABLE IF NOT EXISTS venta_inventario_aplicaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,
  venta_id INT NOT NULL,
  linea INT NOT NULL,
  tipo_item ENUM('PRODUCTO', 'REPUESTO') NOT NULL,
  referencia_id INT NOT NULL,
  cantidad INT NOT NULL,
  accion ENUM('APLICACION', 'REVERSA') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_venta_inventario_accion
    (empresa_id, sucursal_id, venta_id, linea, accion),
  KEY idx_venta_inventario_venta (empresa_id, sucursal_id, venta_id),
  CONSTRAINT fk_venta_inventario_sucursal
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_venta_inventario_venta
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE RESTRICT,
  CONSTRAINT chk_venta_inventario_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venta_movimientos_financieros (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,
  venta_id INT NOT NULL,
  pago_indice INT NOT NULL,
  accion ENUM('INGRESO', 'REVERSA') NOT NULL,
  metodo VARCHAR(30) NOT NULL,
  monto_centavos BIGINT NOT NULL,
  caja_id BIGINT UNSIGNED NULL,
  referencia VARCHAR(150) NULL,
  usuario_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_venta_movimiento_financiero
    (empresa_id, sucursal_id, venta_id, pago_indice, accion),
  KEY idx_venta_movimiento_financiero_scope
    (empresa_id, sucursal_id, venta_id, accion),
  CONSTRAINT fk_venta_movimiento_financiero_sucursal
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_venta_movimiento_financiero_venta
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_venta_movimiento_financiero_caja
    FOREIGN KEY (caja_id) REFERENCES cajas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_venta_movimiento_financiero_usuario
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_venta_movimiento_financiero_monto CHECK (monto_centavos > 0),
  CONSTRAINT chk_venta_movimiento_financiero_caja CHECK (
    (metodo = 'EFECTIVO' AND caja_id IS NOT NULL)
    OR (metodo <> 'EFECTIVO' AND caja_id IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
