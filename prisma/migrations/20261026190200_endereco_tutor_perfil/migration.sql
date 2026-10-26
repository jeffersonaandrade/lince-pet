ALTER TABLE tutores ADD COLUMN IF NOT EXISTS endereco jsonb;
UPDATE tutores t SET endereco = jsonb_build_object(
  'cep', u.cep, 'rua', u.rua, 'numero', u.numero, 'bairro', u.bairro, 'cidade', u.cidade, 'estado', u.estado
) FROM users u WHERE u.id = t.user_id AND t.endereco IS NULL;
