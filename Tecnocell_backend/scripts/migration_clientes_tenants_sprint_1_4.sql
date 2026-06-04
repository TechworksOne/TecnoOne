-- Sprint 1.4 - Tenant scope para clientes
-- Objetivo:
-- 1. Agregar clientes.empresa_id.
-- 2. Asociar clientes existentes a la empresa demo inicial (id = 1).
-- 3. Dejar empresa_id como NOT NULL para aislamiento multiempresa.
-- 4. Crear indice y llave foranea hacia empresas(id).
-- 5. No borrar datos existentes.

-- Agregar empresa_id a clientes solo si todavia no existe.
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clientes'
    AND COLUMN_NAME = 'empresa_id'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE clientes ADD COLUMN empresa_id INT NULL AFTER id',
  'SELECT "clientes.empresa_id already exists" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: los 6 clientes actuales pertenecen a la empresa demo.
UPDATE clientes
SET empresa_id = 1
WHERE empresa_id IS NULL;

-- En Sprint 1.4 clientes siempre debe tener empresa asignada.
ALTER TABLE clientes MODIFY empresa_id INT NOT NULL;

-- Crear indice para filtros por tenant solo si todavia no existe.
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clientes'
    AND INDEX_NAME = 'idx_clientes_empresa_id'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_clientes_empresa_id ON clientes (empresa_id)',
  'SELECT "idx_clientes_empresa_id already exists" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Crear llave foranea hacia empresas(id) solo si todavia no existe.
SET @fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clientes'
    AND CONSTRAINT_NAME = 'fk_clientes_empresa'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE clientes ADD CONSTRAINT fk_clientes_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)',
  'SELECT "fk_clientes_empresa already exists" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Validacion rapida.
SELECT empresa_id, COUNT(*) AS total_clientes
FROM clientes
GROUP BY empresa_id
ORDER BY empresa_id;
