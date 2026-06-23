-- Sprint 1.15.3A - Catálogo de planes y módulos
-- Compatible con empresas y suscripciones heredadas.
-- Los campos textuales empresas.plan y suscripciones.plan se conservan
-- temporalmente para no romper métricas ni lógica anterior.

CREATE TABLE IF NOT EXISTS planes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(500) NULL,
  precio_mensual DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  precio_anual DECIMAL(10,2) NULL,
  moneda VARCHAR(10) NOT NULL DEFAULT 'GTQ',
  max_usuarios INT NULL,
  max_sucursales INT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  es_publico TINYINT(1) NOT NULL DEFAULT 1,
  asignable TINYINT(1) NOT NULL DEFAULT 1,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_planes_codigo (codigo),
  KEY idx_planes_estado (activo, es_publico, asignable),
  KEY idx_planes_orden (orden),
  CONSTRAINT chk_planes_precio_mensual
    CHECK (precio_mensual >= 0),
  CONSTRAINT chk_planes_precio_anual
    CHECK (precio_anual IS NULL OR precio_anual >= 0),
  CONSTRAINT chk_planes_max_usuarios
    CHECK (max_usuarios IS NULL OR max_usuarios >= 0),
  CONSTRAINT chk_planes_max_sucursales
    CHECK (max_sucursales IS NULL OR max_sucursales >= 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS modulos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(80) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  grupo VARCHAR(50) NOT NULL,
  descripcion VARCHAR(500) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  siempre_habilitado TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_modulos_codigo (codigo),
  KEY idx_modulos_grupo (grupo),
  KEY idx_modulos_estado (activo, siempre_habilitado)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plan_modulos (
  plan_id BIGINT UNSIGNED NOT NULL,
  modulo_id BIGINT UNSIGNED NOT NULL,
  habilitado TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (plan_id, modulo_id),
  KEY idx_plan_modulos_modulo (modulo_id),
  CONSTRAINT fk_plan_modulos_plan
    FOREIGN KEY (plan_id) REFERENCES planes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_plan_modulos_modulo
    FOREIGN KEY (modulo_id) REFERENCES modulos(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO planes (
  codigo,
  nombre,
  descripcion,
  precio_mensual,
  precio_anual,
  moneda,
  max_usuarios,
  max_sucursales,
  activo,
  es_publico,
  asignable,
  orden
) VALUES
(
  'pos',
  'TecnoOne POS',
  'Ventas, inventario, compras, caja y administración comercial.',
  300.00,
  NULL,
  'GTQ',
  2,
  1,
  1,
  1,
  1,
  10
),
(
  'taller',
  'TecnoOne Taller',
  'Gestión comercial completa y operación de talleres de reparación.',
  500.00,
  NULL,
  'GTQ',
  3,
  1,
  1,
  1,
  1,
  20
),
(
  'multisucursal',
  'TecnoOne Multisucursal',
  'Plan reservado para futura infraestructura multisucursal.',
  800.00,
  NULL,
  'GTQ',
  9,
  3,
  1,
  0,
  0,
  30
),
(
  'legacy_demo',
  'Demo heredado',
  'Compatibilidad para empresas demo creadas antes del catálogo de planes.',
  0.00,
  NULL,
  'GTQ',
  NULL,
  NULL,
  1,
  0,
  0,
  90
),
(
  'legacy_full',
  'Acceso completo heredado',
  'Compatibilidad para empresas antiguas con acceso completo.',
  0.00,
  NULL,
  'GTQ',
  NULL,
  NULL,
  1,
  0,
  0,
  100
)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  precio_mensual = VALUES(precio_mensual),
  precio_anual = VALUES(precio_anual),
  moneda = VALUES(moneda),
  max_usuarios = VALUES(max_usuarios),
  max_sucursales = VALUES(max_sucursales),
  activo = VALUES(activo),
  es_publico = VALUES(es_publico),
  asignable = VALUES(asignable),
  orden = VALUES(orden);

INSERT INTO modulos (
  codigo,
  nombre,
  grupo,
  descripcion,
  activo,
  siempre_habilitado
) VALUES
('dashboard', 'Dashboard', 'plataforma', 'Panel principal empresarial.', 1, 1),
('clientes', 'Clientes', 'comercial', 'Gestión de clientes.', 1, 0),
('productos', 'Productos', 'inventario', 'Catálogo de productos y categorías.', 1, 0),
('inventario', 'Inventario', 'inventario', 'Existencias, movimientos y repuestos.', 1, 0),
('ventas', 'Ventas', 'comercial', 'Punto de venta y ventas.', 1, 0),
('cotizaciones', 'Cotizaciones', 'comercial', 'Cotizaciones comerciales.', 1, 0),
('compras', 'Compras', 'comercial', 'Compras y entradas de inventario.', 1, 0),
('proveedores', 'Proveedores', 'comercial', 'Gestión de proveedores.', 1, 0),
('caja_bancos', 'Caja y bancos', 'finanzas', 'Caja, bancos y movimientos financieros.', 1, 0),
('tarjetas', 'Tarjetas', 'finanzas', 'Control de tarjetas de crédito.', 1, 0),
('deudores_pagos', 'Deudores y pagos', 'finanzas', 'Cuentas por cobrar y pagos.', 1, 0),
('reportes_comerciales', 'Reportes comerciales', 'comercial', 'Reportes de ventas, compras e inventario.', 1, 0),
('reparaciones', 'Reparaciones', 'taller', 'Recepción y seguimiento de reparaciones.', 1, 0),
('taller_operativo', 'Operación de taller', 'taller', 'Flujo técnico, equipos, agenda, contratos y checklist.', 1, 0),
('reportes_taller', 'Reportes de taller', 'taller', 'Métricas y reportes técnicos.', 1, 0),
('usuarios', 'Usuarios', 'plataforma', 'Gestión de usuarios empresariales.', 1, 1),
('roles_permisos', 'Roles y permisos', 'plataforma', 'Administración de acceso empresarial.', 1, 1),
('auditoria', 'Auditoría', 'plataforma', 'Historial de acciones empresariales.', 1, 1),
('configuracion', 'Configuración', 'plataforma', 'Configuración general de empresa.', 1, 1),
('multisucursal', 'Multisucursal', 'multisucursal', 'Gestión y consolidación por sucursal.', 1, 0)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  grupo = VALUES(grupo),
  descripcion = VALUES(descripcion),
  activo = VALUES(activo),
  siempre_habilitado = VALUES(siempre_habilitado);

-- POS: plataforma base + operación comercial.
INSERT INTO plan_modulos (plan_id, modulo_id, habilitado)
SELECT p.id, m.id, 1
FROM planes p
JOIN modulos m
  ON m.codigo IN (
    'dashboard',
    'clientes',
    'productos',
    'inventario',
    'ventas',
    'cotizaciones',
    'compras',
    'proveedores',
    'caja_bancos',
    'tarjetas',
    'deudores_pagos',
    'reportes_comerciales',
    'usuarios',
    'roles_permisos',
    'auditoria',
    'configuracion'
  )
WHERE p.codigo = 'pos'
ON DUPLICATE KEY UPDATE
  habilitado = VALUES(habilitado);

-- Taller: todos los módulos actuales, excepto multisucursal.
INSERT INTO plan_modulos (plan_id, modulo_id, habilitado)
SELECT p.id, m.id, 1
FROM planes p
JOIN modulos m
  ON m.codigo <> 'multisucursal'
WHERE p.codigo = 'taller'
ON DUPLICATE KEY UPDATE
  habilitado = VALUES(habilitado);

-- Multisucursal y planes heredados: todos los módulos.
INSERT INTO plan_modulos (plan_id, modulo_id, habilitado)
SELECT p.id, m.id, 1
FROM planes p
CROSS JOIN modulos m
WHERE p.codigo IN (
  'multisucursal',
  'legacy_demo',
  'legacy_full'
)
ON DUPLICATE KEY UPDATE
  habilitado = VALUES(habilitado);

ALTER TABLE suscripciones
  ADD COLUMN IF NOT EXISTS plan_id BIGINT UNSIGNED NULL
    AFTER plan,
  ADD COLUMN IF NOT EXISTS plan_programado_id BIGINT UNSIGNED NULL
    AFTER plan_id,
  ADD COLUMN IF NOT EXISTS cambio_plan_efectivo_en DATE NULL
    AFTER plan_programado_id;

UPDATE suscripciones s
JOIN planes p
  ON p.codigo = CASE
    WHEN LOWER(TRIM(COALESCE(s.plan, ''))) = 'demo'
      THEN 'legacy_demo'
    WHEN LOWER(TRIM(COALESCE(s.plan, ''))) = 'pro'
      THEN 'legacy_full'
    ELSE 'legacy_full'
  END
SET s.plan_id = p.id
WHERE s.plan_id IS NULL;

DROP PROCEDURE IF EXISTS add_plan_catalog_constraints;

DELIMITER //

CREATE PROCEDURE add_plan_catalog_constraints()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'suscripciones'
      AND index_name = 'idx_suscripciones_plan_id'
  ) THEN
    ALTER TABLE suscripciones
      ADD KEY idx_suscripciones_plan_id (plan_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'suscripciones'
      AND index_name = 'idx_suscripciones_plan_programado'
  ) THEN
    ALTER TABLE suscripciones
      ADD KEY idx_suscripciones_plan_programado
        (plan_programado_id, cambio_plan_efectivo_en);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'suscripciones'
      AND constraint_name = 'fk_suscripciones_plan'
  ) THEN
    ALTER TABLE suscripciones
      ADD CONSTRAINT fk_suscripciones_plan
      FOREIGN KEY (plan_id) REFERENCES planes(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'suscripciones'
      AND constraint_name = 'fk_suscripciones_plan_programado'
  ) THEN
    ALTER TABLE suscripciones
      ADD CONSTRAINT fk_suscripciones_plan_programado
      FOREIGN KEY (plan_programado_id) REFERENCES planes(id)
      ON DELETE SET NULL;
  END IF;
END//

DELIMITER ;

CALL add_plan_catalog_constraints();

DROP PROCEDURE IF EXISTS add_plan_catalog_constraints;

ALTER TABLE suscripciones
  MODIFY COLUMN plan_id BIGINT UNSIGNED NOT NULL;

SELECT
  codigo,
  nombre,
  precio_mensual,
  max_usuarios,
  max_sucursales,
  activo,
  es_publico,
  asignable
FROM planes
ORDER BY orden, id;

SELECT
  p.codigo AS plan_codigo,
  COUNT(*) AS total_modulos
FROM planes p
LEFT JOIN plan_modulos pm
  ON pm.plan_id = p.id
 AND pm.habilitado = 1
GROUP BY p.id, p.codigo
ORDER BY p.orden, p.id;

SELECT
  p.codigo AS plan_canonico,
  s.plan AS plan_textual,
  COUNT(*) AS total
FROM suscripciones s
INNER JOIN planes p
  ON p.id = s.plan_id
GROUP BY p.codigo, s.plan
ORDER BY p.codigo, s.plan;
