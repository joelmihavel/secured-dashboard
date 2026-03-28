-- Notification dedup table + send-reminders cron job
--
-- The notification_dedup table prevents re-sending the same notification
-- type to the same user within a time window. Used by send-reminders cron.
--
-- The cron runs daily at 10:00 AM IST (04:30 UTC) to send:
-- rent_due (3 days before), rent_due_tomorrow (1 day before),
-- rent_overdue (1 day after), setup reminders (utility, landlord, agreement)

-- ==============================================
-- 1. Create notification_dedup table
-- ==============================================

CREATE TABLE IF NOT EXISTS notification_dedup (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dedup_key text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for cleanup query
CREATE INDEX IF NOT EXISTS idx_notification_dedup_created_at
  ON notification_dedup(created_at);

-- RLS: service role only (cron runs as service role)
ALTER TABLE notification_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_dedup_service_all
  ON notification_dedup FOR ALL
  USING (true)
  WITH CHECK (true);

-- Only allow service_role to access
REVOKE ALL ON notification_dedup FROM anon, authenticated;
GRANT ALL ON notification_dedup TO service_role;

-- ==============================================
-- 2. Schedule send-reminders cron (daily 10:00 AM IST = 04:30 UTC)
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('send-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'send-reminders',
  '30 4 * * *',
  $$SELECT invoke_edge_function('send-reminders')$$
);

COMMENT ON TABLE notification_dedup IS
  'Deduplication tracking for cron-sent notifications. Entries auto-cleaned after 7 days by the send-reminders function.';
