-- Sprint 2E.1 - Roles empresariales y permisos efectivos aislados.
-- Requiere MySQL/MariaDB con InnoDB. No crea roles para empresas que no los tenían.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_rbac_empresarial_2e1$$
CREATE PROCEDURE migrate_rbac_empresarial_2e1()
main: BEGIN
  DECLARE v_count INT DEFAULT 0;
  DECLARE v_index_name VARCHAR(64);

  SELECT COUNT(*) INTO v_count
  FROM user_roles ur
  LEFT JOIN users u ON u.id = ur.user_id
  LEFT JOIN roles r ON r.id = ur.role_id
  WHERE u.id IS NULL OR r.id IS NULL;
  IF v_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '2E.1: existen asignaciones user_roles huérfanas';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM rol_permisos rp
  LEFT JOIN empresas e ON e.id = rp.empresa_id
  LEFT JOIN roles r ON r.id = rp.rol_id
  LEFT JOIN permisos p ON p.id = rp.permiso_id
  WHERE e.id IS NULL OR r.id IS NULL OR p.id IS NULL;
  IF v_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '2E.1: existen asignaciones rol_permisos huérfanas';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'roles'
    AND COLUMN_NAME = 'empresa_id';

  IF v_count = 0 THEN
    SELECT COUNT(*) INTO v_count
    FROM users u
    INNER JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.empresa_id IS NULL
       OR u.tipo_usuario = 'PLATAFORMA'
       OR COALESCE(u.es_super_admin, 0) = 1;
    IF v_count > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '2E.1: Super Admin/plataforma o usuario sin empresa tiene roles empresariales';
    END IF;

    -- Sprint 2A sembró cajas.sesion.operar mediante un producto cartesiano
    -- entre todas las empresas y los roles globales (líneas 70-87 de esa migración).
    -- Solo se tolera la fila VENTAS/cajas.sesion.operar cuando esa empresa no
    -- tiene ningún usuario empresarial realmente asignado al rol VENTAS.
    SELECT COUNT(*) INTO v_count
    FROM rol_permisos rp
    INNER JOIN roles r ON r.id = rp.rol_id
    INNER JOIN permisos p ON p.id = rp.permiso_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      WHERE ur.role_id = rp.rol_id
        AND u.empresa_id = rp.empresa_id
        AND u.empresa_id IS NOT NULL
        AND u.tipo_usuario = 'EMPRESA'
        AND COALESCE(u.es_super_admin, 0) = 0
    )
      AND NOT (
        UPPER(r.nombre) = 'VENTAS'
        AND p.codigo = 'cajas.sesion.operar'
      );
    IF v_count > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '2E.1: rol_permisos sin usuarios; anomalía distinta a contaminación Sprint 2A';
    END IF;

    -- Un rol global sin ninguna asignación real no tiene empresa autoritativa.
    -- No se elimina ni se asigna por conjetura: la migración debe abortar.
    SELECT COUNT(*) INTO v_count
    FROM roles r
    WHERE NOT EXISTS (
      SELECT 1
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      WHERE ur.role_id = r.id
        AND u.empresa_id IS NOT NULL
        AND u.tipo_usuario = 'EMPRESA'
        AND COALESCE(u.es_super_admin, 0) = 0
    );
    IF v_count > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '2E.1: existe un rol global sin usuarios empresariales; requiere resolución manual';
    END IF;

    ALTER TABLE roles ADD COLUMN empresa_id INT NULL AFTER id;

    SELECT COUNT(*) INTO v_count FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'es_sistema';
    IF v_count = 0 THEN
      ALTER TABLE roles ADD COLUMN es_sistema TINYINT(1) NOT NULL DEFAULT 0 AFTER activo;
    END IF;

    SELECT COUNT(*) INTO v_count FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'created_at';
    IF v_count = 0 THEN
      ALTER TABLE roles ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER es_sistema;
    END IF;

    SELECT COUNT(*) INTO v_count FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'updated_at';
    IF v_count = 0 THEN
      ALTER TABLE roles ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
    END IF;

    -- El catálogo anterior era global; todos sus registros son roles heredados del sistema.
    UPDATE roles SET es_sistema = 1;

    SELECT s.INDEX_NAME INTO v_index_name
    FROM INFORMATION_SCHEMA.STATISTICS s
    WHERE s.TABLE_SCHEMA = DATABASE()
      AND s.TABLE_NAME = 'roles'
      AND s.NON_UNIQUE = 0
    GROUP BY s.INDEX_NAME
    HAVING COUNT(*) = 1 AND MAX(s.COLUMN_NAME) = 'nombre'
    LIMIT 1;
    IF v_index_name IS NOT NULL THEN
      SET @drop_name_unique = CONCAT('ALTER TABLE roles DROP INDEX `', v_index_name, '`');
      PREPARE stmt FROM @drop_name_unique;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_role_empresa_2e1;
    CREATE TEMPORARY TABLE tmp_role_empresa_2e1 (
      old_role_id INT NOT NULL,
      empresa_id INT NOT NULL,
      PRIMARY KEY (old_role_id, empresa_id)
    ) ENGINE=InnoDB;

    -- Matriz autoritativa: exclusivamente usuarios empresariales con roles reales.
    INSERT IGNORE INTO tmp_role_empresa_2e1 (old_role_id, empresa_id)
    SELECT ur.role_id, u.empresa_id
    FROM users u
    INNER JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.empresa_id IS NOT NULL
      AND u.tipo_usuario = 'EMPRESA'
      AND COALESCE(u.es_super_admin, 0) = 0;

    -- Eliminación explícita de la contaminación confirmada de Sprint 2A.
    -- No elimina ninguna otra fila sin respaldo de usuarios.
    DELETE rp
    FROM rol_permisos rp
    INNER JOIN roles r ON r.id = rp.rol_id
    INNER JOIN permisos p ON p.id = rp.permiso_id
    WHERE UPPER(r.nombre) = 'VENTAS'
      AND p.codigo = 'cajas.sesion.operar'
      AND NOT EXISTS (
        SELECT 1
        FROM users u
        INNER JOIN user_roles ur ON ur.user_id = u.id
        WHERE ur.role_id = rp.rol_id
          AND u.empresa_id = rp.empresa_id
          AND u.empresa_id IS NOT NULL
          AND u.tipo_usuario = 'EMPRESA'
          AND COALESCE(u.es_super_admin, 0) = 0
      );

    UPDATE roles r
    INNER JOIN (
      SELECT old_role_id, MIN(empresa_id) AS empresa_id
      FROM tmp_role_empresa_2e1
      GROUP BY old_role_id
    ) first_owner ON first_owner.old_role_id = r.id
    SET r.empresa_id = first_owner.empresa_id;

    INSERT INTO roles (empresa_id, nombre, descripcion, activo, es_sistema, created_at, updated_at)
    SELECT pair.empresa_id, source.nombre, source.descripcion, source.activo,
           source.es_sistema, source.created_at, source.updated_at
    FROM tmp_role_empresa_2e1 pair
    INNER JOIN roles source ON source.id = pair.old_role_id
    WHERE pair.empresa_id <> source.empresa_id;

    DROP TEMPORARY TABLE IF EXISTS tmp_role_map_2e1;
    CREATE TEMPORARY TABLE tmp_role_map_2e1 AS
      SELECT pair.old_role_id, pair.empresa_id, target.id AS new_role_id
      FROM tmp_role_empresa_2e1 pair
      INNER JOIN roles source ON source.id = pair.old_role_id
      INNER JOIN roles target
        ON target.empresa_id = pair.empresa_id
       AND target.nombre = source.nombre;
    ALTER TABLE tmp_role_map_2e1
      ADD PRIMARY KEY (old_role_id, empresa_id),
      ADD KEY idx_tmp_role_map_new (new_role_id);

    UPDATE user_roles ur
    INNER JOIN users u ON u.id = ur.user_id
    INNER JOIN tmp_role_map_2e1 role_map
      ON role_map.old_role_id = ur.role_id
     AND role_map.empresa_id = u.empresa_id
    SET ur.role_id = role_map.new_role_id;

    UPDATE rol_permisos rp
    INNER JOIN tmp_role_map_2e1 role_map
      ON role_map.old_role_id = rp.rol_id
     AND role_map.empresa_id = rp.empresa_id
    SET rp.rol_id = role_map.new_role_id;

    ALTER TABLE roles
      MODIFY empresa_id INT NOT NULL,
      ADD CONSTRAINT fk_roles_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      ADD UNIQUE KEY uq_roles_empresa_nombre (empresa_id, nombre),
      ADD UNIQUE KEY uq_roles_id_empresa (id, empresa_id),
      ADD KEY idx_roles_empresa_activo (empresa_id, activo);
  END IF;

  -- Validaciones posteriores, también ejecutadas al repetir la migración.
  SELECT COUNT(*) INTO v_count
  FROM user_roles ur
  INNER JOIN users u ON u.id = ur.user_id
  INNER JOIN roles r ON r.id = ur.role_id
  WHERE u.empresa_id IS NULL OR r.empresa_id <> u.empresa_id;
  IF v_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '2E.1: user_roles contiene empresas incompatibles';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM rol_permisos rp
  INNER JOIN roles r ON r.id = rp.rol_id
  WHERE rp.empresa_id <> r.empresa_id;
  IF v_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '2E.1: rol_permisos contiene empresas incompatibles';
  END IF;
