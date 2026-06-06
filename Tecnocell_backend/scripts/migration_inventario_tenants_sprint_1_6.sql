ALTER TABLE productos
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE productos
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE productos
  MODIFY empresa_id INT NOT NULL;

CREATE INDEX idx_productos_empresa_id ON productos(empresa_id);

ALTER TABLE productos
  ADD CONSTRAINT fk_productos_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);

ALTER TABLE repuestos
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE repuestos
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE repuestos
  MODIFY empresa_id INT NOT NULL;

CREATE INDEX idx_repuestos_empresa_id ON repuestos(empresa_id);

ALTER TABLE repuestos
  ADD CONSTRAINT fk_repuestos_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);
