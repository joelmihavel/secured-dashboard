-- Flent Secured v2 - Migration: pg_cron Scheduled Jobs
-- Automated tasks for payment reminders, cleanup, and processing
-- Made idempotent for v2→main merge

-- ==============================================
-- ENABLE EXTENSIONS
-- ==============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ==============================================
-- HELPER FUNCTIONS
-- ==============================================

CREATE OR REPLACE FUNCTION get_edge_function_url(function_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/' || function_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================
-- NOTIFICATION QUEUE TABLE (if not exists)
-- ==============================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('push', 'whatsapp', 'sms', 'email')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  external_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns that may not exist on a pre-existing table
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'push';
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

DO $$ BEGIN
  CREATE INDEX idx_notification_queue_pending ON notification_queue(scheduled_for)
    WHERE status = 'pending';
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON notification_queue(user_id);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY notification_queue_service_all ON notification_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================
-- CRON JOB: Payment Reminders (Daily 9 AM IST = 3:30 AM UTC)
-- ==============================================

CREATE OR REPLACE FUNCTION send_payment_reminders()
RETURNS void AS $$
DECLARE
  v_tenancy RECORD;
  v_user RECORD;
  v_due_date DATE;
  v_days_until_due INTEGER;
BEGIN
  FOR v_tenancy IN
    SELECT t.id, t.user_id, t.monthly_rent_paise, t.rent_due_day, t.landlord_name
    FROM tenancies t
    WHERE t.status = 'active'
      AND t.bank_verified = true
  LOOP
    v_due_date := DATE_TRUNC('month', CURRENT_DATE) + (v_tenancy.rent_due_day - 1) * INTERVAL '1 day';
    IF v_due_date < CURRENT_DATE THEN
      v_due_date := v_due_date + INTERVAL '1 month';
    END IF;
    v_days_until_due := v_due_date - CURRENT_DATE;
    IF v_days_until_due = 3 THEN
      IF NOT EXISTS (
        SELECT 1 FROM payments
        WHERE tenancy_id = v_tenancy.id
          AND rent_month = DATE_TRUNC('month', v_due_date)
          AND status IN ('success', 'processing', 'pending')
      ) THEN
        SELECT first_name, phone INTO v_user
        FROM users WHERE id = v_tenancy.user_id;
        INSERT INTO notification_queue (
          user_id, notification_type, payload, scheduled_for
        ) VALUES (
          v_tenancy.user_id,
          'whatsapp',
          jsonb_build_object(
            'to', v_user.phone,
            'body', format(
              'Hi %s, your rent of Rs %s is due on %s. Pay now to earn 1%% cashback!',
              v_user.first_name,
              (v_tenancy.monthly_rent_paise / 100)::TEXT,
              TO_CHAR(v_due_date, 'DD Mon')
            )
          ),
          NOW()
        );
        INSERT INTO notification_queue (
          user_id, notification_type, payload, scheduled_for
        )
        SELECT
          v_tenancy.user_id,
          'push',
          jsonb_build_object(
            'device_token', dt.token,
            'title', 'Rent Due Soon',
            'body', format('Rs %s due on %s. Pay now for 1%% cashback!',
              (v_tenancy.monthly_rent_paise / 100)::TEXT,
              TO_CHAR(v_due_date, 'DD Mon')
            ),
            'data', jsonb_build_object(
              'type', 'payment_reminder',
              'tenancy_id', v_tenancy.id
            )
          ),
          NOW()
        FROM device_tokens dt
        WHERE dt.user_id = v_tenancy.user_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule cron jobs (guarded: unschedule first if exists)
DO $$ BEGIN
  PERFORM cron.unschedule('payment-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'payment-reminders',
  '30 3 * * *',
  $$SELECT send_payment_reminders()$$
);

-- ==============================================
-- CRON JOB: Process Notification Queue (Every 5 minutes)
-- ==============================================

CREATE OR REPLACE FUNCTION process_notification_queue()
RETURNS void AS $$
DECLARE
  v_notification RECORD;
  v_function_url TEXT;
BEGIN
  FOR v_notification IN
    SELECT *
    FROM notification_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
      AND retry_count < max_retries
    ORDER BY scheduled_for
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE notification_queue
    SET status = 'processing'
    WHERE id = v_notification.id;

    v_function_url := get_edge_function_url(
      CASE v_notification.notification_type
        WHEN 'whatsapp' THEN 'send-whatsapp'
        WHEN 'sms' THEN 'send-sms'
        WHEN 'push' THEN 'send-push-notification'
        ELSE 'send-sms'
      END
    );

    PERFORM net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'x-supabase-internal', 'true'
      ),
      body := v_notification.payload || jsonb_build_object(
        'notification_queue_id', v_notification.id,
        'user_id', v_notification.user_id
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  PERFORM cron.unschedule('process-notifications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'process-notifications',
  '*/5 * * * *',
  $$SELECT process_notification_queue()$$
);

-- ==============================================
-- CRON JOB: Cleanup Expired Idempotency Keys (Daily 2 AM IST)
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-idempotency-keys');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'cleanup-idempotency-keys',
  '30 20 * * *',
  $$DELETE FROM idempotency_keys WHERE expires_at < NOW()$$
);

-- ==============================================
-- CRON JOB: Expire Old Cashback (Daily 1 AM IST)
-- ==============================================

CREATE OR REPLACE FUNCTION expire_old_cashback()
RETURNS void AS $$
DECLARE
  v_entry RECORD;
  v_current_balance BIGINT;
BEGIN
  FOR v_entry IN
    SELECT DISTINCT ON (user_id) user_id, id, amount_paise
    FROM cashback_ledger
    WHERE transaction_type = 'earned'
      AND expired_at IS NULL
      AND expires_at < NOW()
    ORDER BY user_id, created_at
  LOOP
    SELECT get_cashback_balance(v_entry.user_id) INTO v_current_balance;
    INSERT INTO cashback_ledger (
      user_id, transaction_type, amount_paise, balance_after_paise,
      description
    ) VALUES (
      v_entry.user_id,
      'expired',
      v_entry.amount_paise,
      GREATEST(v_current_balance - v_entry.amount_paise, 0),
      'Cashback expired after 90 days'
    );
    UPDATE cashback_ledger
    SET expired_at = NOW()
    WHERE id = v_entry.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  PERFORM cron.unschedule('expire-cashback');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'expire-cashback',
  '30 19 * * *',
  $$SELECT expire_old_cashback()$$
);

-- ==============================================
-- CRON JOB: Retry Failed Notifications (Every 15 minutes)
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('retry-failed-notifications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'retry-failed-notifications',
  '*/15 * * * *',
  $$
    UPDATE notification_queue
    SET status = 'pending', retry_count = retry_count + 1
    WHERE status = 'failed'
      AND retry_count < max_retries
      AND created_at > NOW() - INTERVAL '24 hours'
  $$
);

-- ==============================================
-- CRON JOB: Clean Old Audit Logs (Weekly)
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-audit-logs');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 0 * * 0',
  $$
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '1 year'
      AND action_category NOT IN ('payment', 'security')
  $$
);

-- ==============================================
-- VIEW SCHEDULED JOBS
-- ==============================================

CREATE OR REPLACE VIEW scheduled_jobs AS
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job;

COMMENT ON VIEW scheduled_jobs IS 'View all pg_cron scheduled jobs';
