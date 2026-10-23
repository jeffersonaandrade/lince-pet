-- Lembretes de consulta já disparados (sino, navegador e e-mail): um por agendamento, evento e data+hora. Idempotente.
CREATE TABLE IF NOT EXISTS "avisos_lembrete" (
    "agendamento_id" CHAR(36) NOT NULL,
    "evento" VARCHAR(30) NOT NULL,
    "referencia" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(0),
    CONSTRAINT "avisos_lembrete_pkey" PRIMARY KEY ("agendamento_id", "evento", "referencia")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'avisos_lembrete_agendamento_id_fkey') THEN
    ALTER TABLE "avisos_lembrete" ADD CONSTRAINT "avisos_lembrete_agendamento_id_fkey"
      FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Mesma regra das demais tabelas de public: RLS ativo, sem acesso pela API REST do Supabase.
ALTER TABLE "avisos_lembrete" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.avisos_lembrete FROM anon, authenticated;
  END IF;
END $$;