END$$

CALL migrate_rbac_empresarial_2e1()$$
DROP PROCEDURE migrate_rbac_empresarial_2e1$$

DROP TRIGGER IF EXISTS trg_user_roles_empresa_bi$$
CREATE TRIGGER trg_user_roles_empresa_bi
BEFORE INSERT ON user_roles
FOR EACH ROW
BEGIN
  DECLARE v_user_empresa INT;
  DECLARE v_role_empresa INT;
  DECLARE v_is_platform INT DEFAULT 0;
  SELECT empresa_id, (tipo_usuario = 'PLATAFORMA' OR COALESCE(es_super_admin, 0) = 1)
    INTO v_user_empresa, v_is_platform
  FROM users WHERE id = NEW.user_id;
  SELECT empresa_id INTO v_role_empresa FROM roles WHERE id = NEW.role_id;
  IF v_user_empresa IS NULL OR v_is_platform = 1 OR v_user_empresa <> v_role_empresa THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'user_roles: usuario y rol deben pertenecer a la misma empresa';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_user_roles_empresa_bu$$
CREATE TRIGGER trg_user_roles_empresa_bu
BEFORE UPDATE ON user_roles
FOR EACH ROW
BEGIN
  DECLARE v_user_empresa INT;
  DECLARE v_role_empresa INT;
  DECLARE v_is_platform INT DEFAULT 0;
  SELECT empresa_id, (tipo_usuario = 'PLATAFORMA' OR COALESCE(es_super_admin, 0) = 1)
    INTO v_user_empresa, v_is_platform
  FROM users WHERE id = NEW.user_id;
  SELECT empresa_id INTO v_role_empresa FROM roles WHERE id = NEW.role_id;
  IF v_user_empresa IS NULL OR v_is_platform = 1 OR v_user_empresa <> v_role_empresa THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'user_roles: usuario y rol deben pertenecer a la misma empresa';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_rol_permisos_empresa_bi$$
