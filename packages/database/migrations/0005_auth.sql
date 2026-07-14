-- Link app users to the external auth provider (Supabase/any OIDC) without coupling
-- our primary key to the provider's id. `auth_sub` is the provider subject claim.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_sub text UNIQUE;
COMMIT;
