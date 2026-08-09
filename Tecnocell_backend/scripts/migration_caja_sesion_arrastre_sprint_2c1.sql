-- Sprint 2C.1
-- Arrastre controlado de efectivo entre sesiones operativas de caja.
--
-- IMPORTANTE:
-- Migración únicamente estructural.
-- No modifica ni interpreta sesiones históricas.
--
-- Reglas nuevas mantenidas por backend:
--
-- Al abrir:
--   fondo_sugerido_centavos =
--     fondo_siguiente_centavos del último cierre de la misma caja.
--
--   diferencia_apertura_centavos =
--     fondo_inicial_centavos - fondo_sugerido_centavos.
--
-- En la primera apertura histórica:
--   fondo_sugerido_centavos = NULL
--   diferencia_apertura_centavos = NULL
--
-- Al cerrar:
--   retiro_cierre_centavos =
--     efectivo_contado_centavos - fondo_siguiente_centavos.

ALTER TABLE caja_sesiones
  ADD COLUMN IF NOT EXISTS fondo_sugerido_centavos INT NULL
  AFTER fondo_inicial_centavos;

ALTER TABLE caja_sesiones
  ADD COLUMN IF NOT EXISTS diferencia_apertura_centavos INT NULL
  AFTER fondo_sugerido_centavos;

ALTER TABLE caja_sesiones
  ADD COLUMN IF NOT EXISTS fondo_siguiente_centavos INT NULL
  AFTER diferencia_centavos;

ALTER TABLE caja_sesiones
  ADD COLUMN IF NOT EXISTS retiro_cierre_centavos INT NULL
  AFTER fondo_siguiente_centavos;
