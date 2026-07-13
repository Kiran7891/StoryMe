-- StoryMe social layer: follows, likes, comments, reposts, views, reports, stats.

BEGIN;

-- Directed follow edges
CREATE TABLE follows (
  follower_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX idx_follows_followee ON follows(followee_id);

-- Likes (idempotent per user/comic)
CREATE TABLE likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comic_id    uuid NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, comic_id)
);
CREATE INDEX idx_likes_comic ON likes(comic_id);

-- Comments (one level of threading via parent_id)
CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_id    uuid NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES comments(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  moderation  text NOT NULL DEFAULT 'approved' CHECK (moderation IN ('pending','approved','rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX idx_comments_comic ON comments(comic_id, created_at DESC) WHERE deleted_at IS NULL;

-- Reposts / shares to own feed (optional quote caption)
CREATE TABLE reposts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comic_id    uuid NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
  caption     text CHECK (caption IS NULL OR char_length(caption) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, comic_id)
);
CREATE INDEX idx_reposts_user ON reposts(user_id, created_at DESC);

-- Reports (content moderation queue)
CREATE TABLE reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comic_id      uuid REFERENCES comics(id) ON DELETE CASCADE,
  comment_id    uuid REFERENCES comments(id) ON DELETE CASCADE,
  reason        text NOT NULL,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','actioned','dismissed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (comic_id IS NOT NULL OR comment_id IS NOT NULL)
);
CREATE INDEX idx_reports_status ON reports(status, created_at);

-- Denormalized engagement counters (cache; reconcilable from base tables)
CREATE TABLE comic_stats (
  comic_id       uuid PRIMARY KEY REFERENCES comics(id) ON DELETE CASCADE,
  like_count     integer NOT NULL DEFAULT 0,
  comment_count  integer NOT NULL DEFAULT 0,
  repost_count   integer NOT NULL DEFAULT 0,
  view_count     bigint  NOT NULL DEFAULT 0
);

-- Trigger helpers to keep comic_stats in sync
CREATE OR REPLACE FUNCTION app.ensure_comic_stats(cid uuid) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO comic_stats(comic_id) VALUES (cid) ON CONFLICT (comic_id) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION app.bump_like_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM app.ensure_comic_stats(NEW.comic_id);
    UPDATE comic_stats SET like_count = like_count + 1 WHERE comic_id = NEW.comic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comic_stats SET like_count = GREATEST(like_count - 1, 0) WHERE comic_id = OLD.comic_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_likes_count AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION app.bump_like_count();

CREATE OR REPLACE FUNCTION app.bump_comment_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM app.ensure_comic_stats(NEW.comic_id);
    UPDATE comic_stats SET comment_count = comment_count + 1 WHERE comic_id = NEW.comic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comic_stats SET comment_count = GREATEST(comment_count - 1, 0) WHERE comic_id = OLD.comic_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_comments_count AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION app.bump_comment_count();

CREATE OR REPLACE FUNCTION app.bump_repost_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM app.ensure_comic_stats(NEW.comic_id);
    UPDATE comic_stats SET repost_count = repost_count + 1 WHERE comic_id = NEW.comic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comic_stats SET repost_count = GREATEST(repost_count - 1, 0) WHERE comic_id = OLD.comic_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_reposts_count AFTER INSERT OR DELETE ON reposts
  FOR EACH ROW EXECUTE FUNCTION app.bump_repost_count();

COMMIT;
