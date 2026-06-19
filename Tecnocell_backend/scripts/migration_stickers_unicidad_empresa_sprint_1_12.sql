ALTER TABLE stickers_garantia
  DROP INDEX numero_sticker,
  ADD UNIQUE KEY uq_stickers_empresa_numero
    (empresa_id, numero_sticker);

ALTER TABLE sticker_lotes
  DROP INDEX codigo_lote,
  ADD UNIQUE KEY uq_sticker_lotes_empresa_codigo
    (empresa_id, codigo_lote);
