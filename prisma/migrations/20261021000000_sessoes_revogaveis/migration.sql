-- Revogação de sessão: versão do token por usuário (redefinir senha derruba todas)
-- e lista de JWTs encerrados no logout (derruba só aquela sessão). Idempotente.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "sessoes_revogadas" (
    "jti" CHAR(36) NOT NULL,
    "expira_em" TIMESTAMP(0) NOT NULL,
    CONSTRAINT "sessoes_revogadas_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX IF NOT EXISTS "sessoes_revogadas_expira_em_idx" ON "sessoes_revogadas"("expira_em");

-- Mesma regra das demais tabelas de public: RLS ativo, sem acesso pela API REST do Supabase.
ALTER TABLE "sessoes_revogadas" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.sessoes_revogadas FROM anon, authenticated;
  END IF;
END $$;
