-- Sprint 2D.5 - Arqueo y reposicion de Caja Chica.
-- Idempotente. No modifica caja_sesiones ni crea un libro financiero duplicado.

CREATE TABLE IF NOT EXISTS caja_chica_arqueos (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id            INT NOT NULL,
  sucursal_id           BIGINT UNSIGNED NOT NULL,
  saldo_teorico         DECIMAL(10,2) NOT NULL,
  monto_contado         DECIMAL(10,2) NOT NULL,
  diferencia            DECIMAL(10,2) NOT NULL,
  resultado             ENUM('CUADRADO','SOBRANTE','FALTANTE') NOT NULL,
  ultimo_movimiento_id  INT NULL,
  usuario_id            INT NOT NULL,
  usuario_nombre        VARCHAR(255) NOT NULL,
  observaciones         TEXT NULL,
  fecha_arqueo          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_caja_chica_arqueos_scope_fecha
    (empresa_id, sucursal_id, fecha_arqueo, id),
  KEY idx_caja_chica_arqueos_empresa_usuario_fecha
    (empresa_id, usuario_id, fecha_arqueo),
  KEY idx_caja_chica_arqueos_usuario_empresa
    (usuario_id, empresa_id),

  CONSTRAINT fk_caja_chica_arqueos_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_caja_chica_arqueos_sucursal
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_caja_chica_arqueos_usuario_empresa
    FOREIGN KEY (usuario_id, empresa_id)
    REFERENCES users(id, empresa_id) ON DELETE RESTRICT,
  CONSTRAINT chk_caja_chica_arqueos_monto
    CHECK (monto_contado >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permisos (codigo, modulo, accion, nombre, descripcion) VALUES
  ('caja.arquear', 'Caja y bancos', 'arquear', 'Registrar arqueos de Caja Chica', 'Registrar conteos y diferencias de Caja Chica por sucursal'),
  ('caja.reponer', 'Caja y bancos', 'reponer', 'Reponer Caja Chica desde banco', 'Trasladar fondos de una cuenta bancaria a Caja Chica'),
  ('caja.reponer_manual', 'Caja y bancos', 'reponer_manual', 'Reponer Caja Chica manualmente', 'Registrar ingresos manuales autorizados a Caja Chica')
ON DUPLICATE KEY UPDATE
  modulo = VALUES(modulo),
  accion = VALUES(accion),
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion);

-- Compatibilidad inicial: solo combinaciones empresa/rol ADMINISTRADOR
-- realmente asignadas a usuarios de esa empresa reciben estos permisos.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT DISTINCT u.empresa_id, r.id, p.id
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id
INNER JOIN roles r ON r.id = ur.role_id
CROSS JOIN permisos p
WHERE UPPER(r.nombre) = 'ADMINISTRADOR'
  AND u.empresa_id IS NOT NULL
  AND p.codigo IN ('caja.arquear', 'caja.reponer', 'caja.reponer_manual');
