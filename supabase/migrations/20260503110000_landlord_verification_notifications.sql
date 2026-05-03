-- Flent Secured v2 - Landlord verification tenant notifications
--
-- Adds two new notification types (`landlord_verified`, `landlord_verification_failed`)
-- to the notifications.notification_type CHECK constraint. Adds matching
-- notification_policy seed rows. Adds the
-- `tenancies.landlord_verification_failed_notified_at` dedupe column used by
-- the upgrade-landlord-status cron and admin-decline path to send the failure
-- notification once and only once per tenancy.

-- ============================================================
-- 1. Notification type CHECK constraint (extend allowed values)
-- ============================================================
-- notifications.notification_type is a TEXT column gated by a CHECK constraint
-- (not a Postgres enum). The pattern here mirrors 20260402000001: DROP the
-- existing named constraint, ADD a new one that includes every prior value
-- plus the two new landlord-verification types.

-- @safe-destructive: replacing CHECK constraint with a wider allow-list (every prior value preserved + 2 new). Pattern mirrors 20260402000001.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check CHECK (
  notification_type IN (
    -- Existing types (from 20260402000001)
    'payment_reminder','payment_success','payment_failed','cashback_earned',
    'cashback_expiring','landlord_approved','landlord_disputed',
    'verification_complete','verification_required','general','promo',
    'waitlist_approved','waitlist_rejected','rent_due','rent_due_tomorrow',
    'rent_overdue','settlement_complete','settlement_failed',
    'landlord_confirmed','landlord_rejected','app_update',
    'reminder_utility','reminder_landlord_invite','reminder_agreement',
    'onboarding_dropoff','agreement_upload_failed','under_review',
    'setup_incomplete','landlord_pending','payment_refunded','milestone_streak',
    -- New landlord-verification types
    'landlord_verified',
    'landlord_verification_failed'
  )
);

-- ============================================================
-- 2. notification_policy seeds (transactional, 1-min idempotency)
-- ============================================================
-- Modelled on the payment_success row: no lifetime cap, no per-day cap,
-- one send per 60-second window for idempotency, ignore quiet hours
-- (terminal-state messages are immediate / time-sensitive).
-- content_template_sid stays NULL until ops fills in the Meta-approved SIDs.

INSERT INTO notification_policy (
  notification_type, max_per_user_lifetime, max_per_user_per_day,
  max_per_user_per_window_count, window_seconds, respect_quiet_hours,
  respect_user_preference_column, note, content_template_sid, content_variable_keys
) VALUES
  ('landlord_verified',            NULL, NULL, 1, 60, false, NULL, 'Transactional; 1-min idempotency', NULL, NULL),
  ('landlord_verification_failed', NULL, NULL, 1, 60, false, NULL, 'Transactional; 1-min idempotency', NULL, NULL)
ON CONFLICT (notification_type) DO NOTHING;

-- ============================================================
-- 3. Failure-notification dedupe column on tenancies
-- ============================================================

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS landlord_verification_failed_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN tenancies.landlord_verification_failed_notified_at IS
  'Timestamp when the tenant was notified that auto-verification failed. NULL = not yet notified. Atomic-claim target used by upgrade-landlord-status cron and admin-decline path to dedupe.';

-- ============================================================
-- 4. Partial index for the cron query
-- ============================================================
-- Cron runs every 15 min and joins on (status, otp_verified, approved_at)
-- to find rows ready for the failure notification. Partial index keeps
-- the working set tiny.

CREATE INDEX IF NOT EXISTS idx_tenancies_landlord_verification_failure_pending
  ON tenancies (landlord_approved_at)
  WHERE landlord_status IN ('otp_confirmed', 'human_review')
    AND landlord_verification_failed_notified_at IS NULL
    AND landlord_otp_verified = true;

-- rollback:
--   DROP INDEX IF EXISTS idx_tenancies_landlord_verification_failure_pending;
--   ALTER TABLE tenancies DROP COLUMN IF EXISTS landlord_verification_failed_notified_at;
--   DELETE FROM notification_policy WHERE notification_type IN ('landlord_verified','landlord_verification_failed');
--   ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
--   ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check CHECK (
--     notification_type IN (
--       'payment_reminder','payment_success','payment_failed','cashback_earned',
--       'cashback_expiring','landlord_approved','landlord_disputed',
--       'verification_complete','verification_required','general','promo',
--       'waitlist_approved','waitlist_rejected','rent_due','rent_due_tomorrow',
--       'rent_overdue','settlement_complete','settlement_failed',
--       'landlord_confirmed','landlord_rejected','app_update',
--       'reminder_utility','reminder_landlord_invite','reminder_agreement',
--       'onboarding_dropoff','agreement_upload_failed','under_review',
--       'setup_incomplete','landlord_pending','payment_refunded','milestone_streak'
--     )
--   );
--   Note: rollback is destructive if any notifications row already uses the new types — DELETE those rows first or the new CHECK will fail.
