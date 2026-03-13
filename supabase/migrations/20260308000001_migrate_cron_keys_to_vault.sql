-- Flent Secured v2 - Migration: Migrate cron job auth to use service role key
--
-- CONTEXT: Supabase migrated from legacy JWT keys (eyJ...) to new format
-- (sb_publishable_... / sb_secret_...). All pg_cron jobs that call edge functions
-- via net.http_post() had hardcoded legacy service_role JWTs in their headers.
--
-- FIX: Create a SECURITY DEFINER helper function that reads the service role key
-- from a private config table. Cron jobs call the helper instead of hardcoding keys.
-- When the key rotates, only the config table row needs updating.
--
-- NOTE: Vault extension is not available on this plan, so we use a simple
-- private table accessible only by postgres (superuser).

-- ==============================================
-- 1. Private config table for secrets
-- ==============================================
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.edge_function_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Revoke all access from API roles — only postgres/superuser can read
REVOKE ALL ON private.edge_function_config FROM anon, authenticated, service_role;

-- Store base URL for invoke_edge_function()
INSERT INTO private.edge_function_config (key, value)
VALUES ('base_url', 'https://uowjtrzmszuaiokqxgir.supabase.co')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Insert the service role key (upsert to handle re-runs)
INSERT INTO private.edge_function_config (key, value)
VALUES ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTA5MiwiZXhwIjoyMDc4ODE3MDkyfQ.RiKkfFqA7ZlIgxW_pbkQ8YjvbCvzohPL244n0A-ubks')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ==============================================
-- 2. Helper function: invoke edge function with auth
-- ==============================================
-- SECURITY DEFINER runs as the function owner (postgres), which can
-- read private.edge_function_config. API roles cannot call this
-- directly because we only GRANT to postgres (default owner).
CREATE OR REPLACE FUNCTION invoke_edge_function(
  fn_name text,
  body jsonb DEFAULT '{}'::jsonb
) RETURNS bigint AS $$
DECLARE
  secret_value text;
  base_url text;
BEGIN
  -- Read service role key from private config
  SELECT value INTO secret_value
  FROM private.edge_function_config
  WHERE key = 'service_role_key';

  IF secret_value IS NULL OR secret_value = '' THEN
    RAISE EXCEPTION 'invoke_edge_function: service_role_key not found in private.edge_function_config';
  END IF;

  -- Read base URL from config (falls back to Main DB if not set)
  SELECT value INTO base_url
  FROM private.edge_function_config
  WHERE key = 'base_url';

  IF base_url IS NULL OR base_url = '' THEN
    base_url := 'https://uowjtrzmszuaiokqxgir.supabase.co';
  END IF;

  RETURN net.http_post(
    url := base_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret_value
    ),
    body := body
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only allow execution by postgres (pg_cron runs as superuser)
REVOKE EXECUTE ON FUNCTION invoke_edge_function(text, jsonb) FROM anon, authenticated, service_role;

COMMENT ON FUNCTION invoke_edge_function(text, jsonb) IS
  'Invoke a Supabase edge function with service role auth. Used by pg_cron jobs only.';

-- ==============================================
-- 3. Reschedule all cron jobs to use the helper
-- ==============================================

-- 3a. warmup-auth-otp (every 4 min)
DO $$ BEGIN
  PERFORM cron.unschedule('warmup-auth-otp');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'warmup-auth-otp',
  '*/4 * * * *',
  $$SELECT invoke_edge_function('auth-otp', '{"action":"health"}'::jsonb)$$
);

-- 3b. poll-settlement-and-reconcile (every 30 min)
DO $$ BEGIN
  PERFORM cron.unschedule('poll-settlement-and-reconcile');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'poll-settlement-and-reconcile',
  '*/30 * * * *',
  $$SELECT invoke_edge_function('poll-settlement-status')$$
);

-- 3c. settle-to-landlord (hourly at :15)
DO $$ BEGIN
  PERFORM cron.unschedule('settle-to-landlord');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'settle-to-landlord',
  '15 * * * *',
  $$SELECT invoke_edge_function('settle-to-landlord')$$
);

-- 3d. cleanup-stale-payments (every 30 min)
DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-stale-payments');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-stale-payments',
  '*/30 * * * *',
  $$SELECT invoke_edge_function('cleanup-stale-payments')$$
);

-- 3e. extraction-recovery (every 30 min)
DO $$ BEGIN
  PERFORM cron.unschedule('extraction-recovery');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'extraction-recovery',
  '*/30 * * * *',
  $$SELECT invoke_edge_function('extraction-recovery')$$
);

-- ==============================================
-- NOTE: The following cron jobs are pure SQL (no JWT needed) — unchanged:
--   - expire-stale-payments     → calls expire_stale_payments() SQL function
--   - cleanup-processed-webhooks → direct DELETE SQL
--   - expire-stale-otp-requests → direct UPDATE SQL
-- ==============================================
