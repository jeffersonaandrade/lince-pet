-- Testes já concedidos em subscriptions.trial_end são preservados.
UPDATE subscription_plans SET trial_days = 0, updated_at = (NOW() AT TIME ZONE 'UTC') WHERE code IN ('free', 'pro', 'pro_plus', 'vet_starter', 'vet_pro');
-- Freemium de perfis individuais. Não altera clínicas, exames, planos pagos ou cortesias.
UPDATE subscription_plans SET monthly_appointment_limit = 5, updated_at = (NOW() AT TIME ZONE 'UTC') WHERE code = 'free';
ALTER TABLE veterinarios ALTER COLUMN subscription_plan_code SET DEFAULT 'free';
UPDATE veterinarios SET subscription_plan_code = 'free', updated_at = (NOW() AT TIME ZONE 'UTC')
WHERE subscription_plan_code IS NULL OR subscription_plan_code IN ('none', '');

-- Preserva o mês de consumo das reservas anteriores à implantação.
UPDATE agendamentos SET
  cota_consumida_em = COALESCE(created_at, (NOW() AT TIME ZONE 'UTC')),
  cota_liberada_em = CASE WHEN lower(status) IN ('cancelado', 'cancelada', 'recusado', 'recusada') AND started_at IS NULL
    THEN COALESCE(updated_at, created_at, (NOW() AT TIME ZONE 'UTC')) ELSE NULL END
WHERE veterinario_id IS NOT NULL AND cota_consumida_em IS NULL;

CREATE INDEX agendamentos_vet_cota_idx ON agendamentos(veterinario_id, cota_consumida_em) WHERE cota_liberada_em IS NULL;
