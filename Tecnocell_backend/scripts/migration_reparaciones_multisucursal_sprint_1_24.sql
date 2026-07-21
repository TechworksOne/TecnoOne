-- Sprint 1.24 - Reparaciones multisucursal.
-- Idempotente. Conserva datos heredados. No ejecuta repartos ni borra datos.

-- ── 1. Columna sucursal_id en reparaciones ──────────────────────────────────
ALTER TABLE reparaciones
  ADD COLUMN IF NOT EXISTS sucursal_id BIGINT UNSIGNED NULL AFTER empresa_id;

-- ── 2. Validar backfill seguro ───────────────────────────────────────────────
DROP PROCEDURE IF EXISTS validar_backfill_reparaciones_sprint_1_24;
DELIMITER $$
CREATE PROCEDURE validar_backfill_reparaciones_sprint_1_24()
BEGIN
  IF EXISTS (
    SELECT r.empresa_id
    FROM reparaciones r
    LEFT JOIN sucursales s
      ON s.empresa_id = r.empresa_id
     AND s.es_principal = 1
     AND s.activa = 1
    WHERE r.sucursal_id IS NULL
    GROUP BY r.empresa_id
    HAVING COUNT(DISTINCT s.id) <> 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Backfill reparaciones ambiguo: empresa sin una unica sucursal principal activa';
  END IF;
END$$
DELIMITER ;
CALL validar_backfill_reparaciones_sprint_1_24();
DROP PROCEDURE IF EXISTS validar_backfill_reparaciones_sprint_1_24;

-- ── 3. Backfill: asignar sucursal principal a históricas ────────────────────
UPDATE reparaciones r
INNER JOIN sucursales s
  ON s.empresa_id = r.empresa_id
 AND s.es_principal = 1
 AND s.activa = 1
SET r.sucursal_id = s.id
WHERE r.sucursal_id IS NULL;

-- ── 4. NOT NULL + índices de consulta ───────────────────────────────────────
ALTER TABLE reparaciones MODIFY sucursal_id BIGINT UNSIGNED NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reparaciones_scope
  ON reparaciones (empresa_id, sucursal_id);
CREATE INDEX IF NOT EXISTS idx_reparaciones_scope_fecha
  ON reparaciones (empresa_id, sucursal_id, fecha_ingreso, id);

-- ── 5. FK empresa+sucursal idempotente ───────────────────────────────────────
DROP PROCEDURE IF EXISTS asegurar_fk_reparaciones_suc_1_24;
DELIMITER $$
CREATE PROCEDURE asegurar_fk_reparaciones_suc_1_24()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'reparaciones'
      AND CONSTRAINT_NAME = 'fk_reparaciones_sucursal'
  ) THEN
    ALTER TABLE reparaciones
      ADD CONSTRAINT fk_reparaciones_sucursal
      FOREIGN KEY (empresa_id, sucursal_id)
      REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT;
  END IF;
END$$
DELIMITER ;
CALL asegurar_fk_reparaciones_suc_1_24();
DROP PROCEDURE IF EXISTS asegurar_fk_reparaciones_suc_1_24;

-- ── 6. reparacion_repuestos: añadir empresa_id + sucursal_id (trazabilidad) ──
ALTER TABLE reparacion_repuestos
  ADD COLUMN IF NOT EXISTS empresa_id  INT             NULL AFTER id,
  ADD COLUMN IF NOT EXISTS sucursal_id BIGINT UNSIGNED NULL AFTER empresa_id;

UPDATE reparacion_repuestos rr
INNER JOIN reparaciones r ON r.id = rr.reparacion_id
SET rr.empresa_id  = r.empresa_id,
    rr.sucursal_id = r.sucursal_id
WHERE rr.empresa_id IS NULL
   OR rr.sucursal_id IS NULL;

-- ── 7. Ledger idempotente: inventario de reparaciones ───────────────────────
-- Garantiza que cada consumo/reversión de repuesto se aplique una sola vez.
CREATE TABLE IF NOT EXISTS reparacion_inventario_aplicaciones (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id    INT             NOT NULL,
  sucursal_id   BIGINT UNSIGNED NOT NULL,
  reparacion_id VARCHAR(50)     NOT NULL,
  repuesto_id   INT             NOT NULL,
  linea         INT             NOT NULL DEFAULT 0,
  cantidad      INT             NOT NULL,
  accion        ENUM('APLICACION', 'REVERSA') NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reparacion_inv
    (empresa_id, sucursal_id, reparacion_id, repuesto_id, linea, accion),
  KEY idx_reparacion_inv_rep (empresa_id, sucursal_id, reparacion_id),
  CONSTRAINT fk_reparacion_inv_suc
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 8. Ledger idempotente: movimientos financieros de reparaciones ───────────
-- Garantiza que cada pago/reversión financiera se aplique una sola vez.
CREATE TABLE IF NOT EXISTS reparacion_movimientos_financieros (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id    INT             NOT NULL,
  sucursal_id   BIGINT UNSIGNED NOT NULL,
  reparacion_id VARCHAR(50)     NOT NULL,
  pago_indice   INT             NOT NULL,
  accion        ENUM('INGRESO', 'REVERSA') NOT NULL,
  metodo        VARCHAR(30)     NOT NULL,
  monto_centavos INT            NOT NULL,
  caja_id       INT             NULL,
  referencia    VARCHAR(100)    NULL,
  usuario_id    INT             NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reparacion_fin
    (empresa_id, sucursal_id, reparacion_id, pago_indice, accion),
  KEY idx_reparacion_fin_rep (empresa_id, sucursal_id, reparacion_id),
  CONSTRAINT fk_reparacion_fin_suc
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 9. Ledger idempotente de inventario para regalías ───────────────────────
-- Registra productos o repuestos entregados como regalo durante una reparación.
CREATE TABLE IF NOT EXISTS reparacion_regalia_inventario_aplicaciones (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id    INT             NOT NULL,
  sucursal_id   BIGINT UNSIGNED NOT NULL,
  reparacion_id VARCHAR(50)     NOT NULL,
  tipo_item     ENUM('PRODUCTO', 'REPUESTO') NOT NULL,
  item_id       INT             NOT NULL,
  linea         INT             NOT NULL DEFAULT 0,
  cantidad      INT             NOT NULL,
  accion        ENUM('APLICACION', 'REVERSA') NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reparacion_regalia_inv (
    empresa_id,
    sucursal_id,
    reparacion_id,
    tipo_item,
    item_id,
    linea,
    accion
  ),
  KEY idx_reparacion_regalia_inv (
    empresa_id,
    sucursal_id,
    reparacion_id
  ),
  CONSTRAINT fk_reparacion_regalia_inv_suc
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_reparacion_regalia_cantidad
    CHECK (cantidad > 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
