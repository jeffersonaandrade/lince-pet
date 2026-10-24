-- Novos veterinários começam sem plano. Não altera os perfis existentes, inclusive os de teste.
ALTER TABLE "veterinarios" ALTER COLUMN "subscription_plan_code" SET DEFAULT 'none';
