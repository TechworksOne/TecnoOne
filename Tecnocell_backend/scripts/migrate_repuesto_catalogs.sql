-- =============================================================================
-- Migración: Catálogos jerárquicos de repuestos
-- Tablas: repuesto_tipos, repuesto_marcas, repuesto_modelos
-- Ejecutar en la base de datos tecnocell_web
-- =============================================================================

-- ── 1. Crear tabla repuesto_tipos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `repuesto_tipos` (
  `id`         INT(11)      NOT NULL AUTO_INCREMENT,
  `nombre`     VARCHAR(100) NOT NULL,
  `activo`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_repuesto_tipos_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Crear tabla repuesto_marcas ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `repuesto_marcas` (
  `id`         INT(11)      NOT NULL AUTO_INCREMENT,
  `tipo_id`    INT(11)      NOT NULL,
  `nombre`     VARCHAR(100) NOT NULL,
  `activo`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_repuesto_marcas_tipo_nombre` (`tipo_id`, `nombre`),
  CONSTRAINT `fk_rmarca_tipo` FOREIGN KEY (`tipo_id`)
    REFERENCES `repuesto_tipos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Crear tabla repuesto_modelos ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `repuesto_modelos` (
  `id`         INT(11)      NOT NULL AUTO_INCREMENT,
  `tipo_id`    INT(11)      NOT NULL,
  `marca_id`   INT(11)      NOT NULL,
  `nombre`     VARCHAR(100) NOT NULL,
  `activo`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`),
  CONSTRAINT `fk_rmodelo_tipo`  FOREIGN KEY (`tipo_id`)  REFERENCES `repuesto_tipos`  (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_rmodelo_marca` FOREIGN KEY (`marca_id`) REFERENCES `repuesto_marcas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. Alterar tabla repuestos: cambiar ENUMs por VARCHAR ────────────────────
--    Esto permite almacenar cualquier tipo/marca proveniente del catálogo.
ALTER TABLE `repuestos`
  MODIFY COLUMN `tipo`  VARCHAR(100) NOT NULL DEFAULT 'Otro',
  MODIFY COLUMN `marca` VARCHAR(100) NOT NULL DEFAULT '';

-- ── 5. Seed: repuesto_tipos ──────────────────────────────────────────────────
INSERT IGNORE INTO `repuesto_tipos` (`nombre`) VALUES
  ('Laptop'),
  ('PC'),
  ('Celular'),
  ('Tablet'),
  ('Consola'),
  ('Impresora'),
  ('Monitor'),
  ('Otro');

-- ── 6. Seed: repuesto_marcas por tipo ────────────────────────────────────────

-- Laptop
INSERT IGNORE INTO `repuesto_marcas` (`tipo_id`, `nombre`)
SELECT t.id, m.nombre FROM `repuesto_tipos` t
CROSS JOIN (
  SELECT 'HP'     AS nombre UNION ALL
  SELECT 'Dell'             UNION ALL
  SELECT 'Lenovo'           UNION ALL
  SELECT 'Acer'             UNION ALL
  SELECT 'Asus'
) m WHERE t.nombre = 'Laptop';

-- PC
INSERT IGNORE INTO `repuesto_marcas` (`tipo_id`, `nombre`)
SELECT t.id, m.nombre FROM `repuesto_tipos` t
CROSS JOIN (
  SELECT 'Genérica' AS nombre UNION ALL
  SELECT 'HP'                 UNION ALL
  SELECT 'Dell'               UNION ALL
  SELECT 'Lenovo'
) m WHERE t.nombre = 'PC';

-- Celular
INSERT IGNORE INTO `repuesto_marcas` (`tipo_id`, `nombre`)
SELECT t.id, m.nombre FROM `repuesto_tipos` t
CROSS JOIN (
  SELECT 'Apple'    AS nombre UNION ALL
  SELECT 'Samsung'            UNION ALL
  SELECT 'Xiaomi'             UNION ALL
  SELECT 'Motorola'           UNION ALL
  SELECT 'Huawei'
) m WHERE t.nombre = 'Celular';

-- Tablet
INSERT IGNORE INTO `repuesto_marcas` (`tipo_id`, `nombre`)
SELECT t.id, m.nombre FROM `repuesto_tipos` t
CROSS JOIN (
  SELECT 'Apple'   AS nombre UNION ALL
  SELECT 'Samsung'           UNION ALL
  SELECT 'Lenovo'            UNION ALL
  SELECT 'Huawei'
) m WHERE t.nombre = 'Tablet';

-- Consola
INSERT IGNORE INTO `repuesto_marcas` (`tipo_id`, `nombre`)
SELECT t.id, m.nombre FROM `repuesto_tipos` t
CROSS JOIN (
  SELECT 'Sony'      AS nombre UNION ALL
  SELECT 'Microsoft'           UNION ALL
  SELECT 'Nintendo'
) m WHERE t.nombre = 'Consola';

-- ── 7. Seed: repuesto_modelos ─────────────────────────────────────────────────

-- HP → Laptop
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'HP'
CROSS JOIN (
  SELECT 'Pavilion'  AS nombre UNION ALL
  SELECT 'ProBook'             UNION ALL
  SELECT 'EliteBook'
) modelo_seed WHERE t.nombre = 'Laptop';

-- Dell → Laptop
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'Dell'
CROSS JOIN (
  SELECT 'Inspiron' AS nombre UNION ALL
  SELECT 'Latitude'           UNION ALL
  SELECT 'Vostro'
) modelo_seed WHERE t.nombre = 'Laptop';

-- Lenovo → Laptop
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'Lenovo'
CROSS JOIN (
  SELECT 'ThinkPad' AS nombre UNION ALL
  SELECT 'IdeaPad'            UNION ALL
  SELECT 'Legion'
) modelo_seed WHERE t.nombre = 'Laptop';

-- Apple → Celular
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'Apple'
CROSS JOIN (
  SELECT 'iPhone 11' AS nombre UNION ALL
  SELECT 'iPhone 12'           UNION ALL
  SELECT 'iPhone 13'           UNION ALL
  SELECT 'iPhone 14'           UNION ALL
  SELECT 'iPhone 15'           UNION ALL
  SELECT 'iPhone 16'           UNION ALL
  SELECT 'iPad'
) modelo_seed WHERE t.nombre = 'Celular';

-- Samsung → Celular
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'Samsung'
CROSS JOIN (
  SELECT 'Galaxy A' AS nombre UNION ALL
  SELECT 'Galaxy S'           UNION ALL
  SELECT 'Galaxy Tab'
) modelo_seed WHERE t.nombre = 'Celular';

-- Xiaomi → Celular
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'Xiaomi'
CROSS JOIN (
  SELECT 'Redmi' AS nombre UNION ALL
  SELECT 'POCO'             UNION ALL
  SELECT 'Mi'
) modelo_seed WHERE t.nombre = 'Celular';

-- Apple → Tablet
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'Apple'
CROSS JOIN (
  SELECT 'iPad'      AS nombre UNION ALL
  SELECT 'iPad Mini'           UNION ALL
  SELECT 'iPad Air'            UNION ALL
  SELECT 'iPad Pro'
) modelo_seed WHERE t.nombre = 'Tablet';

-- Samsung → Tablet
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'Samsung'
CROSS JOIN (
  SELECT 'Galaxy Tab A' AS nombre UNION ALL
  SELECT 'Galaxy Tab S'
) modelo_seed WHERE t.nombre = 'Tablet';

-- Sony → Consola
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'Sony'
CROSS JOIN (
  SELECT 'PlayStation 4' AS nombre UNION ALL
  SELECT 'PlayStation 5'
) modelo_seed WHERE t.nombre = 'Consola';

-- Microsoft → Consola
INSERT IGNORE INTO `repuesto_modelos` (`tipo_id`, `marca_id`, `nombre`)
SELECT t.id, rm.id, modelo_seed.nombre
FROM `repuesto_tipos` t
JOIN `repuesto_marcas` rm ON rm.tipo_id = t.id AND rm.nombre = 'Microsoft'
CROSS JOIN (
  SELECT 'Xbox One'        AS nombre UNION ALL
  SELECT 'Xbox Series S'             UNION ALL
  SELECT 'Xbox Series X'
) modelo_seed WHERE t.nombre = 'Consola';
