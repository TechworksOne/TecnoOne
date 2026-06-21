CREATE TABLE IF NOT EXISTS permisos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(100) NOT NULL,
  modulo VARCHAR(80) NOT NULL,
  accion VARCHAR(50) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  descripcion VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permisos_codigo (codigo),
  KEY idx_permisos_modulo (modulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rol_permisos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  rol_id INT NOT NULL,
  permiso_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rol_permisos_empresa_rol_permiso (empresa_id, rol_id, permiso_id),
  KEY idx_rol_permisos_empresa_rol (empresa_id, rol_id),
  KEY idx_rol_permisos_permiso (permiso_id),
  CONSTRAINT fk_rol_permisos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_rol_permisos_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rol_permisos_permiso FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permisos (codigo, modulo, accion, nombre, descripcion) VALUES
('dashboard.ver', 'Dashboard', 'ver', 'Ver dashboard', 'Acceder al panel principal'),
('productos.ver', 'Productos', 'ver', 'Ver productos', 'Consultar productos'),
('repuestos.ver', 'Repuestos', 'ver', 'Ver repuestos', 'Consultar repuestos'),
('compras.ver', 'Compras', 'ver', 'Ver compras', 'Consultar compras'),
('compras.crear', 'Compras', 'crear', 'Crear compras', 'Registrar compras'),
('compras.anular', 'Compras', 'anular', 'Anular compras', 'Anular compras registradas'),
('cotizaciones.ver', 'Cotizaciones', 'ver', 'Ver cotizaciones', 'Consultar cotizaciones'),
('cotizaciones.editar', 'Cotizaciones', 'editar', 'Gestionar cotizaciones', 'Crear y editar cotizaciones'),
('ventas.ver', 'Ventas', 'ver', 'Ver ventas', 'Consultar ventas'),
('ventas.crear', 'Ventas', 'crear', 'Crear ventas', 'Registrar ventas'),
('ventas.editar', 'Ventas', 'editar', 'Gestionar pagos', 'Registrar pagos y comprobantes de ventas'),
('ventas.anular', 'Ventas', 'anular', 'Anular ventas', 'Anular ventas registradas'),
('reparaciones.ver', 'Reparaciones', 'ver', 'Ver reparaciones', 'Consultar reparaciones'),
('reparaciones.crear', 'Reparaciones', 'crear', 'Crear reparaciones', 'Registrar reparaciones'),
('reparaciones.editar', 'Reparaciones', 'editar', 'Editar reparaciones', 'Actualizar reparaciones, estados y pagos'),
('reparaciones.asignar_tecnico', 'Reparaciones', 'asignar_tecnico', 'Asignar técnicos', 'Asignar o retirar técnicos'),
('flujo_reparaciones.ver', 'Flujo de reparaciones', 'ver', 'Ver flujo de reparaciones', 'Consultar el flujo técnico'),
('ordenes_trabajo.ver', 'Órdenes de trabajo', 'ver', 'Ver órdenes de trabajo', 'Consultar órdenes de trabajo'),
('agenda.ver', 'Agenda', 'ver', 'Ver agenda', 'Consultar agenda de entregas'),
('stickers.ver', 'Stickers', 'ver', 'Gestionar stickers', 'Acceder al módulo de stickers'),
('clientes.ver', 'Clientes', 'ver', 'Ver clientes', 'Consultar clientes'),
('clientes.crear', 'Clientes', 'crear', 'Gestionar clientes', 'Crear y editar clientes'),
('proveedores.ver', 'Proveedores', 'ver', 'Gestionar proveedores', 'Acceder a proveedores'),
('caja.ver', 'Caja y bancos', 'ver', 'Ver caja y bancos', 'Consultar caja y cuentas bancarias'),
('caja.operar', 'Caja y bancos', 'operar', 'Operar caja', 'Registrar y confirmar movimientos'),
('bancos.administrar', 'Caja y bancos', 'administrar', 'Administrar bancos', 'Gestionar cuentas y transferencias bancarias'),
('deudores.ver', 'Deudores', 'ver', 'Ver deudores', 'Consultar deudores'),
('reportes.ver', 'Reportes', 'ver', 'Ver reportes', 'Consultar reportes administrativos'),
('usuarios.administrar', 'Usuarios', 'administrar', 'Administrar usuarios', 'Crear, editar y gestionar usuarios y roles'),
('permisos.administrar', 'Permisos', 'administrar', 'Administrar permisos', 'Configurar permisos por rol'),
('empresa.editar', 'Empresa', 'editar', 'Editar empresa', 'Modificar la configuración de la empresa'),
('auditoria.ver', 'Auditoría', 'ver', 'Ver auditoría', 'Consultar registros de auditoría')
ON DUPLICATE KEY UPDATE
  modulo = VALUES(modulo),
  accion = VALUES(accion),
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion);

-- Normaliza usuarios legacy para que la resolución por user_roles no les quite acceso.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
INNER JOIN roles r ON UPPER(r.nombre) = CASE
  WHEN u.role = 'admin' THEN 'ADMINISTRADOR'
  WHEN u.role = 'tecnico' THEN 'TECNICO'
  ELSE 'VENTAS'
END
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id
);

-- Todo rol actualmente asignado conserva los módulos abiertos a cualquier usuario autenticado.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT DISTINCT u.empresa_id, ur.role_id, p.id
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id
INNER JOIN permisos p ON p.codigo IN (
  'dashboard.ver', 'repuestos.ver', 'flujo_reparaciones.ver',
  'agenda.ver', 'caja.ver', 'caja.operar'
)
WHERE u.empresa_id IS NOT NULL;

-- ADMINISTRADOR conserva acceso total.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT DISTINCT u.empresa_id, r.id, p.id
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id
INNER JOIN roles r ON r.id = ur.role_id AND UPPER(r.nombre) = 'ADMINISTRADOR'
CROSS JOIN permisos p
WHERE u.empresa_id IS NOT NULL;

-- VENTAS conserva los módulos actualmente disponibles.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT DISTINCT u.empresa_id, r.id, p.id
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id
INNER JOIN roles r ON r.id = ur.role_id AND UPPER(r.nombre) = 'VENTAS'
INNER JOIN permisos p ON p.codigo IN (
  'productos.ver', 'cotizaciones.ver', 'cotizaciones.editar',
  'ventas.ver', 'ventas.crear', 'ventas.editar', 'ventas.anular',
  'reparaciones.ver', 'reparaciones.crear', 'reparaciones.editar',
  'clientes.ver', 'clientes.crear'
)
WHERE u.empresa_id IS NOT NULL;

-- TECNICO conserva reparaciones y órdenes de trabajo.
INSERT IGNORE INTO rol_permisos (empresa_id, rol_id, permiso_id)
SELECT DISTINCT u.empresa_id, r.id, p.id
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id
INNER JOIN roles r ON r.id = ur.role_id AND UPPER(r.nombre) = 'TECNICO'
INNER JOIN permisos p ON p.codigo IN (
  'reparaciones.ver', 'reparaciones.crear', 'reparaciones.editar',
  'ordenes_trabajo.ver'
)
WHERE u.empresa_id IS NOT NULL;
