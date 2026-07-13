-- Application role + grants. The API and workers connect as `storyme_app`, a
-- NON-superuser role so RLS is enforced. Privileged/admin operations set
-- `app.is_admin = 'true'` per transaction (see policies in 0003_rls.sql).
--
-- NOTE: On managed providers (Supabase/Neon) the connection role may already exist
-- with a different name; adapt the role name to your platform. This migration is
-- idempotent and safe to re-run.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'storyme_app') THEN
    CREATE ROLE storyme_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public, app TO storyme_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO storyme_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO storyme_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO storyme_app;

-- Ensure future tables/sequences are reachable by the app role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO storyme_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO storyme_app;

COMMIT;
