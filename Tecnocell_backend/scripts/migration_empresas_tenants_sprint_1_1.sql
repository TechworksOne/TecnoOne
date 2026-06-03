-- Sprint 1.1 - Modelo base empresas/tenants para TecnoOne SaaS
-- Objetivo:
-- 1. Crear tabla empresas.
-- 2. Crear empresa demo inicial.
-- 3. Agregar empresa_id nullable a users.
-- 4. Asociar usuarios actuales a TecnoOne Demo, excepto superadmin global si existe.
-- 5. No romper login ni módulos actuales.

CREATE TABLE IF NOT EXISTS empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'activa',
  plan VARCHAR(50) NOT NULL DEFAULT 'demo',
  telefono VARCHAR(50) NULL,
  email VARCHAR(150) NULL,
  direccion VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_empresas_slug (slug),
  KEY idx_empresas_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO empresas (
  nombre,
  slug,
  estado,
  plan,
  telefono,
  email,
  direccion
)
VALUES (
  'TecnoOne Demo',
  'tecnoone-demo',
  'activa',
  'demo',
  NULL,
  NULL,
  NULL
)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  estado = VALUES(estado),
  plan = VALUES(plan),
  updated_at = CURRENT_TIMESTAMP;

-- Agregar empresa_id a users solo si todavía no existe.
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'empresa_id'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE users ADD COLUMN empresa_id INT NULL AFTER role',
  'SELECT "empresa_id already exists" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Crear índice solo si todavía no existe.
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_empresa_id'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_users_empresa_id ON users(empresa_id)',
  'SELECT "idx_users_empresa_id already exists" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill:
-- Usuarios normales quedan asociados a TecnoOne Demo.
-- Superadmin global queda con empresa_id NULL si el rol está claramente identificado.
UPDATE users u
JOIN empresas e ON e.slug = 'tecnoone-demo'
SET u.empresa_id = e.id
WHERE u.empresa_id IS NULL
  AND (
    u.role IS NULL
    OR LOWER(REPLACE(REPLACE(u.role, ' ', '_'), '-', '_')) NOT IN (
      'superadmin',
      'super_admin',
      'super_administrador',
      'super_administrador_global'
    )
  );

-- Validación rápida.
SELECT id, nombre, slug, estado, plan, created_at, updated_at
FROM empresas
WHERE slug = 'tecnoone-demo';

SELECT id, username, email, name, role, active, empresa_id
FROM users
ORDER BY id;
