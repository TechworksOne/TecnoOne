-- Sprint 1.15.1 - Estructura segura de SUPER_ADMIN
-- No promueve usuarios existentes ni elimina datos.

START TRANSACTION;

ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'employee', 'tecnico', 'superadmin')
  NOT NULL DEFAULT 'employee';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tipo_usuario
    ENUM('EMPRESA', 'PLATAFORMA')
    NOT NULL DEFAULT 'EMPRESA'
    AFTER role,
  ADD COLUMN IF NOT EXISTS es_super_admin
    TINYINT(1)
    NOT NULL DEFAULT 0
    AFTER tipo_usuario;

-- Todos los registros existentes permanecen como usuarios empresariales.
UPDATE users
SET tipo_usuario = 'EMPRESA',
    es_super_admin = 0
WHERE tipo_usuario IS NULL
   OR tipo_usuario NOT IN ('EMPRESA', 'PLATAFORMA');

CREATE INDEX IF NOT EXISTS idx_users_tipo_super_admin
  ON users (tipo_usuario, es_super_admin, active);

SET @scope_constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'chk_users_scope'
);
SET @scope_constraint_sql = IF(
  @scope_constraint_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT chk_users_scope CHECK (
    (
      tipo_usuario = ''EMPRESA''
      AND es_super_admin = 0
      AND empresa_id IS NOT NULL
      AND role <> ''superadmin''
    )
    OR
    (
      tipo_usuario = ''PLATAFORMA''
      AND es_super_admin = 1
      AND empresa_id IS NULL
      AND role = ''superadmin''
    )
  )',
  'SELECT 1'
);
PREPARE scope_constraint_stmt FROM @scope_constraint_sql;
EXECUTE scope_constraint_stmt;
DEALLOCATE PREPARE scope_constraint_stmt;

CREATE TABLE IF NOT EXISTS auditoria_super_admin (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  super_admin_id INT NOT NULL,
  accion VARCHAR(80) NOT NULL,
  entidad VARCHAR(80) NOT NULL,
  entidad_id VARCHAR(100) NULL,
  datos_anteriores JSON NULL,
  datos_nuevos JSON NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auditoria_sa_usuario (super_admin_id),
  KEY idx_auditoria_sa_entidad (entidad, entidad_id),
  KEY idx_auditoria_sa_fecha (fecha_creacion),
  CONSTRAINT fk_auditoria_sa_usuario
    FOREIGN KEY (super_admin_id) REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

COMMIT;

-- Validaciones posteriores esperadas.
SELECT
  COUNT(*) AS super_admins_invalidos
FROM users
WHERE es_super_admin = 1
  AND (
    tipo_usuario <> 'PLATAFORMA'
    OR empresa_id IS NOT NULL
    OR role <> 'superadmin'
  );

SELECT
  COUNT(*) AS usuarios_empresa_sin_empresa
FROM users
WHERE tipo_usuario = 'EMPRESA'
  AND empresa_id IS NULL;

-- Creación manual deliberada de un SUPER_ADMIN:
-- 1. Generar el hash con bcrypt usando una herramienta segura.
-- 2. Insertar explícitamente:
-- INSERT INTO users (
--   username, email, password, name, role, tipo_usuario,
--   es_super_admin, empresa_id, active
-- ) VALUES (
--   'superadmin', 'superadmin@example.com', '<BCRYPT_HASH>',
--   'Super Administrador', 'superadmin', 'PLATAFORMA', 1, NULL, 1
-- );
