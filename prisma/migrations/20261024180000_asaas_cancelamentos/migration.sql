CREATE TABLE "asaas_cancelamentos" (
    "subscription_id" CHAR(36) NOT NULL PRIMARY KEY REFERENCES "subscriptions"("id") ON DELETE CASCADE,
    "motivo" VARCHAR(20) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "solicitado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proxima_tentativa_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloqueado_ate" TIMESTAMP(3),
    "ultimo_erro" VARCHAR(40),
    "concluido_em" TIMESTAMP(3)
);
CREATE INDEX "asaas_cancelamentos_concluido_em_proxima_tentativa_em_idx"
    ON "asaas_cancelamentos" ("concluido_em", "proxima_tentativa_em");
ALTER TABLE "asaas_cancelamentos" ENABLE ROW LEVEL SECURITY;
