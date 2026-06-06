-- DEFAULT 1 es temporal para compatibilidad hasta tenantizar ventas/deudores/tarjetas/checkEquipo.

ALTER TABLE caja_chica
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE caja_chica
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE caja_chica
  MODIFY empresa_id INT NOT NULL DEFAULT 1;

CREATE INDEX idx_caja_chica_empresa_id ON caja_chica(empresa_id);

ALTER TABLE caja_chica
  ADD CONSTRAINT fk_caja_chica_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);

ALTER TABLE cuentas_bancarias
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE cuentas_bancarias
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE cuentas_bancarias
  MODIFY empresa_id INT NOT NULL DEFAULT 1;

CREATE INDEX idx_cuentas_bancarias_empresa_id ON cuentas_bancarias(empresa_id);

ALTER TABLE cuentas_bancarias
  ADD CONSTRAINT fk_cuentas_bancarias_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);

ALTER TABLE movimientos_bancarios
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE movimientos_bancarios mb
JOIN cuentas_bancarias cb ON cb.id = mb.cuenta_id
SET mb.empresa_id = cb.empresa_id
WHERE mb.empresa_id IS NULL;

UPDATE movimientos_bancarios
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE movimientos_bancarios
  MODIFY empresa_id INT NOT NULL DEFAULT 1;

CREATE INDEX idx_movimientos_bancarios_empresa_id ON movimientos_bancarios(empresa_id);
CREATE INDEX idx_movimientos_bancarios_empresa_cuenta ON movimientos_bancarios(empresa_id, cuenta_id);

ALTER TABLE movimientos_bancarios
  ADD CONSTRAINT fk_movimientos_bancarios_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);
