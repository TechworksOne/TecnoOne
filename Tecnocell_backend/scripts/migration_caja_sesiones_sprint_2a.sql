-- Sprint 2A - Sesiones operativas de caja por sucursal.
-- Idempotente. No modifica caja_chica, ventas ni reparaciones.

-- ── 1. Índice único en cajas(empresa_id, sucursal_id, id) ────────────────────
-- Requerido para la FK compuesta de caja_sesiones.
CREATE UNIQUE INDEX IF NOT EXISTS uk_cajas_empresa_sucursal_id
  ON cajas (empresa_id, sucursal_id, id);

-- ── 2. Tabla de sesiones de caja ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caja_sesiones (
  id                         BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
  empresa_id                 INT                 NOT NULL,
  sucursal_id                BIGINT UNSIGNED     NOT NULL,
  caja_id                    BIGINT UNSIGNED     NOT NULL,
  usuario_apertura_id        INT                 NOT NULL,
  fondo_inicial_centavos     INT                 NOT NULL DEFAULT 0,
  estado                     ENUM('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
  fecha_apertura             TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre               TIMESTAMP           NULL     DEFAULT NULL,
  efectivo_esperado_centavos INT                 NULL,
  efectivo_contado_centavos  INT                 NULL,
  diferencia_centavos        INT                 NULL,
  cerrado_por                INT                 NULL,
  notas_cierre               VARCHAR(500)        NULL,
  created_at                 TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Columna generada: solo lleva valor cuando ABIERTA; NULL para CERRADA.
  -- NULLs son ignorados en UNIQUE → permite múltiples filas CERRADA.
  sesion_abierta_caja    BIGINT UNSIGNED AS (IF(estado='ABIERTA', caja_id, NULL))            PERSISTENT,
  sesion_abierta_usuario INT             AS (IF(estado='ABIERTA', usuario_apertura_id, NULL)) PERSISTENT,

  PRIMARY KEY (id),

  -- Una sola sesión ABIERTA por caja dentro de empresa+sucursal
  UNIQUE KEY uk_sesion_caja_abierta    (empresa_id, sucursal_id, sesion_abierta_caja),
  -- Una sola sesión ABIERTA por usuario dentro de la empresa
  UNIQUE KEY uk_sesion_usuario_abierta (empresa_id, sesion_abierta_usuario),

  KEY idx_sesiones_scope        (empresa_id, sucursal_id, estado),
  KEY idx_sesiones_caja_estado  (empresa_id, sucursal_id, caja_id, estado),

  CONSTRAINT fk_sesion_caja
    FOREIGN KEY (empresa_id, sucursal_id, caja_id)
    REFERENCES cajas(empresa_id, sucursal_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_sesion_sucursal
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_sesion_usuario_apertura
    FOREIGN KEY (usuario_apertura_id)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sesion_cerrado_por
    FOREIGN KEY (cerrado_por)
    REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT chk_sesion_fondo   CHECK (fondo_inicial_centavos >= 0),
  CONSTRAINT chk_sesion_cierre  CHECK (
    (estado = 'CERRADA' AND fecha_cierre IS NOT NULL)
    OR estado = 'ABIERTA'
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Permisos ───────────────────────────────────────────────────────────────
INSERT INTO permisos (codigo, modulo, accion, nombre, descripcion) VALUES
  ('cajas.sesion.ver',    'Cajas', 'sesion_ver',    'Ver sesiones de caja',    'Consultar historial de sesiones de caja'),
  ('cajas.sesion.operar', 'Cajas', 'sesion_operar', 'Operar sesiones de caja', 'Abrir y cerrar sesiones de caja')
ON DUPLICATE KEY UPDATE
  modulo = VALUES(modulo), accion = VALUES(accion),
  nombre = VALUES(nombre), descripcion = VALUES(descripcion);

-- ADMINISTRADOR recibe consulta administrativa y operación
-- para cada empresa del tenant.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT e.id, r.id, p.id
FROM empresas e
CROSS JOIN roles r
CROSS JOIN permisos p
WHERE UPPER(r.nombre) = 'ADMINISTRADOR'
  AND p.codigo IN ('cajas.sesion.ver', 'cajas.sesion.operar');

-- VENTAS puede operar únicamente su propia sesión de caja.
-- No recibe acceso automático al historial administrativo.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT e.id, r.id, p.id
FROM empresas e
CROSS JOIN roles r
CROSS JOIN permisos p
WHERE UPPER(r.nombre) = 'VENTAS'
  AND p.codigo = 'cajas.sesion.operar';
