-- Sprint 1.8.7 - Tenant scope para stickers
-- No borra datos existentes. Ejecutar manualmente una sola vez.
-- Mantiene UNIQUE(numero_sticker) global.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_stickers_tenant_sprint_1_8_7 $$

CREATE PROCEDURE migrate_stickers_tenant_sprint_1_8_7()
BEGIN
  DECLARE v_count INT DEFAULT 0;
  DECLARE v_pending_stickers INT DEFAULT 0;
  DECLARE v_pending_lotes INT DEFAULT 0;
  DECLARE v_fallback_empresa_id INT DEFAULT NULL;
  DECLARE v_estado_type TEXT DEFAULT NULL;

  SELECT MIN(id) INTO v_fallback_empresa_id FROM empresas;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sticker_lotes'
    AND COLUMN_NAME = 'empresa_id';

  IF v_count = 0 THEN
    ALTER TABLE sticker_lotes
      ADD COLUMN empresa_id INT(11) NULL AFTER id;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stickers_garantia'
    AND COLUMN_NAME = 'empresa_id';

  IF v_count = 0 THEN
    ALTER TABLE stickers_garantia
      ADD COLUMN empresa_id INT(11) NULL AFTER id;
  END IF;

  UPDATE stickers_garantia s
  JOIN reparaciones r ON r.id = s.reparacion_id
  SET s.empresa_id = r.empresa_id
  WHERE s.empresa_id IS NULL;

  SELECT COUNT(*) INTO v_pending_stickers
  FROM stickers_garantia
  WHERE empresa_id IS NULL;

  IF v_pending_stickers > 0 AND v_fallback_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Sprint 1.8.7: no existe empresa para backfill de stickers_garantia';
  END IF;

  UPDATE stickers_garantia
  SET empresa_id = v_fallback_empresa_id
  WHERE empresa_id IS NULL;

  UPDATE sticker_lotes sl
  JOIN (
    SELECT lote_id, MIN(empresa_id) AS empresa_id
    FROM stickers_garantia
    WHERE lote_id IS NOT NULL
      AND empresa_id IS NOT NULL
    GROUP BY lote_id
  ) sg ON sg.lote_id = sl.id
  SET sl.empresa_id = sg.empresa_id
  WHERE sl.empresa_id IS NULL;

  SELECT COUNT(*) INTO v_pending_lotes
  FROM sticker_lotes
  WHERE empresa_id IS NULL;

  IF v_pending_lotes > 0 AND v_fallback_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Sprint 1.8.7: no existe empresa para backfill de sticker_lotes';
  END IF;

  UPDATE sticker_lotes
  SET empresa_id = v_fallback_empresa_id
  WHERE empresa_id IS NULL;

  SELECT COUNT(*) INTO v_pending_stickers
  FROM stickers_garantia
  WHERE empresa_id IS NULL;

  SELECT COUNT(*) INTO v_pending_lotes
  FROM sticker_lotes
  WHERE empresa_id IS NULL;

  IF v_pending_stickers > 0 OR v_pending_lotes > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Sprint 1.8.7: quedan registros de stickers sin empresa_id';
  END IF;

  ALTER TABLE sticker_lotes
    MODIFY empresa_id INT(11) NOT NULL;

  ALTER TABLE stickers_garantia
    MODIFY empresa_id INT(11) NOT NULL;

  SELECT COLUMN_TYPE INTO v_estado_type
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stickers_garantia'
    AND COLUMN_NAME = 'estado'
  LIMIT 1;

  IF v_estado_type LIKE 'enum(%' AND v_estado_type NOT LIKE '%''ANULADO''%' THEN
    ALTER TABLE stickers_garantia
      MODIFY estado ENUM('DISPONIBLE','ASIGNADO','USADO','ANULADO') NOT NULL DEFAULT 'DISPONIBLE';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sticker_lotes'
    AND INDEX_NAME = 'idx_sticker_lotes_empresa_id';

  IF v_count = 0 THEN
    CREATE INDEX idx_sticker_lotes_empresa_id
      ON sticker_lotes (empresa_id);
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stickers_garantia'
    AND INDEX_NAME = 'idx_stickers_garantia_empresa_id';

  IF v_count = 0 THEN
    CREATE INDEX idx_stickers_garantia_empresa_id
      ON stickers_garantia (empresa_id);
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stickers_garantia'
    AND INDEX_NAME = 'idx_stickers_empresa_estado';

  IF v_count = 0 THEN
    CREATE INDEX idx_stickers_empresa_estado
      ON stickers_garantia (empresa_id, estado);
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stickers_garantia'
    AND INDEX_NAME = 'idx_stickers_empresa_lote';

  IF v_count = 0 THEN
    CREATE INDEX idx_stickers_empresa_lote
      ON stickers_garantia (empresa_id, lote_id);
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sticker_lotes'
    AND CONSTRAINT_NAME = 'fk_sticker_lotes_empresa';

  IF v_count = 0 THEN
    ALTER TABLE sticker_lotes
      ADD CONSTRAINT fk_sticker_lotes_empresa
      FOREIGN KEY (empresa_id) REFERENCES empresas(id);
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stickers_garantia'
    AND CONSTRAINT_NAME = 'fk_stickers_garantia_empresa';

  IF v_count = 0 THEN
    ALTER TABLE stickers_garantia
      ADD CONSTRAINT fk_stickers_garantia_empresa
      FOREIGN KEY (empresa_id) REFERENCES empresas(id);
  END IF;
END $$

CALL migrate_stickers_tenant_sprint_1_8_7() $$

DROP PROCEDURE IF EXISTS migrate_stickers_tenant_sprint_1_8_7 $$

DELIMITER ;
