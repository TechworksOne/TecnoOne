ALTER TABLE clientes
  MODIFY COLUMN telefono VARCHAR(15) NULL;

ALTER TABLE compras
  MODIFY COLUMN proveedor_telefono VARCHAR(15) NULL;

ALTER TABLE cotizaciones
  MODIFY COLUMN cliente_telefono VARCHAR(15) NULL;

ALTER TABLE deudores
  MODIFY COLUMN cliente_telefono VARCHAR(15) NULL;

ALTER TABLE empresas
  MODIFY COLUMN telefono VARCHAR(15) NULL;

ALTER TABLE proveedores
  MODIFY COLUMN telefono VARCHAR(15) NULL;

ALTER TABLE reparaciones
  MODIFY COLUMN cliente_telefono VARCHAR(15) NULL;

ALTER TABLE users
  MODIFY COLUMN telefono VARCHAR(15) NULL;

ALTER TABLE user_profiles
  MODIFY COLUMN telefono VARCHAR(15) NULL;

ALTER TABLE ventas
  MODIFY COLUMN cliente_telefono VARCHAR(15) NULL;
