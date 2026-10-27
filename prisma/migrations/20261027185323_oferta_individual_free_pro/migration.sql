-- Decisão de 27/10/2026: somente Gratuito e Pro para novas adesões individuais.
-- Mantém IDs, preços, assinaturas, cortesias e o acesso de assinantes Starter existentes.
UPDATE subscription_plans
SET active = 0, updated_at = (NOW() AT TIME ZONE 'UTC')
WHERE code = 'vet_starter';

-- Gestão financeira fica para v2; o dashboard disponível é o básico.
UPDATE subscription_plans
SET features = '["complete_profile","featured_search","whatsapp_notifications","basic_dashboard"]'::jsonb,
    updated_at = (NOW() AT TIME ZONE 'UTC')
WHERE code = 'vet_pro';
