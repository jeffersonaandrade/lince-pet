-- Os endereços veterinários usam UUID, assim como os cadastros de origem.
ALTER TABLE agendamentos ALTER COLUMN veterinario_endereco_id TYPE char(36)
  USING veterinario_endereco_id::char(36);
