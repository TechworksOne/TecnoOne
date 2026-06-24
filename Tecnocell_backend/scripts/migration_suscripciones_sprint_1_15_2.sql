-- Sprint 1.15.2 - Suscripciones y vencimientos
-- Idempotente y compatible con las columnas heredadas de empresas.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS suscripciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  plan VARCHAR(50) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_vencimiento DATE NULL,
  dias_gracia INT NOT NULL DEFAULT 0,
  fecha_fin_gracia DATE NULL,
  duracion_meses INT NULL,
  proxima_a_vencer_dias INT NOT NULL DEFAULT 7,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_suscripciones_empresa (empresa_id),
  KEY idx_suscripciones_estado (estado),
  KEY idx_suscripciones_vencimiento (fecha_vencimiento),
  KEY idx_suscripciones_fin_gracia (fecha_fin_gracia),
  CONSTRAINT fk_suscripciones_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_suscripciones_tipo
    CHECK (tipo IN ('prueba', 'comercial')),
  CONSTRAINT chk_suscripciones_estado
    CHECK (estado IN ('prueba', 'vigente', 'gracia', 'vencida')),
  CONSTRAINT chk_suscripciones_dias_gracia
    CHECK (dias_gracia >= 0),
  CONSTRAINT chk_suscripciones_proxima
    CHECK (proxima_a_vencer_dias >= 0),
  CONSTRAINT chk_suscripciones_duracion
    CHECK (duracion_meses IS NULL OR duracion_meses IN (1, 3, 6, 12))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial_suscripciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  suscripcion_id BIGINT UNSIGNED NOT NULL,
  empresa_id INT NOT NULL,
  tipo_evento VARCHAR(50) NOT NULL,
  estado_empresa_anterior VARCHAR(30) NULL,
  estado_empresa_nuevo VARCHAR(30) NULL,
  estado_suscripcion_anterior VARCHAR(20) NULL,
  estado_suscripcion_nuevo VARCHAR(20) NULL,
  fecha_inicio_anterior DATE NULL,
  fecha_inicio_nueva DATE NULL,
  fecha_vencimiento_anterior DATE NULL,
  fecha_vencimiento_nueva DATE NULL,
  dias_gracia_anterior INT NULL,
  dias_gracia_nuevo INT NULL,
  meses_renovados INT NULL,
  motivo VARCHAR(500) NULL,
  super_admin_id INT NULL,
  origen VARCHAR(30) NOT NULL,
  datos_anteriores JSON NULL,
  datos_nuevos JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_historial_suscripcion (suscripcion_id, created_at),
  KEY idx_historial_empresa (empresa_id, created_at),
  KEY idx_historial_evento (tipo_evento, created_at),
  KEY idx_historial_super_admin (super_admin_id),
  CONSTRAINT fk_historial_suscripcion
    FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_historial_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_historial_super_admin
    FOREIGN KEY (super_admin_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Normaliza únicamente el estado operativo. Las columnas comerciales heredadas
-- permanecen intactas y continúan funcionando como espejo de compatibilidad.
UPDATE empresas
SET estado = CASE
  WHEN LOWER(COALESCE(estado, '')) IN ('cancelada', 'suspendida', 'demo') THEN LOWER(estado)
  WHEN LOWER(COALESCE(estado, '')) = 'prueba' THEN 'demo'
  ELSE 'activa'
END;

INSERT INTO suscripciones (
  empresa_id,
  plan,
  tipo,
  estado,
  fecha_inicio,
  fecha_vencimiento,
  dias_gracia,
  fecha_fin_gracia,
  duracion_meses,
  proxima_a_vencer_dias
)
SELECT
  e.id,
  COALESCE(NULLIF(e.plan, ''), 'demo'),
  CASE
    WHEN LOWER(COALESCE(e.estado, '')) = 'demo'
      OR LOWER(COALESCE(e.plan, '')) = 'demo'
    THEN 'prueba'
    ELSE 'comercial'
  END,
  CASE
    WHEN e.fecha_vencimiento IS NULL THEN
      CASE
        WHEN LOWER(COALESCE(e.estado, '')) = 'demo'
          OR LOWER(COALESCE(e.plan, '')) = 'demo'
        THEN 'prueba'
        ELSE 'vigente'
      END
    WHEN CURRENT_DATE <= e.fecha_vencimiento THEN
      CASE
        WHEN LOWER(COALESCE(e.estado, '')) = 'demo'
          OR LOWER(COALESCE(e.plan, '')) = 'demo'
        THEN 'prueba'
        ELSE 'vigente'
      END
    ELSE 'vencida'
  END,
  COALESCE(e.fecha_inicio, DATE(e.created_at), CURRENT_DATE),
  e.fecha_vencimiento,
  0,
  e.fecha_vencimiento,
  NULL,
  7
FROM empresas e
LEFT JOIN suscripciones s ON s.empresa_id = e.id
WHERE s.id IS NULL;

INSERT INTO historial_suscripciones (
  suscripcion_id,
  empresa_id,
  tipo_evento,
  estado_empresa_nuevo,
  estado_suscripcion_nuevo,
  fecha_inicio_nueva,
  fecha_vencimiento_nueva,
  dias_gracia_nuevo,
  motivo,
  origen,
  datos_nuevos
)
SELECT
  s.id,
  s.empresa_id,
  'MIGRACION_INICIAL',
  e.estado,
  s.estado,
  s.fecha_inicio,
  s.fecha_vencimiento,
  s.dias_gracia,
  'Backfill Sprint 1.15.2',
  'migracion',
  JSON_OBJECT(
    'plan', s.plan,
    'tipo', s.tipo,
    'estado', s.estado,
    'fecha_inicio', s.fecha_inicio,
    'fecha_vencimiento', s.fecha_vencimiento,
    'dias_gracia', s.dias_gracia
  )
FROM suscripciones s
INNER JOIN empresas e ON e.id = s.empresa_id
WHERE NOT EXISTS (
  SELECT 1
  FROM historial_suscripciones h
  WHERE h.suscripcion_id = s.id
    AND h.tipo_evento = 'MIGRACION_INICIAL'
    AND h.origen = 'migracion'
);

COMMIT;

SELECT estado, tipo, COUNT(*) AS total
FROM suscripciones
GROUP BY estado, tipo
ORDER BY estado, tipo;
