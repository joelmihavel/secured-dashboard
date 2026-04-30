-- Notification Policy — DB-driven Twilio Content Template SIDs
--
-- Adds template SID + variable-key columns to `notification_policy` and
-- populates the 15 WhatsApp-enabled notification types with their Twilio
-- Content Template SIDs.
--
-- Rationale: replaces the prior design where SIDs were read from 15 separate
-- Supabase secrets at runtime (`WA_TPL_*` env vars). Drawbacks of that
-- design:
--   - 15 secrets to provision per environment
--   - Missing var → silent skip (no audit signal)
--   - Adding a notification type required code change + secret set
--
-- The values are not secrets; they're operational metadata that Twilio
-- generates and exposes via the Content Template Builder API. They can
-- always be re-derived from Twilio. Storing them alongside the policy
-- gives a single audit query:
--   SELECT notification_type, content_template_sid FROM notification_policy
--   WHERE channel = 'whatsapp' AND content_template_sid IS NULL;
--
-- Same Twilio account is used by dev and prod, so the values below apply to
-- both environments.
--
-- landlord_invite + landlord_thank_you intentionally left NULL: those are
-- still resolved by direct SID/env-var references in invite-landlord-whatsapp
-- and landlord-confirm respectively. Migrate to DB-driven lookup in a
-- follow-up.

BEGIN;

-- ============================================================
-- 1. Schema: add the columns
-- ============================================================

ALTER TABLE notification_policy
  ADD COLUMN IF NOT EXISTS content_template_sid  TEXT,
  ADD COLUMN IF NOT EXISTS content_variable_keys TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

COMMENT ON COLUMN notification_policy.content_template_sid IS
  'Twilio Content Template SID (HX...). NULL = no WhatsApp template wired up '
  'for this type; sendWhatsAppForUser will short-circuit with "Missing template SID".';

COMMENT ON COLUMN notification_policy.content_variable_keys IS
  'Order-sensitive list of keys looked up in template_vars and mapped to '
  '{{1}}, {{2}}, ... in the Twilio Content Template body.';

-- ============================================================
-- 2. Seed: populate SIDs + variable keys for the 15 WA-enabled types
-- ============================================================

UPDATE notification_policy SET
  content_template_sid  = 'HX35794d684558560537fc8aae043655b4',
  content_variable_keys = ARRAY['name']::TEXT[]
WHERE notification_type = 'onboarding_dropoff';

UPDATE notification_policy SET
  content_template_sid  = 'HX0d9fd21a176650701fd4e1fbcde93a1c'
WHERE notification_type = 'agreement_upload_failed';

UPDATE notification_policy SET
  content_template_sid  = 'HX5ccde1a8f94a0ce25b1a5084a3b6db51'
WHERE notification_type = 'under_review';

UPDATE notification_policy SET
  content_template_sid  = 'HX5d095a65ce0a2303c5b802ab24dd6b4d'
WHERE notification_type = 'setup_incomplete';

UPDATE notification_policy SET
  content_template_sid  = 'HX73c522f89a5b9f0edc7b2567f613b510'
WHERE notification_type = 'landlord_pending';

UPDATE notification_policy SET
  content_template_sid  = 'HX2eea0172108a44e15938f95fc7ce4caf'
WHERE notification_type = 'waitlist_approved';

-- friendly_name on Twilio is `secured_agreement_rejected_final2` —
-- intentionally reused for waitlist_rejected per dev infra design.
UPDATE notification_policy SET
  content_template_sid  = 'HX79f4c694145ddead759fbd7afe32117e'
WHERE notification_type = 'waitlist_rejected';

UPDATE notification_policy SET
  content_template_sid  = 'HXd228e0aac953790ef6790c58309b07e5'
WHERE notification_type = 'rent_due';

UPDATE notification_policy SET
  content_template_sid  = 'HX29d203d20e6ee686857ba4a32c8e535d'
WHERE notification_type = 'rent_overdue';

UPDATE notification_policy SET
  content_template_sid  = 'HX075bc1f6f54439ae421aa5084f918685',
  content_variable_keys = ARRAY['cashback']::TEXT[]
WHERE notification_type = 'payment_success';

UPDATE notification_policy SET
  content_template_sid  = 'HX257c11fc3b3f94c5da76a4eea5814d2e'
WHERE notification_type = 'payment_failed';

UPDATE notification_policy SET
  content_template_sid  = 'HX8d1880e0a367177f6e8f7f8b53a8ec03'
WHERE notification_type = 'payment_processing';

UPDATE notification_policy SET
  content_template_sid  = 'HXdd331b4e46f2efbff6859bf50ab917a9'
WHERE notification_type = 'payment_refunded';

UPDATE notification_policy SET
  content_template_sid  = 'HX7ffd27a57078556b1f3f2ca63bbeaa6c',
  content_variable_keys = ARRAY['utr']::TEXT[]
WHERE notification_type = 'settlement_complete';

UPDATE notification_policy SET
  content_template_sid  = 'HX056510a0bef82da656c70ee0b54567f3',
  content_variable_keys = ARRAY['streak_months', 'total_cashback']::TEXT[]
WHERE notification_type = 'milestone_streak';

COMMIT;

-- rollback:
--   ALTER TABLE notification_policy
--     DROP COLUMN IF EXISTS content_template_sid,
--     DROP COLUMN IF EXISTS content_variable_keys;
