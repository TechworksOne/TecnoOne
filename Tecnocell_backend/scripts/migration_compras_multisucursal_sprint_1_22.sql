-- Sprint 1.22 - Compras por sucursal e idempotencia de inventario.
-- Conserva datos y columnas heredadas. No ejecuta repartos entre sucursales.

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS sucursal_id BIGINT UNSIGNED NULL AFTER empresa_id;

DROP PROCEDURE IF EXISTS validar_backfill_compras_sprint_1_22;
DELIMITER $$
CREATE PROCEDURE validar_backfill_compras_sprint_1_22()
BEGIN
  IF EXISTS (
    SELECT c.empresa_id
    FROM compras c
    LEFT JOIN sucursales s
      ON s.empresa_id = c.empresa_id
     AND s.es_principal = 1
     AND s.activa = 1
    WHERE c.sucursal_id IS NULL
    GROUP BY c.empresa_id
    HAVING COUNT(DISTINCT s.id) <> 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Backfill compras ambiguo: empresa sin una única sucursal principal activa';
  END IF;
END$$
DELIMITER ;

CALL validar_backfill_compras_sprint_1_22();
DROP PROCEDURE IF EXISTS validar_backfill_compras_sprint_1_22;

UPDATE compras c
INNER JOIN sucursales s
  ON s.empresa_id = c.empresa_id
 AND s.es_principal = 1
 AND s.activa = 1
SET c.sucursal_id = s.id
WHERE c.sucursal_id IS NULL;

ALTER TABLE compras MODIFY sucursal_id BIGINT UNSIGNED NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_compras_empresa_sucursal_id
  ON compras (empresa_id, sucursal_id, id);
CREATE INDEX IF NOT EXISTS idx_compras_scope_fecha
  ON compras (empresa_id, sucursal_id, fecha_compra, id);

DROP PROCEDURE IF EXISTS asegurar_fk_compras_sucursal_sprint_1_22;
DELIMITER $$
CREATE PROCEDURE asegurar_fk_compras_sucursal_sprint_1_22()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'compras'
      AND CONSTRAINT_NAME = 'fk_compras_sucursal'
  ) THEN
    ALTER TABLE compras ADD CONSTRAINT fk_compras_sucursal
      FOREIGN KEY (empresa_id, sucursal_id)
      REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT;
  END IF;
END$$
DELIMITER ;
CALL asegurar_fk_compras_sucursal_sprint_1_22();
DROP PROCEDURE IF EXISTS asegurar_fk_compras_sucursal_sprint_1_22;

CREATE TABLE IF NOT EXISTS compra_inventario_aplicaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,
  compra_id INT NOT NULL,
  compra_item_id INT NOT NULL,
  producto_id INT NOT NULL,
  accion ENUM('RECEPCION', 'ANULACION') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_compra_inventario_aplicacion
    (empresa_id, sucursal_id, compra_item_id, accion),
  KEY idx_compra_inventario_compra
    (empresa_id, sucursal_id, compra_id),
  CONSTRAINT fk_compra_inventario_sucursal
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_compra_inventario_compra
    FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE RESTRICT,
  CONSTRAINT fk_compra_inventario_item
    FOREIGN KEY (compra_item_id) REFERENCES compra_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_compra_inventario_producto
    FOREIGN KEY (empresa_id, producto_id)
    REFERENCES productos(empresa_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existencias de repuestos por sucursal. repuestos.stock se conserva como legado.
CREATE UNIQUE INDEX IF NOT EXISTS uk_repuestos_empresa_id
  ON repuestos (empresa_id, id);

CREATE TABLE IF NOT EXISTS repuesto_existencias (
  empresa_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,
  repuesto_id INT NOT NULL,
  existencia INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, sucursal_id, repuesto_id),
  UNIQUE KEY uk_repuesto_existencia_sucursal (empresa_id, repuesto_id, sucursal_id),
  KEY idx_repuesto_existencias_consulta (empresa_id, repuesto_id, sucursal_id, existencia),
  CONSTRAINT fk_repuesto_existencias_repuesto
    FOREIGN KEY (empresa_id, repuesto_id)
    REFERENCES repuestos(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_repuesto_existencias_sucursal
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_repuesto_existencia_no_negativa CHECK (existencia >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repuesto_movimientos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,
  repuesto_id INT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  cantidad INT NOT NULL,
  existencia_anterior INT NOT NULL,
  existencia_nueva INT NOT NULL,
  nota VARCHAR(500) NULL,
  usuario_id INT NULL,
  compra_id INT NULL,
  compra_item_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_repuesto_movimiento_compra
    (empresa_id, sucursal_id, compra_item_id, tipo),
  KEY idx_repuesto_movimientos_kardex
    (empresa_id, sucursal_id, repuesto_id, created_at, id),
  CONSTRAINT fk_repuesto_movimientos_existencia
    FOREIGN KEY (empresa_id, sucursal_id, repuesto_id)
    REFERENCES repuesto_existencias(empresa_id, sucursal_id, repuesto_id) ON DELETE RESTRICT,
  CONSTRAINT fk_repuesto_movimientos_usuario
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_repuesto_movimientos_compra
    FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE RESTRICT,
  CONSTRAINT fk_repuesto_movimientos_item
    FOREIGN KEY (compra_item_id) REFERENCES compra_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_repuesto_movimiento_stock CHECK (
    cantidad <> 0 AND existencia_anterior >= 0 AND existencia_nueva >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS validar_backfill_repuestos_sprint_1_22;
DELIMITER $$
CREATE PROCEDURE validar_backfill_repuestos_sprint_1_22()
BEGIN
  IF EXISTS (SELECT 1 FROM repuestos WHERE stock < 0) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Backfill repuestos inválido: existen saldos negativos';
  END IF;
  IF EXISTS (
    SELECT r.empresa_id
    FROM repuestos r
    LEFT JOIN sucursales s
      ON s.empresa_id = r.empresa_id AND s.es_principal = 1 AND s.activa = 1
    WHERE NOT EXISTS (
      SELECT 1 FROM repuesto_existencias re
      WHERE re.empresa_id = r.empresa_id AND re.repuesto_id = r.id
    )
    GROUP BY r.empresa_id
    HAVING COUNT(DISTINCT s.id) <> 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Backfill repuestos ambiguo: empresa sin una única sucursal principal activa';
  END IF;
END$$
DELIMITER ;
CALL validar_backfill_repuestos_sprint_1_22();
DROP PROCEDURE IF EXISTS validar_backfill_repuestos_sprint_1_22;

INSERT INTO repuesto_existencias (empresa_id, sucursal_id, repuesto_id, existencia)
SELECT r.empresa_id, s.id, r.id, r.stock
FROM repuestos r
INNER JOIN sucursales s
  ON s.empresa_id = r.empresa_id AND s.es_principal = 1 AND s.activa = 1
WHERE NOT EXISTS (
  SELECT 1 FROM repuesto_existencias re
  WHERE re.empresa_id = r.empresa_id AND re.repuesto_id = r.id
);
