-- Sprint 1.21 - Existencias de productos por sucursal.
-- Idempotente. Conserva productos.stock y no elimina datos legados.

CREATE UNIQUE INDEX IF NOT EXISTS uk_productos_empresa_id
  ON productos (empresa_id, id);

CREATE TABLE IF NOT EXISTS producto_existencias (
  empresa_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,
  producto_id INT NOT NULL,
  existencia INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, sucursal_id, producto_id),
  UNIQUE KEY uk_producto_existencia_sucursal
    (empresa_id, producto_id, sucursal_id),
  KEY idx_producto_existencias_consulta
    (empresa_id, producto_id, sucursal_id, existencia),
  CONSTRAINT fk_producto_existencias_producto
    FOREIGN KEY (empresa_id, producto_id)
    REFERENCES productos(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_producto_existencias_sucursal
    FOREIGN KEY (empresa_id, sucursal_id)
    REFERENCES sucursales(empresa_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_producto_existencias_no_negativa CHECK (existencia >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS producto_movimientos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  sucursal_id BIGINT UNSIGNED NOT NULL,
  producto_id INT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  cantidad INT NOT NULL,
  existencia_anterior INT NOT NULL,
  existencia_nueva INT NOT NULL,
  nota VARCHAR(500) NULL,
  usuario_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_producto_movimientos_kardex
    (empresa_id, sucursal_id, producto_id, created_at, id),
  KEY idx_producto_movimientos_usuario (usuario_id),
  CONSTRAINT fk_producto_movimientos_existencia
    FOREIGN KEY (empresa_id, sucursal_id, producto_id)
    REFERENCES producto_existencias(empresa_id, sucursal_id, producto_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_producto_movimientos_usuario
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_producto_movimientos_resultado CHECK (
    existencia_anterior >= 0 AND existencia_nueva >= 0 AND cantidad <> 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS validar_backfill_inventario_sprint_1_21;
DELIMITER $$
CREATE PROCEDURE validar_backfill_inventario_sprint_1_21()
BEGIN
  IF EXISTS (SELECT 1 FROM productos WHERE stock < 0) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Backfill inventario ambiguo: existen productos con stock negativo';
  END IF;

  IF EXISTS (
    SELECT p.empresa_id
    FROM productos p
    LEFT JOIN sucursales s
      ON s.empresa_id = p.empresa_id
     AND s.es_principal = 1
     AND s.activa = 1
    WHERE NOT EXISTS (
      SELECT 1
      FROM producto_existencias pe
      WHERE pe.empresa_id = p.empresa_id
        AND pe.producto_id = p.id
    )
    GROUP BY p.empresa_id
    HAVING COUNT(DISTINCT s.id) <> 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Backfill inventario ambiguo: empresa sin una unica sucursal principal activa';
  END IF;
END$$
DELIMITER ;

CALL validar_backfill_inventario_sprint_1_21();
DROP PROCEDURE IF EXISTS validar_backfill_inventario_sprint_1_21;

-- Solo inicializa productos que aun no tienen existencias nuevas. Una
-- reejecucion no sobrescribe saldos ya operados ni reparte stock.
INSERT INTO producto_existencias (
  empresa_id, sucursal_id, producto_id, existencia
)
SELECT p.empresa_id, s.id, p.id, p.stock
FROM productos p
INNER JOIN sucursales s
  ON s.empresa_id = p.empresa_id
 AND s.es_principal = 1
 AND s.activa = 1
WHERE NOT EXISTS (
  SELECT 1
  FROM producto_existencias pe
  WHERE pe.empresa_id = p.empresa_id
    AND pe.producto_id = p.id
);
