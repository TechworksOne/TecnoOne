ALTER TABLE ventas
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE ventas v
LEFT JOIN clientes c ON c.id = v.cliente_id
SET v.empresa_id = COALESCE(c.empresa_id, 1)
WHERE v.empresa_id IS NULL;

ALTER TABLE ventas
  MODIFY empresa_id INT NOT NULL;

CREATE INDEX idx_ventas_empresa_id ON ventas(empresa_id);
CREATE INDEX idx_ventas_empresa_cliente ON ventas(empresa_id, cliente_id);
CREATE INDEX idx_ventas_empresa_estado ON ventas(empresa_id, estado);
CREATE INDEX idx_ventas_empresa_fecha ON ventas(empresa_id, fecha_venta);

ALTER TABLE ventas
  ADD CONSTRAINT fk_ventas_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);
