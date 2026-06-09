-- Sprint 1.9.5 - Ajuste método de pago preferido clientes
-- Reemplaza valor legacy credito-tecnocell por transferencia.

UPDATE clientes
SET metodo_pago_preferido = 'transferencia'
WHERE metodo_pago_preferido = 'credito-tecnocell';

ALTER TABLE clientes
MODIFY COLUMN metodo_pago_preferido ENUM('efectivo','tarjeta','transferencia') NULL DEFAULT 'efectivo';
