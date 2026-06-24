SET @BASE_EMPRESA_ID = (SELECT MIN(id) FROM empresas);

DROP INDEX IF EXISTS nombre ON categorias;
DROP INDEX IF EXISTS nombre ON equipos_marcas;
DROP INDEX IF EXISTS nombre ON marcas;

INSERT INTO categorias (empresa_id, nombre, icono, orden, activo)
SELECT e.id, c.nombre, c.icono, c.orden, c.activo
FROM empresas e
JOIN categorias c ON c.empresa_id = @BASE_EMPRESA_ID
LEFT JOIN categorias x ON x.empresa_id = e.id AND x.nombre = c.nombre
WHERE e.id <> @BASE_EMPRESA_ID
  AND x.id IS NULL;

INSERT INTO subcategorias (empresa_id, categoria_id, nombre, orden, activo)
SELECT e.id, cat_dest.id, s.nombre, s.orden, s.activo
FROM empresas e
JOIN subcategorias s ON s.empresa_id = @BASE_EMPRESA_ID
JOIN categorias cat_base ON cat_base.id = s.categoria_id AND cat_base.empresa_id = @BASE_EMPRESA_ID
JOIN categorias cat_dest ON cat_dest.empresa_id = e.id AND cat_dest.nombre = cat_base.nombre
LEFT JOIN subcategorias x ON x.empresa_id = e.id AND x.categoria_id = cat_dest.id AND x.nombre = s.nombre
WHERE e.id <> @BASE_EMPRESA_ID
  AND x.id IS NULL;

INSERT INTO equipos_marcas (empresa_id, nombre, tipo_equipo, activo)
SELECT e.id, m.nombre, m.tipo_equipo, m.activo
FROM empresas e
JOIN equipos_marcas m ON m.empresa_id = @BASE_EMPRESA_ID
LEFT JOIN equipos_marcas x ON x.empresa_id = e.id AND x.nombre = m.nombre AND x.tipo_equipo = m.tipo_equipo
WHERE e.id <> @BASE_EMPRESA_ID
  AND x.id IS NULL;

INSERT INTO equipos_modelos (empresa_id, marca_id, nombre, activo)
SELECT e.id, marca_dest.id, mo.nombre, mo.activo
FROM empresas e
JOIN equipos_modelos mo ON mo.empresa_id = @BASE_EMPRESA_ID
JOIN equipos_marcas marca_base ON marca_base.id = mo.marca_id AND marca_base.empresa_id = @BASE_EMPRESA_ID
JOIN equipos_marcas marca_dest
  ON marca_dest.empresa_id = e.id
 AND marca_dest.nombre = marca_base.nombre
 AND marca_dest.tipo_equipo = marca_base.tipo_equipo
LEFT JOIN equipos_modelos x ON x.empresa_id = e.id AND x.marca_id = marca_dest.id AND x.nombre = mo.nombre
WHERE e.id <> @BASE_EMPRESA_ID
  AND x.id IS NULL;

INSERT INTO marcas (empresa_id, nombre, descripcion, logo_url, activo)
SELECT e.id, m.nombre, m.descripcion, m.logo_url, m.activo
FROM empresas e
JOIN marcas m ON m.empresa_id = @BASE_EMPRESA_ID
LEFT JOIN marcas x ON x.empresa_id = e.id AND x.nombre = m.nombre
WHERE e.id <> @BASE_EMPRESA_ID
  AND x.id IS NULL;

INSERT INTO lineas (empresa_id, marca_id, nombre, descripcion, activo)
SELECT e.id, marca_dest.id, l.nombre, l.descripcion, l.activo
FROM empresas e
JOIN lineas l ON l.empresa_id = @BASE_EMPRESA_ID
JOIN marcas marca_base ON marca_base.id = l.marca_id AND marca_base.empresa_id = @BASE_EMPRESA_ID
JOIN marcas marca_dest ON marca_dest.empresa_id = e.id AND marca_dest.nombre = marca_base.nombre
LEFT JOIN lineas x ON x.empresa_id = e.id AND x.marca_id = marca_dest.id AND x.nombre = l.nombre
WHERE e.id <> @BASE_EMPRESA_ID
  AND x.id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_categorias_empresa_nombre
ON categorias (empresa_id, nombre);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_subcategorias_empresa_categoria_nombre
ON subcategorias (empresa_id, categoria_id, nombre);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_equipos_marcas_empresa_nombre_tipo
ON equipos_marcas (empresa_id, nombre, tipo_equipo);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_equipos_modelos_empresa_marca_nombre
ON equipos_modelos (empresa_id, marca_id, nombre);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_marcas_empresa_nombre
ON marcas (empresa_id, nombre);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_lineas_empresa_marca_nombre
ON lineas (empresa_id, marca_id, nombre);

CREATE INDEX IF NOT EXISTS idx_categorias_empresa ON categorias (empresa_id);
CREATE INDEX IF NOT EXISTS idx_subcategorias_empresa ON subcategorias (empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipos_marcas_empresa ON equipos_marcas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipos_modelos_empresa ON equipos_modelos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_marcas_empresa ON marcas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_lineas_empresa ON lineas (empresa_id);

ALTER TABLE categorias MODIFY empresa_id INT(11) NOT NULL;
ALTER TABLE subcategorias MODIFY empresa_id INT(11) NOT NULL;
ALTER TABLE equipos_marcas MODIFY empresa_id INT(11) NOT NULL;
ALTER TABLE equipos_modelos MODIFY empresa_id INT(11) NOT NULL;
ALTER TABLE marcas MODIFY empresa_id INT(11) NOT NULL;
ALTER TABLE lineas MODIFY empresa_id INT(11) NOT NULL;
