-- Fecha a API REST do Supabase (PostgREST) para as tabelas da aplicação.
-- O app acessa o banco só pelo Prisma como `postgres` (dono das tabelas, ignora RLS).
-- RLS ativo sem policies nega tudo para anon/authenticated. Idempotente.
-- No Postgres local os papéis anon/authenticated não existem; só o RLS é ativado.
DO $$
DECLARE
  t record;
  tem_papeis boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
                    AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    IF tem_papeis THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t.tablename);
    END IF;
  END LOOP;

  IF tem_papeis THEN
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
