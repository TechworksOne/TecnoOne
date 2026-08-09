-- Sprint 2B.1
-- Agrega persistencia para pagos adicionales de reparaciones.
--
-- IMPORTANTE:
-- No se realiza backfill de total_pagado ni estado_pago.
-- Existen datos históricos/seed con convenciones monetarias anteriores
-- e inconsistencias entre total y monto_anticipo.
--
-- A partir de esta versión, el backend mantiene:
--
-- total_pagado =
--   monto_anticipo
--   + monto_pagado_adicional
--   + monto_pago_final
--
-- para las operaciones nuevas.

ALTER TABLE reparaciones
  ADD COLUMN IF NOT EXISTS monto_pagado_adicional INT NOT NULL DEFAULT 0
  AFTER saldo_anticipo;

ALTER TABLE reparaciones
  ADD COLUMN IF NOT EXISTS metodo_pago_adicional VARCHAR(30) NULL
  AFTER monto_pagado_adicional;
