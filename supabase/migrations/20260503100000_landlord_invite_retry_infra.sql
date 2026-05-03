-- Landlord-invite WhatsApp: retry infra
--
-- Recovered from prod's supabase_migrations.schema_migrations.statements
-- (was applied via apply_migration without committing the file). Identical
-- semantics to what's already in the prod DB; this commit only brings the
-- repo back in sync so future tag-deploys stop failing on the divergence.

BEGIN;

ALTER TABLE public.tenancies
  DROP CONSTRAINT IF EXISTS tenancies_landlord_status_check;

ALTER TABLE public.tenancies
  ADD CONSTRAINT tenancies_landlord_status_check
  CHECK (landlord_status IN (
    'none',
    'invited',
    'invited_deferred',
    'invited_undelivered',
    'otp_confirmed',
    'verified',
    'human_review',
    'declined'
  ));

COMMENT ON COLUMN public.tenancies.landlord_status IS
  'Landlord verification state: '
  'none (pre-invite) | '
  'invited (Twilio acked delivery) | '
  'invited_deferred (Meta-cap; retry pipeline running) | '
  'invited_undelivered (terminal — tenant must take action) | '
  'otp_confirmed (OTP done, M360 pending) | '
  'verified (all 3 gates pass) | '
  'human_review (2 of 3 gates pass; admin must approve) | '
  'declined (landlord rejected)';

ALTER TABLE public.tenancies
  ADD COLUMN IF NOT EXISTS last_landlord_invite_message_sid TEXT,
  ADD COLUMN IF NOT EXISTS landlord_invite_status_checked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.tenancies.last_landlord_invite_message_sid IS
  'Twilio Messages SID for the most recent landlord-invite send (sync or retry). '
  'Used by reconcile-landlord-invite-deliveries cron to fetch terminal status from Twilio.';

COMMENT ON COLUMN public.tenancies.landlord_invite_status_checked IS
  'TRUE when the reconcile cron has finalized status for last_landlord_invite_message_sid '
  '(either delivered/sent/read = no-op, or undelivered/failed → tenancy state advanced and '
  'retry queued if applicable). Reset to FALSE on every new send/retry.';

CREATE INDEX IF NOT EXISTS idx_tenancies_landlord_invite_unchecked
  ON public.tenancies (landlord_invite_sent_at)
  WHERE landlord_status = 'invited'
    AND last_landlord_invite_message_sid IS NOT NULL
    AND landlord_invite_status_checked = FALSE;

CREATE TABLE public.landlord_invite_retry_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id          UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  to_phone            VARCHAR(15) NOT NULL,
  country_code        VARCHAR(10) NOT NULL,
  content_sid         TEXT NOT NULL,
  initial_error_code  TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','superseded','undelivered','killed')),
  retry_count         INT  NOT NULL DEFAULT 0,
  max_retries         INT  NOT NULL DEFAULT 3,
  quiet_hours_bumps   INT  NOT NULL DEFAULT 0,
  scheduled_for       TIMESTAMPTZ NOT NULL,
  last_attempted_at   TIMESTAMPTZ,
  external_id         TEXT,
  last_error_code     TEXT,
  last_error_message  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lirq_due
  ON public.landlord_invite_retry_queue (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX idx_lirq_tenancy_pending
  ON public.landlord_invite_retry_queue (tenancy_id)
  WHERE status IN ('pending','processing');

CREATE OR REPLACE FUNCTION public.lirq_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lirq_set_updated_at
  BEFORE UPDATE ON public.landlord_invite_retry_queue
  FOR EACH ROW EXECUTE FUNCTION public.lirq_set_updated_at();

UPDATE public.notification_policy SET
  content_template_sid  = 'HX14d38e76e174724ca9ae839e9a8cf0c0',
  content_variable_keys = ARRAY['tenant_name']::TEXT[]
WHERE notification_type = 'landlord_invite';

DO $$ BEGIN
  PERFORM cron.unschedule('retry-landlord-invites');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'retry-landlord-invites',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := get_edge_function_url('retry-landlord-invites'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

DO $$ BEGIN
  PERFORM cron.unschedule('reconcile-landlord-invite-deliveries');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reconcile-landlord-invite-deliveries',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := get_edge_function_url('reconcile-landlord-invite-deliveries'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

COMMIT;
