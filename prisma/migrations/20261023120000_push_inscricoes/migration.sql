-- Aparelhos inscritos nas notificações do navegador (Web Push). Idempotente.
CREATE TABLE IF NOT EXISTS "push_inscricoes" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" VARCHAR(255) NOT NULL,
    "auth" VARCHAR(255) NOT NULL,
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    CONSTRAINT "push_inscricoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_inscricoes_endpoint_key" ON "push_inscricoes"("endpoint");
CREATE INDEX IF NOT EXISTS "push_inscricoes_user_id_idx" ON "push_inscricoes"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_inscricoes_user_id_fkey') THEN
    ALTER TABLE "push_inscricoes" ADD CONSTRAINT "push_inscricoes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Mesma regra das demais tabelas de public: RLS ativo, sem acesso pela API REST do Supabase.
ALTER TABLE "push_inscricoes" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.push_inscricoes FROM anon, authenticated;
  END IF;
END $$;
