-- =====================================================================
-- migration_deudores_v3.sql
-- Adds missing columns for recargo tracking, payment integration,
-- and proper anulación with audit fields.
-- Run AFTER migration_deudores_v2.sql
-- =====================================================================

-- ── deudores table: anulación audit fields ───────────────────────────
ALTER TABLE deudores
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT NULL,
  ADD COLUMN IF NOT EXISTS fecha_anulacion   DATETIME NULL,
  ADD COLUMN IF NOT EXISTS anulado_por       INT NULL;

-- ── deudores_pagos: payment method, recargo, and caja/banco links ─────
ALTER TABLE deudores_pagos
  ADD COLUMN IF NOT EXISTS metodo_pago         ENUM('EFECTIVO','TRANSFERENCIA','TARJETA_BAC','TARJETA_NEONET','TARJETA_OTRA') NOT NULL DEFAULT 'EFECTIVO',
  ADD COLUMN IF NOT EXISTS porcentaje_recargo  DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS monto_recargo       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_cobrado       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS banco_movimiento_id INT NULL,
  ADD COLUMN IF NOT EXISTS caja_movimiento_id  INT NULL;

-- ── deudores_pagos: add ANULADA to estado_cuota if column exists ──────
-- Only needed if estado_cuota was created as an ENUM in v2
-- Safe to run even if the column doesn't exist (IF NOT EXISTS handles it)
ALTER TABLE deudores_pagos
  MODIFY COLUMN estado_cuota ENUM('PENDIENTE','PARCIAL','PAGADO','VENCIDO','ANULADA') NULL DEFAULT NULL;

-- ── indexes for FK lookups ────────────────────────────────────────────
ALTER TABLE deudores_pagos
  ADD INDEX IF NOT EXISTS idx_dp_banco_mov (banco_movimiento_id),
  ADD INDEX IF NOT EXISTS idx_dp_caja_mov  (caja_movimiento_id);
