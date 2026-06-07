-- Sprint 1.8.1 - Tenant scope para compras, items y series.
-- Ejecutar una sola vez contra la base de datos TecnoOne.
-- Proveedores se tenantiza en Sprint 1.8.2; este backfill usa fallback seguro.

ALTER TABLE compras
  ADD COLUMN empresa_id INT NULL AFTER id;

SET @has_proveedores_empresa_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'proveedores'
    AND COLUMN_NAME = 'empresa_id'
);

SET @sql_backfill_compras_proveedor := IF(
  @has_proveedores_empresa_id > 0,
  'UPDATE compras c
   JOIN proveedores p ON p.id = c.proveedor_id
   SET c.empresa_id = p.empresa_id
   WHERE c.empresa_id IS NULL
     AND c.proveedor_id IS NOT NULL
     AND p.empresa_id IS NOT NULL',
  'SELECT 1'
);

PREPARE stmt_backfill_compras_proveedor FROM @sql_backfill_compras_proveedor;
EXECUTE stmt_backfill_compras_proveedor;
DEALLOCATE PREPARE stmt_backfill_compras_proveedor;

UPDATE compras
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE compras
  MODIFY COLUMN empresa_id INT NOT NULL;

CREATE INDEX idx_compras_empresa_id
  ON compras (empresa_id);

CREATE INDEX idx_compras_empresa_fecha
  ON compras (empresa_id, fecha_compra);

CREATE INDEX idx_compras_empresa_estado
  ON compras (empresa_id, estado);

CREATE INDEX idx_compras_empresa_tipo
  ON compras (empresa_id, tipo);

CREATE INDEX idx_compras_empresa_proveedor
  ON compras (empresa_id, proveedor_id);

ALTER TABLE compras
  ADD CONSTRAINT fk_compras_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);

ALTER TABLE compra_items
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE compra_items ci
JOIN compras c ON c.id = ci.compra_id
SET ci.empresa_id = c.empresa_id
WHERE ci.empresa_id IS NULL;

UPDATE compra_items
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE compra_items
  MODIFY COLUMN empresa_id INT NOT NULL;

CREATE INDEX idx_compra_items_empresa_id
  ON compra_items (empresa_id);

CREATE INDEX idx_compra_items_empresa_compra
  ON compra_items (empresa_id, compra_id);

CREATE INDEX idx_compra_items_empresa_producto
  ON compra_items (empresa_id, producto_id);

ALTER TABLE compra_items
  ADD CONSTRAINT fk_compra_items_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);

ALTER TABLE producto_series
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE producto_series ps
JOIN compras c ON c.id = ps.compra_id
SET ps.empresa_id = c.empresa_id
WHERE ps.empresa_id IS NULL
  AND ps.compra_id IS NOT NULL;

UPDATE producto_series ps
JOIN compra_items ci ON ci.id = ps.compra_item_id
SET ps.empresa_id = ci.empresa_id
WHERE ps.empresa_id IS NULL
  AND ps.compra_item_id IS NOT NULL;

UPDATE producto_series
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE producto_series
  MODIFY COLUMN empresa_id INT NOT NULL;

CREATE INDEX idx_producto_series_empresa_id
  ON producto_series (empresa_id);

CREATE INDEX idx_producto_series_empresa_producto
  ON producto_series (empresa_id, producto_id);

CREATE INDEX idx_producto_series_empresa_compra
  ON producto_series (empresa_id, compra_id);

CREATE INDEX idx_producto_series_empresa_compra_item
  ON producto_series (empresa_id, compra_item_id);

ALTER TABLE producto_series
  ADD CONSTRAINT fk_producto_series_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);
