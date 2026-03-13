-- Flent Secured v2 - Migration: Fix cron infrastructure to point to Main DB
--
-- CONTEXT: All pg_cron infrastructure was set up when the project was on Dev DB
-- (zqlowjveyqiagnbmfwsb). After migrating to Main DB (uowjtrzmszuaiokqxgir),
-- the invoke_edge_function() helper and private.edge_function_config still
-- referenced the old Dev DB URL and secret key.
--
-- FIX: Update the config table and function to use Main DB values.
-- Also adds base_url to the config table so future URL changes only
-- require a table update, not a function redeploy.

-- ==============================================
-- 1. Update private config with Main DB values
-- ==============================================

-- Store the base URL in config (new row) so invoke_edge_function() reads it dynamically
INSERT INTO private.edge_function_config (key, value)
VALUES ('base_url', 'https://uowjtrzmszuaiokqxgir.supabase.co')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Update the service role key to Main DB's key
-- Using the JWT service_role key (accepted by edge functions via SUPABASE_SERVICE_ROLE_KEY fallback)
UPDATE private.edge_function_config
SET value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTA5MiwiZXhwIjoyMDc4ODE3MDkyfQ.RiKkfFqA7ZlIgxW_pbkQ8YjvbCvzohPL244n0A-ubks'
WHERE key = 'service_role_key';

-- ==============================================
-- 2. Update invoke_edge_function() to read URL from config
-- ==============================================

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

-- Maintain restricted access
REVOKE EXECUTE ON FUNCTION invoke_edge_function(text, jsonb) FROM anon, authenticated, service_role;

COMMENT ON FUNCTION invoke_edge_function(text, jsonb) IS
  'Invoke a Supabase edge function with service role auth. Reads URL and key from private.edge_function_config. Used by pg_cron jobs only.';
