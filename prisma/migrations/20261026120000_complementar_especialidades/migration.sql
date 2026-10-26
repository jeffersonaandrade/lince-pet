-- Completa o catálogo sem alterar IDs, vínculos ou ativação de registros existentes.
INSERT INTO "especialidades" ("id", "nome", "ativo", "created_at", "updated_at")
SELECT gen_random_uuid()::text, novos.nome, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('Acupuntura Veterinária'),
  ('Acupuntura e Medicina Integrativa'),
  ('Anestesiologia Veterinária'),
  ('Cardiologia Veterinária'),
  ('Cirurgia de Grandes Animais'),
  ('Cirurgia de Pequenos Animais'),
  ('Cirurgia Geral (Tecidos Moles)'),
  ('Clínica Médica de Grandes Animais'),
  ('Clínica Médica de Pequenos Animais'),
  ('Comportamento animal'),
  ('Dermatologia Veterinária'),
  ('Diagnóstico por Imagem Veterinária'),
  ('Endocrinologia Veterinária'),
  ('Fisioterapia e Reabilitação'),
  ('Gastrologia Veterinária'),
  ('Hematologia Veterinária'),
  ('Homeopatia Veterinária'),
  ('Infectologia'),
  ('Inspeção Higiênica, Sanitária e Tecnológica de Produtos de Origem Animal'),
  ('Medicina de Animais Aquáticos'),
  ('Medicina Felina'),
  ('Medicina Legal Veterinária'),
  ('Medicina Veterinária de Animais silvestres/exóticos'),
  ('Medicina Veterinária de Urgência e Emergência'),
  ('Medicina Veterinária do Coletivo'),
  ('Medicina Veterinária Intensiva'),
  ('Medicina Veterinária Preventiva'),
  ('Nefrologia e Urologia Veterinárias'),
  ('Neurologia Veterinária'),
  ('Nutrição Animal'),
  ('Nutrologia'),
  ('Odontologia'),
  ('Oftalmologia Veterinária'),
  ('Oncologia Veterinária'),
  ('Ortopedia Veterinária'),
  ('Patologia clínica veterinária'),
  ('Patologia Veterinária'),
  ('Pediatria e Geriatria'),
  ('Pneumologia'),
  ('Reprodução Animal')
) AS novos(nome)
WHERE NOT EXISTS (
  SELECT 1 FROM "especialidades" existentes
  WHERE lower(trim(existentes.nome)) = lower(novos.nome)
)
ON CONFLICT ("nome") DO NOTHING;
