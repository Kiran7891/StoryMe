-- Row-level security. Portable: policies use app.current_user_id() / app.is_admin(),
-- which read GUCs the API sets per transaction (SET LOCAL app.current_user_id = ...).
-- The application connects as a NON-owner role so RLS is enforced; workers/admin set
-- app.is_admin = 'true' (or use a BYPASSRLS role) for privileged operations.

BEGIN;

-- Enable + force RLS on user-owned tables
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE panels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;

-- users: anyone can read non-deleted profiles; you can update only your own row.
CREATE POLICY users_read ON users FOR SELECT
  USING (deleted_at IS NULL OR id = app.current_user_id() OR app.is_admin());
CREATE POLICY users_update_self ON users FOR UPDATE
  USING (id = app.current_user_id() OR app.is_admin())
  WITH CHECK (id = app.current_user_id() OR app.is_admin());

-- uploads: owner only
CREATE POLICY uploads_owner ON uploads FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());

-- characters: owner only
CREATE POLICY characters_owner ON characters FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());

-- character_photos: via owning character
CREATE POLICY character_photos_owner ON character_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM characters c
                 WHERE c.id = character_photos.character_id
                   AND (c.user_id = app.current_user_id() OR app.is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM characters c
                 WHERE c.id = character_photos.character_id
                   AND (c.user_id = app.current_user_id() OR app.is_admin())));

-- comics: owner full access; everyone can read public, approved, complete comics.
CREATE POLICY comics_owner ON comics FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());
CREATE POLICY comics_public_read ON comics FOR SELECT
  USING (is_public AND status = 'complete' AND moderation = 'approved' AND deleted_at IS NULL);

-- panels: readable if the parent comic is readable (owner or public)
CREATE POLICY panels_read ON panels FOR SELECT
  USING (EXISTS (SELECT 1 FROM comics c WHERE c.id = panels.comic_id
                 AND (c.user_id = app.current_user_id() OR app.is_admin()
                      OR (c.is_public AND c.status='complete' AND c.moderation='approved'))));
CREATE POLICY panels_write ON panels FOR ALL
  USING (app.is_admin() OR EXISTS (SELECT 1 FROM comics c WHERE c.id = panels.comic_id AND c.user_id = app.current_user_id()))
  WITH CHECK (app.is_admin() OR EXISTS (SELECT 1 FROM comics c WHERE c.id = panels.comic_id AND c.user_id = app.current_user_id()));

-- likes: anyone can read; you manage your own
CREATE POLICY likes_read ON likes FOR SELECT USING (true);
CREATE POLICY likes_write ON likes FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());

-- comments: read approved (or own); write/delete your own
CREATE POLICY comments_read ON comments FOR SELECT
  USING (deleted_at IS NULL AND (moderation = 'approved' OR user_id = app.current_user_id() OR app.is_admin()));
CREATE POLICY comments_write ON comments FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());

-- reposts: read all; manage own
CREATE POLICY reposts_read ON reposts FOR SELECT USING (true);
CREATE POLICY reposts_write ON reposts FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());

-- follows: read all; manage your own follow edges
CREATE POLICY follows_read ON follows FOR SELECT USING (true);
CREATE POLICY follows_write ON follows FOR ALL
  USING (follower_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (follower_id = app.current_user_id() OR app.is_admin());

-- notifications / devices / ledger / billing: strictly owner
CREATE POLICY notifications_owner ON notifications FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());
CREATE POLICY devices_owner ON devices FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());
CREATE POLICY credit_ledger_read ON credit_ledger FOR SELECT
  USING (user_id = app.current_user_id() OR app.is_admin());
CREATE POLICY billing_owner ON billing_accounts FOR SELECT
  USING (user_id = app.current_user_id() OR app.is_admin());

COMMIT;
