-- =============================================================
-- Sprint 1.8.4 - Tenant scope para cotizaciones
-- =============================================================
-- Objetivo:
-- - Agregar empresa_id a cotizaciones.
-- - Backfill desde clientes.empresa_id para datos historicos.
-- - Usar la primera empresa existente como fallback para registros
--   historicos sin cliente valido.
-- - Crear indice y FK hacia empresas(id).
--
-- Nota: numero_cotizacion queda UNIQUE global en este sprint.
-- No ejecutar si se necesita revisar primero el diff.
-- =============================================================

DROP PROCEDURE IF EXISTS migration_cotizaciones_tenant_sprint_1_8_4;

DELIMITER //

CREATE PROCEDURE migration_cotizaciones_tenant_sprint_1_8_4()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cotizaciones'
      AND COLUMN_NAME = 'empresa_id'
  ) THEN
    ALTER TABLE cotizaciones
      ADD COLUMN empresa_id INT(11) NULL AFTER id;
  END IF;

  UPDATE cotizaciones c
  JOIN clientes cl ON cl.id = c.cliente_id
  SET c.empresa_id = cl.empresa_id
  WHERE c.empresa_id IS NULL;

  -- Fallback para cotizaciones historicas sin cliente valido.
  -- Si aun hay registros sin empresa, debe existir al menos una empresa
  -- para asignar la primera disponible sin perder datos.
  IF EXISTS (SELECT 1 FROM cotizaciones WHERE empresa_id IS NULL LIMIT 1)
     AND NOT EXISTS (SELECT 1 FROM empresas LIMIT 1) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No existe ninguna empresa para asignar cotizaciones historicas sin cliente valido';
  END IF;

  UPDATE cotizaciones c
  SET c.empresa_id = (SELECT e.id FROM empresas e ORDER BY e.id LIMIT 1)
  WHERE c.empresa_id IS NULL;

  IF EXISTS (SELECT 1 FROM cotizaciones WHERE empresa_id IS NULL LIMIT 1) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No se pudo completar el backfill de cotizaciones. empresa_id sigue NULL';
  END IF;

  ALTER TABLE cotizaciones
    MODIFY empresa_id INT(11) NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cotizaciones'
      AND INDEX_NAME = 'idx_cotizaciones_empresa_id'
  ) THEN
    ALTER TABLE cotizaciones
      ADD INDEX idx_cotizaciones_empresa_id (empresa_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cotizaciones'
      AND CONSTRAINT_NAME = 'fk_cotizaciones_empresa'
      AND REFERENCED_TABLE_NAME = 'empresas'
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT fk_cotizaciones_empresa
      FOREIGN KEY (empresa_id) REFERENCES empresas(id);
  END IF;
END//

DELIMITER ;

CALL migration_cotizaciones_tenant_sprint_1_8_4();

DROP PROCEDURE IF EXISTS migration_cotizaciones_tenant_sprint_1_8_4;
