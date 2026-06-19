ALTER TABLE deudores
  ADD UNIQUE KEY uq_deudores_empresa_credito
    (empresa_id, numero_credito);

DROP TRIGGER IF EXISTS before_insert_deudores;

DELIMITER //

CREATE TRIGGER before_insert_deudores
BEFORE INSERT ON deudores
FOR EACH ROW
BEGIN
  DECLARE next_num INT;

  SELECT
    COALESCE(
      MAX(
        CAST(
          SUBSTRING_INDEX(numero_credito, '-', -1)
          AS UNSIGNED
        )
      ),
      0
    ) + 1
  INTO next_num
  FROM deudores
  WHERE empresa_id = NEW.empresa_id
    AND numero_credito LIKE CONCAT(
      'CR-',
      YEAR(CURDATE()),
      '-%'
    );

  SET NEW.numero_credito = CONCAT(
    'CR-',
    YEAR(CURDATE()),
    '-',
    LPAD(next_num, 4, '0')
  );

  SET NEW.saldo_pendiente =
    NEW.monto_total - NEW.monto_pagado;
END//

DELIMITER ;
