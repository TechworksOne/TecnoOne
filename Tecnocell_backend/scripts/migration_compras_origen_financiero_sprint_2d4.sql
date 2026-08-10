-- Sprint 2D.4
-- Origen financiero explícito para compras y ledger de Caja Operativa.
--
-- IMPORTANTE:
-- Las compras históricas permanecen con fuente_financiera = NULL.
-- No se reinterpretan registros legacy.

ALTER TABLE compras
  ADD COLUMN fuente_financiera
    ENUM(
      'CAJA_OPERATIVA',
      'CAJA_CHICA',
      'CUENTA_BANCARIA',
      'TARJETA_CREDITO'
    )
    NULL
    AFTER metodo_pago;

CREATE INDEX idx_compras_fuente_financiera
  ON compras (
    empresa_id,
    sucursal_id,
    fuente_financiera,
    estado_financiero
  );

CREATE TABLE compra_movimientos_financieros (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  empresa_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,

  compra_id INT NOT NULL,

  accion ENUM(
    'EGRESO',
    'REVERSA'
  ) NOT NULL,

  metodo VARCHAR(30) NOT NULL,

  monto_centavos BIGINT NOT NULL,

  caja_id BIGINT UNSIGNED NOT NULL,
  caja_sesion_id BIGINT UNSIGNED NOT NULL,

  referencia VARCHAR(150) NULL,

  usuario_id INT NULL,

  created_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uk_compra_movimiento_financiero (
    empresa_id,
    sucursal_id,
    compra_id,
    accion
  ),

  KEY idx_compra_fin_scope (
    empresa_id,
    sucursal_id,
    compra_id,
    accion
  ),

  KEY idx_compra_fin_caja_sesion (
    empresa_id,
    sucursal_id,
    caja_id,
    caja_sesion_id
  ),

  CONSTRAINT fk_compra_fin_compra_scope
    FOREIGN KEY (
      empresa_id,
      sucursal_id,
      compra_id
    )
    REFERENCES compras (
      empresa_id,
      sucursal_id,
      id
    ),

  CONSTRAINT fk_compra_fin_sucursal
    FOREIGN KEY (
      empresa_id,
      sucursal_id
    )
    REFERENCES sucursales (
      empresa_id,
      id
    ),

  CONSTRAINT fk_compra_fin_caja_sesion
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
    ),

  CONSTRAINT fk_compra_fin_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users (id)
    ON DELETE SET NULL,

  CONSTRAINT chk_compra_fin_monto
    CHECK (monto_centavos > 0),

  CONSTRAINT chk_compra_fin_metodo
    CHECK (metodo = 'EFECTIVO')
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
