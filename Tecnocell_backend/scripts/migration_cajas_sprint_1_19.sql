-- Sprint 1.19 - Catalogo operativo de cajas por empresa y sucursal.
-- Idempotente. No modifica caja_chica, cuentas_bancarias ni movimientos.

CREATE TABLE IF NOT EXISTS cajas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(50) NOT NULL,
  descripcion VARCHAR(255) NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cajas_sucursal_codigo (sucursal_id, codigo),
  KEY idx_cajas_empresa_sucursal_estado (empresa_id, sucursal_id, activa),
  CONSTRAINT fk_cajas_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cajas_sucursal_empresa
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_cajas_activa CHECK (activa IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill idempotente: crea una caja base en la sucursal principal solo para
-- empresas que todavia no tienen ninguna caja registrada.
INSERT INTO cajas (empresa_id, sucursal_id, nombre, codigo, descripcion, activa)
SELECT s.empresa_id, s.id, 'Caja principal', 'PRINCIPAL',
       'Caja creada por migracion inicial', 1
FROM sucursales s
WHERE s.es_principal = 1
  AND NOT EXISTS (SELECT 1 FROM cajas c WHERE c.empresa_id = s.empresa_id);

INSERT INTO permisos (codigo, modulo, accion, nombre, descripcion) VALUES
('cajas.ver', 'Cajas', 'ver', 'Ver cajas', 'Consultar el catalogo de cajas de la sucursal activa'),
('cajas.administrar', 'Cajas', 'administrar', 'Administrar cajas', 'Crear, editar, activar y desactivar cajas')
ON DUPLICATE KEY UPDATE
  modulo = VALUES(modulo), accion = VALUES(accion), nombre = VALUES(nombre), descripcion = VALUES(descripcion);

INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT r.empresa_id, r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE UPPER(r.nombre) = 'ADMINISTRADOR'
  AND p.codigo IN ('cajas.ver', 'cajas.administrar');
