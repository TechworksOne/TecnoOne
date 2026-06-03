-- ============================================================
-- Módulo Deudores / Crédito Interno
-- Ejecutar en la base de datos de Tecnocell
-- ============================================================

CREATE TABLE IF NOT EXISTS `deudores` (
  `id`                       INT(11)     NOT NULL AUTO_INCREMENT,
  `numero_credito`           VARCHAR(20) NOT NULL,
  `cliente_id`               INT(11)     DEFAULT NULL,
  `cliente_nombre`           VARCHAR(150) NOT NULL,
  `cliente_telefono`         VARCHAR(30)  DEFAULT NULL,
  `descripcion`              TEXT         DEFAULT NULL,
  `monto_total`              DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `monto_pagado`             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `saldo_pendiente`          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `fecha_vencimiento`        DATE          DEFAULT NULL,
  `estado`                   ENUM('PENDIENTE','PARCIAL','PAGADO','ANULADO') NOT NULL DEFAULT 'PENDIENTE',
  `referencia_venta_id`      INT(11)       DEFAULT NULL,
  `referencia_reparacion_id` INT(11)       DEFAULT NULL,
  `notas`                    TEXT          DEFAULT NULL,
  `created_by`               VARCHAR(100)  DEFAULT NULL,
  `created_at`               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_deudores_cliente`  (`cliente_id`),
  KEY `idx_deudores_estado`   (`estado`),
  CONSTRAINT `fk_deudores_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trigger para auto-número
DELIMITER $$
CREATE TRIGGER `before_insert_deudores` BEFORE INSERT ON `deudores` FOR EACH ROW
BEGIN
  DECLARE next_num INT;
  SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(numero_credito, '-', -1) AS UNSIGNED)), 0) + 1
    INTO next_num
    FROM deudores
   WHERE numero_credito LIKE CONCAT('CR-', YEAR(CURDATE()), '-%');
  SET NEW.numero_credito = CONCAT('CR-', YEAR(CURDATE()), '-', LPAD(next_num, 4, '0'));
  SET NEW.saldo_pendiente = NEW.monto_total - NEW.monto_pagado;
END$$
DELIMITER ;

CREATE TABLE IF NOT EXISTS `deudores_pagos` (
  `id`          INT(11)       NOT NULL AUTO_INCREMENT,
  `deudor_id`   INT(11)       NOT NULL,
  `monto`       DECIMAL(12,2) NOT NULL,
  `metodo_pago` VARCHAR(30)   NOT NULL DEFAULT 'EFECTIVO',
  `referencia`  VARCHAR(100)  DEFAULT NULL,
  `notas`       TEXT          DEFAULT NULL,
  `realizado_por` VARCHAR(100) DEFAULT NULL,
  `fecha_pago`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pagos_deudor` (`deudor_id`),
  CONSTRAINT `fk_pagos_deudor` FOREIGN KEY (`deudor_id`) REFERENCES `deudores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
