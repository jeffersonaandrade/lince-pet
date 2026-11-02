-- CreateTable
CREATE TABLE "financeiro_lancamentos" (
    "id" UUID NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "perfil" VARCHAR(20) NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "descricao" VARCHAR(160) NOT NULL,
    "categoria" VARCHAR(60) NOT NULL,
    "contraparte" VARCHAR(160) NOT NULL,
    "vencimento" VARCHAR(10) NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "pago_centavos" INTEGER NOT NULL DEFAULT 0,
    "estado" VARCHAR(12) NOT NULL DEFAULT 'aberto',
    "agendamento_id" CHAR(36),
    "versao" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financeiro_lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financeiro_baixas" (
    "id" UUID NOT NULL,
    "lancamento_id" UUID NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "data" VARCHAR(10) NOT NULL,
    "forma" VARCHAR(30) NOT NULL,
    "desfeita" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financeiro_baixas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financeiro_eventos" (
    "id" UUID NOT NULL,
    "lancamento_id" UUID NOT NULL,
    "acao" VARCHAR(30) NOT NULL,
    "motivo" VARCHAR(250),
    "dados" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financeiro_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financeiro_lancamentos_user_id_perfil_vencimento_idx" ON "financeiro_lancamentos"("user_id", "perfil", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "financeiro_lancamentos_user_id_perfil_agendamento_id_key" ON "financeiro_lancamentos"("user_id", "perfil", "agendamento_id");

-- CreateIndex
CREATE INDEX "financeiro_baixas_lancamento_id_data_idx" ON "financeiro_baixas"("lancamento_id", "data");

-- CreateIndex
CREATE INDEX "financeiro_baixas_data_idx" ON "financeiro_baixas"("data");

-- CreateIndex
CREATE INDEX "financeiro_eventos_lancamento_id_created_at_idx" ON "financeiro_eventos"("lancamento_id", "created_at");

-- AddForeignKey
ALTER TABLE "financeiro_lancamentos" ADD CONSTRAINT "financeiro_lancamentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financeiro_baixas" ADD CONSTRAINT "financeiro_baixas_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "financeiro_lancamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financeiro_eventos" ADD CONSTRAINT "financeiro_eventos_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "financeiro_lancamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financeiro_lancamentos" ADD CONSTRAINT "financeiro_valores_validos" CHECK (
  valor_centavos BETWEEN 1 AND 999999999 AND pago_centavos BETWEEN 0 AND valor_centavos
  AND perfil IN ('veterinario', 'clinica') AND tipo IN ('receita', 'despesa')
  AND estado IN ('aberto', 'parcial', 'quitado', 'cancelado')
  AND (estado <> 'cancelado' OR pago_centavos = 0)
);
ALTER TABLE "financeiro_baixas" ADD CONSTRAINT "financeiro_baixa_valida" CHECK (valor_centavos BETWEEN 1 AND 999999999 AND desfeita IN (0, 1));
ALTER TABLE "financeiro_lancamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financeiro_baixas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financeiro_eventos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "financeiro_lancamentos", "financeiro_baixas", "financeiro_eventos" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "financeiro_lancamentos", "financeiro_baixas", "financeiro_eventos" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "financeiro_lancamentos", "financeiro_baixas", "financeiro_eventos" FROM authenticated;
  END IF;
END $$;
-- Acesso apenas pelo backend autenticado da Lince (JWT próprio, não Supabase Auth).
-- As roles da Data API não devem receber políticas nem acesso a dados financeiros.
