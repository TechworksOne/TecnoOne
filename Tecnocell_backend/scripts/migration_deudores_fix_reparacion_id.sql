-- Fix: referencia_reparacion_id debe ser VARCHAR(50) porque reparaciones.id es VARCHAR(50)
-- Anteriormente era INT(11) lo que causaba error al guardar IDs como 'REP1779399664512'
USE tecnocell_web;

ALTER TABLE deudores
  MODIFY COLUMN referencia_reparacion_id VARCHAR(50) NULL DEFAULT NULL;
