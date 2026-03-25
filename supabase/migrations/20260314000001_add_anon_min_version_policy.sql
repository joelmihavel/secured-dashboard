-- ==============================================
-- ANON READ POLICY FOR min_app_version
-- ==============================================
-- The force-update check runs BEFORE auth (pre-login).
-- The app_config table only allows authenticated SELECT.
-- This adds an anon policy restricted to the min_app_version key.

CREATE POLICY "Anon can read min_app_version"
  ON app_config FOR SELECT
  TO anon
  USING (key = 'min_app_version');

-- Seed the min_app_version config entry (null = no enforcement)
INSERT INTO app_config (key, value) VALUES
  ('min_app_version', '{"version": null, "message": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;