CREATE TRIGGER trg_rol_permisos_empresa_bi
BEFORE INSERT ON rol_permisos
FOR EACH ROW
BEGIN
  DECLARE v_role_empresa INT;
  SELECT empresa_id INTO v_role_empresa FROM roles WHERE id = NEW.rol_id;
  IF v_role_empresa <> NEW.empresa_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rol_permisos: empresa_id no coincide con el rol';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_rol_permisos_empresa_bu$$
CREATE TRIGGER trg_rol_permisos_empresa_bu
BEFORE UPDATE ON rol_permisos
FOR EACH ROW
BEGIN
  DECLARE v_role_empresa INT;
  SELECT empresa_id INTO v_role_empresa FROM roles WHERE id = NEW.rol_id;
  IF v_role_empresa <> NEW.empresa_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rol_permisos: empresa_id no coincide con el rol';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_users_roles_empresa_bu$$
CREATE TRIGGER trg_users_roles_empresa_bu
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  DECLARE v_mismatch INT DEFAULT 0;
  IF NOT (NEW.empresa_id <=> OLD.empresa_id)
     OR NEW.tipo_usuario <> OLD.tipo_usuario
     OR COALESCE(NEW.es_super_admin, 0) <> COALESCE(OLD.es_super_admin, 0) THEN
    SELECT COUNT(*) INTO v_mismatch
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = OLD.id
      AND (
        NEW.empresa_id IS NULL
        OR NEW.tipo_usuario = 'PLATAFORMA'
        OR COALESCE(NEW.es_super_admin, 0) = 1
        OR r.empresa_id <> NEW.empresa_id
      );
    IF v_mismatch > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'users: el cambio dejaría roles de otra empresa';
    END IF;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_roles_empresa_bu$$
CREATE TRIGGER trg_roles_empresa_bu
BEFORE UPDATE ON roles
FOR EACH ROW
BEGIN
  DECLARE v_mismatch INT DEFAULT 0;
  IF NEW.empresa_id <> OLD.empresa_id THEN
    SELECT
      (SELECT COUNT(*)
       FROM user_roles ur
       INNER JOIN users u ON u.id = ur.user_id
       WHERE ur.role_id = OLD.id AND u.empresa_id <> NEW.empresa_id)
      +
      (SELECT COUNT(*)
       FROM rol_permisos rp
       WHERE rp.rol_id = OLD.id AND rp.empresa_id <> NEW.empresa_id)
      INTO v_mismatch;
    IF v_mismatch > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'roles: el cambio dejaría asignaciones de otra empresa';
    END IF;
  END IF;
END$$

DELIMITER ;
