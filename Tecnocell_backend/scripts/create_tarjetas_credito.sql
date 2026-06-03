-- ============================================================
-- Módulo Tarjetas de Crédito
-- Ejecutar en la base de datos tecnocell_web
-- ============================================================

CREATE TABLE IF NOT EXISTS tarjetas_credito (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  banco           VARCHAR(100) NOT NULL,
  alias           VARCHAR(100) NULL,
  ultimos4        CHAR(4)      NOT NULL,
  tasa_interes    DECIMAL(5,2) NOT NULL DEFAULT 0,
  dia_corte       TINYINT      NOT NULL,
  dia_pago        TINYINT      NOT NULL,
  limite_credito  INT          NOT NULL DEFAULT 0,  -- en centavos
  moneda          VARCHAR(10)  NOT NULL DEFAULT 'GTQ',
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  notas           TEXT         NULL,
  created_by      INT          NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tarjeta_credito_movimientos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  tarjeta_id       INT          NOT NULL,
  tipo             ENUM('compra','pago','interes','ajuste','anulacion') NOT NULL,
  monto            INT          NOT NULL DEFAULT 0,  -- en centavos
  descripcion      VARCHAR(255) NULL,
  referencia_tipo  VARCHAR(50)  NULL,
  referencia_id    INT          NULL,
  cuenta_origen_id INT          NULL,
  fecha_movimiento DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_by       INT          NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tarjeta_id) REFERENCES tarjetas_credito(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
