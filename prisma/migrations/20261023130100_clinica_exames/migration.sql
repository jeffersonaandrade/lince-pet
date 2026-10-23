-- Clínica de exames: catálogo, combos, itens do agendamento e laudos. Idempotente.
CREATE TABLE IF NOT EXISTS "exames_oferecidos" (
    "id" CHAR(36) NOT NULL,
    "clinica_id" CHAR(36) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "descricao" VARCHAR(500),
    "preparo" VARCHAR(500),
    "preco" DECIMAL(10,2) NOT NULL,
    "duracao_min" INTEGER NOT NULL,
    "capacidade" INTEGER NOT NULL DEFAULT 1,
    "ativo" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    CONSTRAINT "exames_oferecidos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "exames_oferecidos_clinica_id_ativo_idx" ON "exames_oferecidos"("clinica_id", "ativo");

CREATE TABLE IF NOT EXISTS "combos_exame" (
    "id" CHAR(36) NOT NULL,
    "clinica_id" CHAR(36) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "descricao" VARCHAR(500),
    "preco" DECIMAL(10,2) NOT NULL,
    "ativo" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    CONSTRAINT "combos_exame_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "combos_exame_clinica_id_ativo_idx" ON "combos_exame"("clinica_id", "ativo");

CREATE TABLE IF NOT EXISTS "combo_exame_itens" (
    "combo_id" CHAR(36) NOT NULL,
    "exame_id" CHAR(36) NOT NULL,
    CONSTRAINT "combo_exame_itens_pkey" PRIMARY KEY ("combo_id", "exame_id")
);
CREATE INDEX IF NOT EXISTS "combo_exame_itens_exame_id_idx" ON "combo_exame_itens"("exame_id");

CREATE TABLE IF NOT EXISTS "agendamento_exames" (
    "id" CHAR(36) NOT NULL,
    "agendamento_id" CHAR(36) NOT NULL,
    "exame_id" CHAR(36),
    "combo_id" CHAR(36),
    "nome" VARCHAR(150) NOT NULL,
    "preparo" VARCHAR(500),
    "preco" DECIMAL(10,2) NOT NULL,
    "duracao_min" INTEGER NOT NULL,
    CONSTRAINT "agendamento_exames_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agendamento_exames_agendamento_id_idx" ON "agendamento_exames"("agendamento_id");
CREATE INDEX IF NOT EXISTS "agendamento_exames_exame_id_idx" ON "agendamento_exames"("exame_id");

CREATE TABLE IF NOT EXISTS "laudos_exame" (
    "id" CHAR(36) NOT NULL,
    "agendamento_id" CHAR(36) NOT NULL,
    "caminho" VARCHAR(500) NOT NULL,
    "nome_arquivo" VARCHAR(255),
    "tamanho_bytes" INTEGER,
    "enviado_por" CHAR(36),
    "enviado_em" TIMESTAMP(0) NOT NULL,
    CONSTRAINT "laudos_exame_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "laudos_exame_agendamento_id_key" ON "laudos_exame"("agendamento_id");

CREATE INDEX IF NOT EXISTS "agendamentos_clinica_id_inicio_em_idx" ON "agendamentos"("clinica_id", "inicio_em");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exames_oferecidos_clinica_id_fkey') THEN
    ALTER TABLE "exames_oferecidos" ADD CONSTRAINT "exames_oferecidos_clinica_id_fkey"
      FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'combos_exame_clinica_id_fkey') THEN
    ALTER TABLE "combos_exame" ADD CONSTRAINT "combos_exame_clinica_id_fkey"
      FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'combo_exame_itens_combo_id_fkey') THEN
    ALTER TABLE "combo_exame_itens" ADD CONSTRAINT "combo_exame_itens_combo_id_fkey"
      FOREIGN KEY ("combo_id") REFERENCES "combos_exame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'combo_exame_itens_exame_id_fkey') THEN
    ALTER TABLE "combo_exame_itens" ADD CONSTRAINT "combo_exame_itens_exame_id_fkey"
      FOREIGN KEY ("exame_id") REFERENCES "exames_oferecidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agendamento_exames_agendamento_id_fkey') THEN
    ALTER TABLE "agendamento_exames" ADD CONSTRAINT "agendamento_exames_agendamento_id_fkey"
      FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agendamento_exames_exame_id_fkey') THEN
    ALTER TABLE "agendamento_exames" ADD CONSTRAINT "agendamento_exames_exame_id_fkey"
      FOREIGN KEY ("exame_id") REFERENCES "exames_oferecidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agendamento_exames_combo_id_fkey') THEN
    ALTER TABLE "agendamento_exames" ADD CONSTRAINT "agendamento_exames_combo_id_fkey"
      FOREIGN KEY ("combo_id") REFERENCES "combos_exame"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'laudos_exame_agendamento_id_fkey') THEN
    ALTER TABLE "laudos_exame" ADD CONSTRAINT "laudos_exame_agendamento_id_fkey"
      FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Mesma regra das demais tabelas de public: RLS ativo, sem acesso pela API REST do Supabase.
ALTER TABLE "exames_oferecidos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "combos_exame" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "combo_exame_itens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agendamento_exames" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "laudos_exame" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.exames_oferecidos, public.combos_exame, public.combo_exame_itens,
      public.agendamento_exames, public.laudos_exame FROM anon, authenticated;
  END IF;
END $$;
