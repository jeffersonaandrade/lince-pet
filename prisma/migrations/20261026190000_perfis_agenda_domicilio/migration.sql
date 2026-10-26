-- Preserva os agendamentos antigos: duração histórica de 30 min, sem deslocamento retroativo.
ALTER TABLE veterinarios
  ADD COLUMN IF NOT EXISTS duracao_presencial_min integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS duracao_online_min integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS duracao_domicilio_min integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS deslocamento_min integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS horarios_domicilio jsonb,
  ADD COLUMN IF NOT EXISTS preco_consulta_domicilio numeric(10,2);
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS veterinario_endereco_id integer,
  ADD COLUMN IF NOT EXISTS duracao_min integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS deslocamento_min integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS veterinarios_user_id_agenda_idx ON veterinarios(user_id);
CREATE INDEX IF NOT EXISTS prestadores_user_id_agenda_idx ON prestadores(user_id);
CREATE INDEX IF NOT EXISTS agendamentos_vet_data_agenda_idx ON agendamentos(veterinario_id, data_consulta);
