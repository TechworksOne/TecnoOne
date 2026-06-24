SET @BASE_EMPRESA_ID = (SELECT MIN(id) FROM empresas);

ALTER TABLE categorias ADD COLUMN IF NOT EXISTS empresa_id INT(11) NULL AFTER id;
ALTER TABLE subcategorias ADD COLUMN IF NOT EXISTS empresa_id INT(11) NULL AFTER id;
ALTER TABLE equipos_marcas ADD COLUMN IF NOT EXISTS empresa_id INT(11) NULL AFTER id;
ALTER TABLE equipos_modelos ADD COLUMN IF NOT EXISTS empresa_id INT(11) NULL AFTER id;
ALTER TABLE marcas ADD COLUMN IF NOT EXISTS empresa_id INT(11) NULL AFTER id;
ALTER TABLE lineas ADD COLUMN IF NOT EXISTS empresa_id INT(11) NULL AFTER id;

UPDATE categorias SET empresa_id = @BASE_EMPRESA_ID WHERE empresa_id IS NULL;
UPDATE subcategorias SET empresa_id = @BASE_EMPRESA_ID WHERE empresa_id IS NULL;
UPDATE equipos_marcas SET empresa_id = @BASE_EMPRESA_ID WHERE empresa_id IS NULL;
UPDATE equipos_modelos SET empresa_id = @BASE_EMPRESA_ID WHERE empresa_id IS NULL;
UPDATE marcas SET empresa_id = @BASE_EMPRESA_ID WHERE empresa_id IS NULL;
UPDATE lineas SET empresa_id = @BASE_EMPRESA_ID WHERE empresa_id IS NULL;
