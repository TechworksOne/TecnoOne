-- Sprint 1.5 - Tenant scope para reparaciones
-- Objetivo:
-- 1. Agregar reparaciones.empresa_id.
-- 2. Asociar reparaciones existentes a la empresa del cliente cuando exista.
-- 3. Usar empresa demo (id = 1) para reparaciones historicas sin cliente.
-- 4. Dejar empresa_id como NOT NULL para aislamiento multiempresa.
-- 5. Crear indice y llave foranea hacia empresas(id).
-- 6. No borrar datos existentes.

ALTER TABLE reparaciones
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE reparaciones r
LEFT JOIN clientes c ON c.id = r.cliente_id
SET r.empresa_id = COALESCE(c.empresa_id, 1)
WHERE r.empresa_id IS NULL;

ALTER TABLE reparaciones
  MODIFY empresa_id INT NOT NULL;

CREATE INDEX idx_reparaciones_empresa_id ON reparaciones(empresa_id);

ALTER TABLE reparaciones
  ADD CONSTRAINT fk_reparaciones_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);

-- Validacion rapida.
SELECT empresa_id, COUNT(*) AS total_reparaciones
FROM reparaciones
GROUP BY empresa_id
ORDER BY empresa_id;
