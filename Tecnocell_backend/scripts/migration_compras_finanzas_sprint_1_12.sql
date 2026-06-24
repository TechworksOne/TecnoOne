-- Sprint 1.12 - Control financiero de compras
-- Ejecutar una sola vez contra la base de datos TecnoOne.
--
-- Permite:
-- 1. Guardar el método de pago usado en cada compra.
-- 2. Relacionar la compra con tarjeta o cuenta bancaria.
-- 3. Saber si el movimiento financiero fue aplicado o revertido.
-- 4. Revertir correctamente efectivo, banco o crédito al anular.

ALTER TABLE compras
  ADD COLUMN metodo_pago ENUM(
    'efectivo',
    'transferencia',
    'tarjeta_credito'
  ) NULL AFTER estado,
  ADD COLUMN tarjeta_id INT NULL AFTER metodo_pago,
  ADD COLUMN cuenta_id INT NULL AFTER tarjeta_id,
  ADD COLUMN estado_financiero ENUM(
    'NO_APLICA',
    'APLICADO',
    'REVERTIDO'
  ) NOT NULL DEFAULT 'NO_APLICA' AFTER cuenta_id;

CREATE INDEX idx_compras_empresa_metodo_pago
  ON compras (empresa_id, metodo_pago);

CREATE INDEX idx_compras_empresa_estado_financiero
  ON compras (empresa_id, estado_financiero);

CREATE INDEX idx_compras_tarjeta_id
  ON compras (tarjeta_id);

CREATE INDEX idx_compras_cuenta_id
  ON compras (cuenta_id);

ALTER TABLE compras
  ADD CONSTRAINT fk_compras_tarjeta_credito
  FOREIGN KEY (tarjeta_id)
  REFERENCES tarjetas_credito(id);

ALTER TABLE compras
  ADD CONSTRAINT fk_compras_cuenta_bancaria
  FOREIGN KEY (cuenta_id)
  REFERENCES cuentas_bancarias(id);
