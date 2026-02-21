-- Flent Secured v2 - Migration: Add settlement polling cron job
-- Polls PayU settlement status every 30 minutes for successful payments
-- that haven't been settled yet. Triggers the poll-settlement-status edge function.

SELECT cron.schedule(
  'poll-settlement-and-reconcile',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://zqlowjveyqiagnbmfwsb.supabase.co/functions/v1/poll-settlement-status',
    headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Note: SERVICE_ROLE_KEY placeholder in the cron command must be replaced
-- manually via Supabase Dashboard > Database > Extensions > pg_cron.
