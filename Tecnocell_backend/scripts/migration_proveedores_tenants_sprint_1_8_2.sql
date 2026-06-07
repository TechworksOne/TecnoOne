ALTER TABLE proveedores
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE proveedores
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE proveedores
  MODIFY COLUMN empresa_id INT NOT NULL;

CREATE INDEX idx_proveedores_empresa_id
  ON proveedores (empresa_id);

CREATE INDEX idx_proveedores_empresa_activo
  ON proveedores (empresa_id, activo);

CREATE INDEX idx_proveedores_empresa_nombre
  ON proveedores (empresa_id, nombre);

CREATE INDEX idx_proveedores_id_empresa
  ON proveedores (id, empresa_id);

ALTER TABLE proveedores
  ADD CONSTRAINT fk_proveedores_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);
