ALTER TABLE "pets" ADD COLUMN "arquivado_em" TIMESTAMP(0);
ALTER TABLE "agendamentos" ADD COLUMN "cota_consumida_em" TIMESTAMP(0), ADD COLUMN "cota_liberada_em" TIMESTAMP(0);
CREATE INDEX "agendamentos_prestador_cota_idx" ON "agendamentos"("prestador_id", "cota_consumida_em") WHERE "cota_liberada_em" IS NULL;

-- Legado: só pedidos já aceitos/em atendimento/realizados consomem. Pendentes deixam de consumir.
UPDATE "agendamentos" SET "cota_consumida_em" = COALESCE("started_at", "created_at", CURRENT_TIMESTAMP)
 WHERE "prestador_id" IS NOT NULL AND "status" IN ('confirmado', 'em andamento', 'realizado');
UPDATE "prestadores" p SET "monthly_appointments_used" = (
 SELECT count(*) FROM "agendamentos" a WHERE a."prestador_id"=p."id" AND a."cota_liberada_em" IS NULL
 AND a."cota_consumida_em" >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + interval '3 hours'
), "monthly_appointments_reset_at" = CURRENT_TIMESTAMP;

-- Não adivinhar como mesclar cadastros antigos: duplicidades abortam a implantação para análise.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "clinicas" WHERE "cnpj" IS NOT NULL GROUP BY regexp_replace("cnpj", '\D', '', 'g') HAVING count(*) > 1) THEN
   RAISE EXCEPTION 'CNPJs equivalentes duplicados: resolver manualmente antes da migration';
 END IF;
END $$;
CREATE UNIQUE INDEX "clinicas_cnpj_normalizado_key" ON "clinicas" (regexp_replace("cnpj", '\D', '', 'g')) WHERE "cnpj" IS NOT NULL;

CREATE TABLE "recuperacoes_cnpj" (
 "id" CHAR(36) PRIMARY KEY, "clinica_id" CHAR(36) NOT NULL, "user_id" CHAR(36) NOT NULL,
 "cnpj" VARCHAR(14) NOT NULL, "email_original" VARCHAR(255) NOT NULL, "versao_original" INTEGER NOT NULL,
 "email_novo" VARCHAR(255) NOT NULL, "representante" VARCHAR(255) NOT NULL, "relato" TEXT NOT NULL,
 "status" VARCHAR(30) NOT NULL DEFAULT 'aguardando_email', "token_hash" VARCHAR(64),
 "token_expira_em" TIMESTAMP(0) NOT NULL, "email_confirmado_em" TIMESTAMP(0),
 "evidencia" TEXT, "justificativa" TEXT, "administrador_id" CHAR(36), "decidido_em" TIMESTAMP(0),
 "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "recuperacoes_cnpj_token_hash_key" ON "recuperacoes_cnpj"("token_hash");
CREATE INDEX "recuperacoes_cnpj_status_created_at_idx" ON "recuperacoes_cnpj"("status", "created_at");
ALTER TABLE "recuperacoes_cnpj" ENABLE ROW LEVEL SECURITY;
