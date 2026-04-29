-- Feature flags table — runtime-toggleable kill switches and config values.
-- Lives in the `private` schema; edge functions read via the SECURITY DEFINER
-- helper `public.get_feature_flag(text)` so we don't have to grant direct
-- private-schema access.
--
-- Initial values (per project plan, locked decision #2): all WhatsApp flags
-- are seeded as DISABLED so deploying this migration does not cause any
-- automated WA messages to fire. Operator must explicitly flip flags via
-- direct UPDATE before any send happens.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT,
  note        TEXT
);

COMMENT ON TABLE private.feature_flags IS
  'Runtime feature flags. Read via public.get_feature_flag(text). Direct UPDATE only.';

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION private.tg_feature_flags_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_flags_touch_updated_at ON private.feature_flags;
CREATE TRIGGER feature_flags_touch_updated_at
  BEFORE UPDATE ON private.feature_flags
  FOR EACH ROW EXECUTE FUNCTION private.tg_feature_flags_touch_updated_at();

-- ============================================================
-- SECURITY DEFINER helper exposed to edge functions (service_role)
-- ============================================================
-- @security-definer: read-only access to private.feature_flags from non-private callers (edge functions, authenticated UI). The function only SELECTs and exposes nothing beyond enabled+config.
CREATE OR REPLACE FUNCTION public.get_feature_flag(p_key TEXT)
RETURNS TABLE(enabled BOOLEAN, config JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
BEGIN
  RETURN QUERY
  SELECT f.enabled, f.config
  FROM private.feature_flags f
  WHERE f.key = p_key;
END;
$$;

-- @grant-review: revoke default PUBLIC access; expose only to service_role (edge functions) and authenticated (future admin UI). No anonymous read of flag state.
REVOKE ALL ON FUNCTION public.get_feature_flag(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feature_flag(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_feature_flag(TEXT) TO authenticated;

-- ============================================================
-- SEED — initial flag rows (all OFF for safety)
-- ============================================================

INSERT INTO private.feature_flags (key, enabled, config, note) VALUES
  ('whatsapp_send', false, '{}'::jsonb,
    'Master kill-switch. When false, no WhatsApp messages send anywhere — automated or manual.'),
  ('whatsapp_automated', false, '{}'::jsonb,
    'Automated funnel sends (cron-driven). Requires whatsapp_send=true. When false, transactional and broadcast still work.'),
  ('whatsapp_broadcast', false, '{}'::jsonb,
    'Manual admin broadcast endpoint. Requires whatsapp_send=true.'),
  ('whatsapp_daily_cap_per_user', true, '{"cap": 3}'::jsonb,
    'Global per-user-per-day cap on WhatsApp messages across all notification types.')
ON CONFLICT (key) DO NOTHING;

-- rollback:
--   DROP FUNCTION IF EXISTS public.get_feature_flag(TEXT);
--   DROP TRIGGER IF EXISTS feature_flags_touch_updated_at ON private.feature_flags;
--   DROP FUNCTION IF EXISTS private.tg_feature_flags_touch_updated_at();
--   DROP TABLE IF EXISTS private.feature_flags;
--   -- The `private` schema is left in place; other migrations may rely on it.
