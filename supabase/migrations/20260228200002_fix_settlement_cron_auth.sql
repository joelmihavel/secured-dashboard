-- Flent Secured v2 - Migration: Fix settlement cron auth header
-- Replaces SERVICE_ROLE_KEY placeholder with real service role key for main project

DO $$ BEGIN
  PERFORM cron.unschedule('poll-settlement-and-reconcile');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'poll-settlement-and-reconcile',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/poll-settlement-status',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTA5MiwiZXhwIjoyMDc4ODE3MDkyfQ.RiKkfFqA7ZlIgxW_pbkQ8YjvbCvzohPL244n0A-ubks"}'::jsonb
  )$$
);
