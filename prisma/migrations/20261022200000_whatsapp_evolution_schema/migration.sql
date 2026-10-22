-- Sessão do WhatsApp (Evolution API, serviço lince-pet-whatsapp-gateway) no mesmo banco, isolada do public.
-- evolution_app é dono só do schema evolution e não recebe nada no public; a Evolution cria as tabelas dela lá.
-- O LOGIN com senha é definido fora do código (SQL Editor). Idempotente: aplicado via MCP e repetido no deploy.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evolution_app') THEN
    CREATE ROLE evolution_app NOLOGIN;
  END IF;
END $$;

-- Postgres 16+: quem cria o schema precisa ser membro do papel para torná-lo dono.
GRANT evolution_app TO CURRENT_USER;

CREATE SCHEMA IF NOT EXISTS evolution AUTHORIZATION evolution_app;
REVOKE ALL ON SCHEMA evolution FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM evolution_app;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA evolution FROM anon, authenticated;
  END IF;
END $$;
