-- Notification policy + send log
--
-- `notification_policy` — per-type frequency caps and behavior.
-- `notification_send_log` — append-only record of every WhatsApp send attempt
-- (sent | skipped | failed). Used by checkPolicy() to count prior sends in a
-- window. Indexed for the lookup patterns used by the policy helper.
--
-- Seeded with the proposed defaults from the plan. Tweak via UPDATE.

-- ============================================================
-- 1. notification_policy
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_policy (
  notification_type              TEXT PRIMARY KEY,
  channel                        TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp','sms','push','email')),
  enabled                        BOOLEAN NOT NULL DEFAULT true,
  max_per_user_lifetime          INTEGER,        -- null = unlimited
  max_per_user_per_day           INTEGER,        -- null = unlimited (still subject to global daily cap)
  max_per_user_per_window_count  INTEGER,        -- null = unlimited
  window_seconds                 INTEGER,        -- companion to per_window_count
  respect_quiet_hours            BOOLEAN NOT NULL DEFAULT true,
  respect_user_preference_column TEXT,           -- name of bool column in notification_preferences
  note                           TEXT,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE notification_policy IS
  'Per-(notification_type, channel) frequency limits and behavior. Enforced by edge function checkPolicy().';

CREATE OR REPLACE FUNCTION tg_notification_policy_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_policy_touch_updated_at ON notification_policy;
CREATE TRIGGER notification_policy_touch_updated_at
  BEFORE UPDATE ON notification_policy
  FOR EACH ROW EXECUTE FUNCTION tg_notification_policy_touch_updated_at();

ALTER TABLE notification_policy ENABLE ROW LEVEL SECURITY;
-- @rls-review: notification_policy is config; only service_role (edge functions / cron) reads or writes. No tenant-scoping needed.
CREATE POLICY notification_policy_service_only
  ON notification_policy FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Seed
INSERT INTO notification_policy (
  notification_type, max_per_user_lifetime, max_per_user_per_day,
  max_per_user_per_window_count, window_seconds, respect_quiet_hours,
  respect_user_preference_column, note
) VALUES
  ('onboarding_dropoff',      2,    1,    NULL,    NULL,     true,  NULL,                     'Funnel: max 2 lifetime, 1/day'),
  ('agreement_upload_failed', 2,    1,    NULL,    NULL,     true,  NULL,                     'Funnel: max 2 lifetime, 1/day'),
  ('under_review',            1,    1,    NULL,    NULL,     true,  NULL,                     'One-shot: max 1 lifetime'),
  ('setup_incomplete',        2,    1,    NULL,    NULL,     true,  NULL,                     'Funnel: max 2 lifetime, 1/day'),
  ('landlord_pending',        2,    1,    NULL,    NULL,     true,  NULL,                     'Funnel: max 2 lifetime, 1/day'),
  ('waitlist_approved',       1,    1,    NULL,    NULL,     false, NULL,                     'One-shot, ignore quiet hours (excited moment)'),
  ('waitlist_rejected',       1,    1,    NULL,    NULL,     true,  NULL,                     'One-shot'),
  ('rent_due',                NULL, 1,    1,       86400,    true,  'payment_reminders',      'One per day; respects user pref'),
  ('rent_overdue',            NULL, 1,    3,       604800,   true,  'payment_reminders',      'Max 3 per week; respects user pref'),
  ('payment_success',         NULL, NULL, 1,       60,       false, 'payment_confirmations',  'Transactional; 1-minute idempotency'),
  ('payment_failed',          NULL, 2,    NULL,    NULL,     true,  'payment_confirmations',  'Max 2/day so user can retry'),
  ('payment_processing',      NULL, NULL, 1,       60,       false, 'payment_confirmations',  'Transactional; 1-minute idempotency'),
  ('payment_refunded',        NULL, NULL, 1,       60,       false, 'payment_confirmations',  'Transactional; 1-minute idempotency'),
  ('settlement_complete',     NULL, NULL, 1,       60,       false, 'payment_confirmations',  'Transactional; 1-minute idempotency'),
  ('milestone_streak',        NULL, 1,    1,       2592000,  true,  'cashback_notifications', 'Max 1 per 30 days'),
  -- Landlord-facing transactional sends. Tenant-initiated, but still rate-limited
  -- and quiet-hours-aware so a landlord with a Flent account isn''t spammed.
  ('landlord_invite',         NULL, 3,    NULL,    NULL,     true,  NULL,                     'Tenant-initiated invite; max 3/day; quiet hours apply'),
  ('landlord_thank_you',      NULL, 1,    1,       60,       false, NULL,                     'One-shot post-confirmation; ignore quiet hours (immediate)')
ON CONFLICT (notification_type) DO NOTHING;

-- ============================================================
-- 2. notification_send_log
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_send_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL,
  notification_type  TEXT NOT NULL,
  channel            TEXT NOT NULL DEFAULT 'whatsapp',
  -- pending: slot reserved but Twilio call not yet completed (race-safe cap counter)
  -- sent / failed / skipped: terminal states
  outcome            TEXT NOT NULL CHECK (outcome IN ('pending','sent','skipped','failed')),
  skip_reason        TEXT,
  external_id        TEXT,
  error_message      TEXT,
  context            JSONB DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE notification_send_log IS
  'Append-only attempt log for WhatsApp (and future channels). Backs reserve_whatsapp_slot() counters under advisory locks.';

-- Lookup: count sends of a given (user, type, channel) in a window
-- 'pending' is included so an in-flight slot counts toward the cap.
CREATE INDEX IF NOT EXISTS idx_send_log_user_type_chan_time
  ON notification_send_log (user_id, notification_type, channel, created_at)
  WHERE outcome IN ('sent','pending');

-- Lookup: global daily cap across all types for a user+channel
CREATE INDEX IF NOT EXISTS idx_send_log_user_chan_time
  ON notification_send_log (user_id, channel, created_at)
  WHERE outcome IN ('sent','pending');

ALTER TABLE notification_send_log ENABLE ROW LEVEL SECURITY;
-- @rls-review: append-only audit trail; only service_role writes. Future admin UI can have its own SELECT policy if needed.
CREATE POLICY notification_send_log_service_only
  ON notification_send_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- rollback:
--   DROP POLICY IF EXISTS notification_send_log_service_only ON notification_send_log;
--   DROP TABLE IF EXISTS notification_send_log;
--   DROP POLICY IF EXISTS notification_policy_service_only ON notification_policy;
--   DROP TRIGGER IF EXISTS notification_policy_touch_updated_at ON notification_policy;
--   DROP FUNCTION IF EXISTS tg_notification_policy_touch_updated_at();
--   DROP TABLE IF EXISTS notification_policy;
