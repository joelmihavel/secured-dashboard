-- Flent Secured v2 - Migration: Fix settlement cron URLs
--
-- CRITICAL FIX: Previous migrations pointed cron jobs at the wrong Supabase project
-- (uowjtrzmszuaiokqxgir instead of zqlowjveyqiagnbmfwsb). This meant:
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
    url := 'https://zqlowjveyqiagnbmfwsb.supabase.co/functions/v1/poll-settlement-status',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbG93anZleXFpYWduYm1md3NiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk5NjU1NSwiZXhwIjoyMDg0NTcyNTU1fQ.2eeohYeOPhcN1mAkoNmhU3FBAKcmDEnEQ9sx8LnapSU"}'::jsonb
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
    url := 'https://zqlowjveyqiagnbmfwsb.supabase.co/functions/v1/settle-to-landlord',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbG93anZleXFpYWduYm1md3NiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk5NjU1NSwiZXhwIjoyMDg0NTcyNTU1fQ.2eeohYeOPhcN1mAkoNmhU3FBAKcmDEnEQ9sx8LnapSU"}'::jsonb
  )$$
);
