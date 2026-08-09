-- ============================================================
-- TecnoOne
-- Sprint 2D.1 - Caja Chica Multisucursal
--
-- Estructural únicamente.
-- NO reasigna movimientos históricos a sucursales arbitrarias.
--
-- Los registros legacy existentes permanecen con sucursal_id NULL.
-- Todos los nuevos movimientos deberán registrar una sucursal.
-- ============================================================

ALTER TABLE caja_chica
  ADD COLUMN IF NOT EXISTS sucursal_id BIGINT UNSIGNED NULL
  AFTER empresa_id;

CREATE INDEX IF NOT EXISTS idx_caja_chica_empresa_sucursal
  ON caja_chica (empresa_id, sucursal_id);

CREATE INDEX IF NOT EXISTS idx_caja_chica_scope_estado
  ON caja_chica (
    empresa_id,
    sucursal_id,
    estado,
    fecha_movimiento
  );
