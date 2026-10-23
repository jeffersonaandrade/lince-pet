-- Painel admin e aprovações (CRMV do vet e RT da clínica). Idempotente.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" SMALLINT NOT NULL DEFAULT 0;

-- Vets que já existem entram aprovados (o ADD só roda uma vez); vets novos nascem pendentes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'veterinarios' AND column_name = 'crmv_status'
  ) THEN
    ALTER TABLE "veterinarios" ADD COLUMN "crmv_status" VARCHAR(20) NOT NULL DEFAULT 'aprovado';
  END IF;
END $$;
ALTER TABLE "veterinarios" ALTER COLUMN "crmv_status" SET DEFAULT 'pendente';
ALTER TABLE "veterinarios" ADD COLUMN IF NOT EXISTS "crmv_motivo" VARCHAR(500);
ALTER TABLE "veterinarios" ADD COLUMN IF NOT EXISTS "crmv_enviado_em" TIMESTAMP(0);
CREATE INDEX IF NOT EXISTS "veterinarios_crmv_status_idx" ON "veterinarios"("crmv_status");

ALTER TABLE "clinicas" ADD COLUMN IF NOT EXISTS "exames_ativo" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "clinicas" ADD COLUMN IF NOT EXISTS "rt_nome" VARCHAR(255);
ALTER TABLE "clinicas" ADD COLUMN IF NOT EXISTS "rt_crmv" VARCHAR(15);
ALTER TABLE "clinicas" ADD COLUMN IF NOT EXISTS "rt_status" VARCHAR(20);
ALTER TABLE "clinicas" ADD COLUMN IF NOT EXISTS "rt_motivo" VARCHAR(500);
ALTER TABLE "clinicas" ADD COLUMN IF NOT EXISTS "rt_enviado_em" TIMESTAMP(0);
CREATE INDEX IF NOT EXISTS "clinicas_rt_status_idx" ON "clinicas"("rt_status");
