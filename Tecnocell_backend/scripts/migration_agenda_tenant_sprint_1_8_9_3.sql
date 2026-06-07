-- =============================================================
-- Sprint 1.8.9.3 - Tenant scope para agenda_eventos
-- =============================================================
-- Objetivo:
-- - Agregar agenda_eventos.empresa_id.
-- - Backfill desde users.empresa_id usando creado_por_id.
-- - Abortarlo si existen eventos historicos sin empresa resoluble.
-- - Crear indices y FK hacia empresas(id).
--
-- No usa fallback a empresa 1 ni primera empresa disponible.
-- Ejecutar manualmente despues de revisar el diff.
-- =============================================================

DROP PROCEDURE IF EXISTS migration_agenda_tenant_sprint_1_8_9_3;

DELIMITER //

CREATE PROCEDURE migration_agenda_tenant_sprint_1_8_9_3()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agenda_eventos'
  ) THEN
    CREATE TABLE agenda_eventos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT(11) NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      fecha DATE NOT NULL,
      hora TIME DEFAULT NULL,
      descripcion TEXT DEFAULT NULL,
      tipo ENUM('nota','cita','recordatorio','otro') NOT NULL DEFAULT 'nota',
      color VARCHAR(20) DEFAULT NULL,
      creado_por VARCHAR(100) DEFAULT NULL,
      creado_por_id INT DEFAULT NULL,
      para_rol VARCHAR(50) DEFAULT NULL,
      para_usuario_id INT DEFAULT NULL,
      para_usuario_nombre VARCHAR(150) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_agenda_eventos_empresa_id (empresa_id),
      INDEX idx_agenda_eventos_empresa_fecha (empresa_id, fecha),
      INDEX idx_agenda_eventos_empresa_usuario (empresa_id, para_usuario_id),
      CONSTRAINT fk_agenda_eventos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agenda_eventos'
      AND COLUMN_NAME = 'empresa_id'
  ) THEN
    ALTER TABLE agenda_eventos
      ADD COLUMN empresa_id INT(11) NULL AFTER id;
  END IF;

  UPDATE agenda_eventos ae
  JOIN users u ON u.id = ae.creado_por_id
  SET ae.empresa_id = u.empresa_id
  WHERE ae.empresa_id IS NULL
    AND u.empresa_id IS NOT NULL;

  IF EXISTS (SELECT 1 FROM agenda_eventos WHERE empresa_id IS NULL LIMIT 1) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Sprint 1.8.9.3: existen eventos de agenda sin empresa resoluble por creado_por_id';
  END IF;

  ALTER TABLE agenda_eventos
    MODIFY empresa_id INT(11) NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agenda_eventos'
      AND INDEX_NAME = 'idx_agenda_eventos_empresa_id'
  ) THEN
    CREATE INDEX idx_agenda_eventos_empresa_id
      ON agenda_eventos (empresa_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agenda_eventos'
      AND INDEX_NAME = 'idx_agenda_eventos_empresa_fecha'
  ) THEN
    CREATE INDEX idx_agenda_eventos_empresa_fecha
      ON agenda_eventos (empresa_id, fecha);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agenda_eventos'
      AND INDEX_NAME = 'idx_agenda_eventos_empresa_usuario'
  ) THEN
    CREATE INDEX idx_agenda_eventos_empresa_usuario
      ON agenda_eventos (empresa_id, para_usuario_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agenda_eventos'
      AND CONSTRAINT_NAME = 'fk_agenda_eventos_empresa'
  ) THEN
    ALTER TABLE agenda_eventos
      ADD CONSTRAINT fk_agenda_eventos_empresa
      FOREIGN KEY (empresa_id) REFERENCES empresas(id);
  END IF;
END//

DELIMITER ;

CALL migration_agenda_tenant_sprint_1_8_9_3();

DROP PROCEDURE IF EXISTS migration_agenda_tenant_sprint_1_8_9_3;
