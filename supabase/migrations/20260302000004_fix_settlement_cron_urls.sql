-- Flent Secured v2 - Migration: Fix settlement cron URLs
--
-- CRITICAL FIX: Previous migrations pointed cron jobs at the wrong Supabase project.
-- Now corrected to use Main DB (uowjtrzmszuaiokqxgir). This meant:
--   - Settlement polling was calling a non-existent endpoint
--   - PayU settlement tracking (Tier 1) was effectively dead
--   - Stuck payment reconciliation never ran
--
-- Also adds settle-to-landlord on an hourly cron (previously manual-only).

-- ==============================================
-- 1. Fix poll-settlement-status cron (every 30 min)
-- ==============================================

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

-- ==============================================
-- 2. Add settle-to-landlord cron (every hour, offset by 15 min from settlement poll)
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('settle-to-landlord');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'settle-to-landlord',
  '15 * * * *',
  $$SELECT net.http_post(
    url := 'https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/settle-to-landlord',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTA5MiwiZXhwIjoyMDc4ODE3MDkyfQ.RiKkfFqA7ZlIgxW_pbkQ8YjvbCvzohPL244n0A-ubks"}'::jsonb
  )$$
);
