-- O cadastro marcava o primeiro endereço como preferido sem o veterinário escolher.
-- A busca e a estrela do agendamento passam a depender de uma marca feita no perfil.
UPDATE veterinario_enderecos
SET is_primary = 0,
    updated_at = (NOW() AT TIME ZONE 'UTC')
WHERE is_primary = 1;
