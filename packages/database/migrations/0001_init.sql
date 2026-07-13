-- StoryMe core schema. Portable across Supabase / Neon / self-hosted Postgres.
-- Authoritative source of truth; Drizzle schema in src/schema mirrors this for typed access.

BEGIN;

-- Extensions (gen_random_uuid is built-in on PG13+; pgcrypto kept for portability).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper: the current application user id, set per-transaction by the API/worker via
--   SET LOCAL app.current_user_id = '<uuid>';
-- Returns NULL when unset (e.g. service/admin connections). Used by RLS policies.
CREATE SCHEMA IF NOT EXISTS app;
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.is_admin', true), 'false')::boolean
$$;

-- Reusable updated_at trigger
CREATE OR REPLACE FUNCTION app.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- users (mirrors the auth provider's user; app-level profile + role live here)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  display_name  text,
  handle        text UNIQUE,
  avatar_key    text,
  bio           text,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','support')),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ---------------------------------------------------------------------------
-- uploads (presigned direct-to-storage; metadata tracked here)
-- ---------------------------------------------------------------------------
CREATE TABLE uploads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key  text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uploaded','rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_uploads_user_status ON uploads(user_id, status);
CREATE TRIGGER trg_uploads_updated BEFORE UPDATE ON uploads
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ---------------------------------------------------------------------------
-- characters (the hero; identity reference derived from uploaded photos)
-- ---------------------------------------------------------------------------
CREATE TABLE characters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  kind          text NOT NULL CHECK (kind IN ('person','child','pet','other')),
  identity_ref  jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX idx_characters_user ON characters(user_id) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_characters_updated BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TABLE character_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  upload_id     uuid NOT NULL REFERENCES uploads(id) ON DELETE RESTRICT,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','rejected')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, upload_id)
);
CREATE INDEX idx_character_photos_character ON character_photos(character_id);

-- ---------------------------------------------------------------------------
-- comics (aka Stories: format book | reel)
-- ---------------------------------------------------------------------------
CREATE TABLE comics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id  uuid REFERENCES characters(id) ON DELETE SET NULL,
  title         text,
  prompt        text NOT NULL CHECK (char_length(prompt) BETWEEN 3 AND 2000),
  style         text NOT NULL CHECK (style IN ('manga','superhero','chibi','noir','watercolor')),
  format        text NOT NULL DEFAULT 'book' CHECK (format IN ('book','reel')),
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','queued','processing','complete','failed','moderated')),
  panel_count   integer NOT NULL DEFAULT 6 CHECK (panel_count BETWEEN 1 AND 12),
  cover_key     text,
  video_key     text,               -- reel MP4 (null for books)
  is_public     boolean NOT NULL DEFAULT false,
  share_slug    text UNIQUE,
  moderation    text NOT NULL DEFAULT 'pending'
                  CHECK (moderation IN ('pending','approved','rejected')),
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX idx_comics_user_created ON comics(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_comics_feed ON comics(published_at DESC)
  WHERE is_public AND status = 'complete' AND moderation = 'approved' AND deleted_at IS NULL;
CREATE INDEX idx_comics_reels ON comics(published_at DESC)
  WHERE format = 'reel' AND is_public AND status = 'complete' AND moderation = 'approved' AND deleted_at IS NULL;
CREATE INDEX idx_comics_status ON comics(status);
CREATE TRIGGER trg_comics_updated BEFORE UPDATE ON comics
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Pages/frames of a comic
CREATE TABLE panels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_id      uuid NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
  index         integer NOT NULL CHECK (index >= 0),
  scene         text,
  dialogue      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{speaker,text,bubble:{x,y,w,h}}]
  image_key     text,
  duration_ms   integer CHECK (duration_ms IS NULL OR duration_ms > 0), -- reel frame timing
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comic_id, index)
);
CREATE INDEX idx_panels_comic ON panels(comic_id);

-- ---------------------------------------------------------------------------
-- jobs (background generation pipeline tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_id         uuid REFERENCES comics(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN
                     ('generate_comic','generate_script','generate_panel','assemble_comic','notify','cleanup','export')),
  status           text NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','active','completed','failed','cancelled')),
  progress         integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  attempts         integer NOT NULL DEFAULT 0,
  error            jsonb,
  idempotency_key  text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX idx_jobs_comic ON jobs(comic_id);
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ---------------------------------------------------------------------------
-- billing + credits (append-only ledger; balance = SUM(delta))
-- ---------------------------------------------------------------------------
CREATE TABLE billing_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id  text UNIQUE,
  plan                text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','plus','pro')),
  status              text NOT NULL DEFAULT 'active',
  current_period_end  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_billing_updated BEFORE UPDATE ON billing_accounts
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TABLE credit_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta       integer NOT NULL CHECK (delta <> 0),
  reason      text NOT NULL,
  ref_id      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_ledger_user_created ON credit_ledger(user_id, created_at DESC);
-- Prevent double-grant/double-debit for the same logical event.
CREATE UNIQUE INDEX uq_credit_ledger_reason_ref ON credit_ledger(reason, ref_id) WHERE ref_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- devices, notifications, audit, idempotency, processed webhooks
-- ---------------------------------------------------------------------------
CREATE TABLE devices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    text NOT NULL CHECK (platform IN ('ios','android','web')),
  push_token  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, push_token)
);

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid,
  action      text NOT NULL,
  entity      text,
  entity_id   text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);

CREATE TABLE idempotency_keys (
  key           text PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  response_hash text,
  status_code   integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE processed_webhook_events (
  id          text PRIMARY KEY,          -- provider event id
  provider    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMIT;
