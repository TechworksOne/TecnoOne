-- ============================================================
-- Módulo Deudores v2 – Añadir plan de cuotas y tipo de origen
-- Ejecutar en la base de datos de Tecnocell
-- ============================================================

-- 1. Ampliar tabla deudores con nuevos campos
ALTER TABLE `deudores`
  ADD COLUMN IF NOT EXISTS `tipo_origen`       ENUM('VENTA','REPARACION','MANUAL') NOT NULL DEFAULT 'MANUAL'   AFTER `numero_credito`,
  ADD COLUMN IF NOT EXISTS `numero_cuotas`     INT          NOT NULL DEFAULT 1                                  AFTER `referencia_reparacion_id`,
  ADD COLUMN IF NOT EXISTS `monto_cuota`       DECIMAL(12,2) NOT NULL DEFAULT 0.00                             AFTER `numero_cuotas`,
  ADD COLUMN IF NOT EXISTS `frecuencia_pago`   ENUM('SEMANAL','QUINCENAL','MENSUAL') DEFAULT 'MENSUAL'          AFTER `monto_cuota`,
  ADD COLUMN IF NOT EXISTS `fecha_primer_pago` DATE          DEFAULT NULL                                       AFTER `frecuencia_pago`,
  ADD COLUMN IF NOT EXISTS `items_detalle`     TEXT          DEFAULT NULL                                       AFTER `notas`;

-- 2. Ampliar tabla deudores_pagos para soportar plan de cuotas
ALTER TABLE `deudores_pagos`
  ADD COLUMN IF NOT EXISTS `numero_cuota`    INT            DEFAULT NULL          AFTER `deudor_id`,
  ADD COLUMN IF NOT EXISTS `monto_programado` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `monto`,
  ADD COLUMN IF NOT EXISTS `fecha_vencimiento` DATE          DEFAULT NULL          AFTER `monto_programado`,
  ADD COLUMN IF NOT EXISTS `estado_cuota`    ENUM('PENDIENTE','PARCIAL','PAGADO','VENCIDO') NOT NULL DEFAULT 'PENDIENTE' AFTER `fecha_vencimiento`;

-- 3. Actualizar registros existentes: calcular monto_cuota donde sea 0
UPDATE `deudores`
SET `monto_cuota` = `monto_total`
WHERE `monto_cuota` = 0 AND `numero_cuotas` = 1;
