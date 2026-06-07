-- Sprint 1.7.4 - Tenant scope para deudores y pagos.
-- Ejecutar una sola vez contra la base de datos TecnoOne.

ALTER TABLE deudores
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE deudores d
JOIN clientes c ON c.id = d.cliente_id
SET d.empresa_id = c.empresa_id
WHERE d.empresa_id IS NULL
  AND d.cliente_id IS NOT NULL
  AND c.empresa_id IS NOT NULL;

UPDATE deudores d
JOIN ventas v ON v.id = d.referencia_venta_id
SET d.empresa_id = v.empresa_id
WHERE d.empresa_id IS NULL
  AND d.referencia_venta_id IS NOT NULL
  AND v.empresa_id IS NOT NULL;

UPDATE deudores d
JOIN reparaciones r ON r.id = d.referencia_reparacion_id
SET d.empresa_id = r.empresa_id
WHERE d.empresa_id IS NULL
  AND d.referencia_reparacion_id IS NOT NULL
  AND r.empresa_id IS NOT NULL;

UPDATE deudores
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE deudores
  MODIFY COLUMN empresa_id INT NOT NULL;

CREATE INDEX idx_deudores_empresa_id
  ON deudores (empresa_id);

CREATE INDEX idx_deudores_empresa_cliente
  ON deudores (empresa_id, cliente_id);

CREATE INDEX idx_deudores_empresa_estado
  ON deudores (empresa_id, estado);

CREATE INDEX idx_deudores_empresa_origen
  ON deudores (empresa_id, tipo_origen);

ALTER TABLE deudores
  ADD CONSTRAINT fk_deudores_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);

ALTER TABLE deudores_pagos
  ADD COLUMN empresa_id INT NULL AFTER id;

UPDATE deudores_pagos p
JOIN deudores d ON d.id = p.deudor_id
SET p.empresa_id = d.empresa_id
WHERE p.empresa_id IS NULL;

UPDATE deudores_pagos
SET empresa_id = 1
WHERE empresa_id IS NULL;

ALTER TABLE deudores_pagos
  MODIFY COLUMN empresa_id INT NOT NULL;

CREATE INDEX idx_deudores_pagos_empresa_id
  ON deudores_pagos (empresa_id);

CREATE INDEX idx_deudores_pagos_empresa_deudor
  ON deudores_pagos (empresa_id, deudor_id);

ALTER TABLE deudores_pagos
  ADD CONSTRAINT fk_deudores_pagos_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id);
