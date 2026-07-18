-- Sprint 1.19 Fase 1 - Base multi-sucursal SaaS
-- Idempotente. No altera tablas operativas ni el contexto de autenticacion.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS sucursales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  direccion VARCHAR(255) NULL,
  telefono VARCHAR(50) NULL,
  email VARCHAR(150) NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  principal_unica TINYINT
    AS (CASE WHEN es_principal = 1 THEN 1 ELSE NULL END) PERSISTENT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sucursales_empresa_codigo (empresa_id, codigo),
  UNIQUE KEY uk_sucursales_empresa_id (empresa_id, id),
  UNIQUE KEY uk_sucursales_principal (empresa_id, principal_unica),
  KEY idx_sucursales_empresa_estado (empresa_id, activa),
  CONSTRAINT fk_sucursales_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT chk_sucursales_activa CHECK (activa IN (0, 1)),
  CONSTRAINT chk_sucursales_principal CHECK (es_principal IN (0, 1))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Permite que la relacion usuario-sucursal valide tambien el tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_id_empresa
  ON users (id, empresa_id);

CREATE TABLE IF NOT EXISTS usuario_sucursales (
  usuario_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,
  empresa_id INT NOT NULL,
  es_predeterminada TINYINT(1) NOT NULL DEFAULT 0,
  predeterminada_unica TINYINT
    AS (CASE WHEN es_predeterminada = 1 THEN 1 ELSE NULL END) PERSISTENT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, sucursal_id),
  UNIQUE KEY uk_usuario_sucursal_predeterminada
    (usuario_id, predeterminada_unica),
  KEY idx_usuario_sucursales_empresa (empresa_id, usuario_id),
  KEY idx_usuario_sucursales_sucursal (empresa_id, sucursal_id),
  CONSTRAINT fk_usuario_sucursales_usuario
    FOREIGN KEY (usuario_id, empresa_id)
    REFERENCES users(id, empresa_id) ON DELETE CASCADE,
  CONSTRAINT fk_usuario_sucursales_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_usuario_sucursales_sucursal_empresa
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_usuario_sucursal_predeterminada
    CHECK (es_predeterminada IN (0, 1))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO sucursales (
  empresa_id, codigo, nombre, direccion, telefono, email, activa, es_principal
)
SELECT
  e.id, 'principal', COALESCE(NULLIF(e.nombre_comercial, ''), e.nombre),
  e.direccion, e.telefono, e.email, 1, 1
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM sucursales s WHERE s.empresa_id = e.id
);

-- Repara ejecuciones parciales: elige primero una sucursal activa y, si no
-- existe, activa la de menor id. Solo actua cuando no hay principal.
UPDATE sucursales s
INNER JOIN (
  SELECT
    empresa_id,
    COALESCE(
      MIN(CASE WHEN activa = 1 THEN id END),
      MIN(id)
    ) AS sucursal_id
  FROM sucursales
  GROUP BY empresa_id
  HAVING SUM(es_principal = 1) = 0
) candidata
  ON candidata.empresa_id = s.empresa_id
 AND candidata.sucursal_id = s.id
SET s.es_principal = 1,
    s.activa = 1;

INSERT INTO usuario_sucursales (
  usuario_id, sucursal_id, empresa_id, es_predeterminada
)
SELECT u.id, s.id, u.empresa_id, 1
FROM users u
INNER JOIN sucursales s
  ON s.empresa_id = u.empresa_id AND s.es_principal = 1
WHERE u.empresa_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM usuario_sucursales us WHERE us.usuario_id = u.id
  );

COMMIT;

SELECT empresa_id, COUNT(*) AS activas,
       SUM(es_principal = 1) AS principales
FROM sucursales
GROUP BY empresa_id;
