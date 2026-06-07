-- Sprint 1.7.3 - Tenant scope para tarjetas de credito y movimientos.
-- Ejecutar una sola vez contra la base de datos TecnoOne.

ALTER TABLE tarjetas_credito
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE tarjetas_credito
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE tarjetas_credito
  MODIFY COLUMN empresa_id INT NOT NULL;

CREATE INDEX idx_tarjetas_credito_empresa_id
  ON tarjetas_credito (empresa_id);

CREATE INDEX idx_tarjetas_credito_empresa_activo
  ON tarjetas_credito (empresa_id, activo);

ALTER TABLE tarjetas_credito
  ADD CONSTRAINT fk_tarjetas_credito_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);

ALTER TABLE tarjeta_credito_movimientos
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE tarjeta_credito_movimientos m
JOIN tarjetas_credito t ON t.id = m.tarjeta_id
SET m.empresa_id = t.empresa_id
WHERE m.empresa_id IS NULL;

UPDATE tarjeta_credito_movimientos
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE tarjeta_credito_movimientos
  MODIFY COLUMN empresa_id INT NOT NULL;

CREATE INDEX idx_tarjeta_credito_movimientos_empresa_id
  ON tarjeta_credito_movimientos (empresa_id);

CREATE INDEX idx_tarjeta_credito_movimientos_empresa_tarjeta
  ON tarjeta_credito_movimientos (empresa_id, tarjeta_id);

ALTER TABLE tarjeta_credito_movimientos
  ADD CONSTRAINT fk_tarjeta_credito_movimientos_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);
