-- Flent Secured v2 - Fix upgrade-landlord-status cron auth.
--
-- Same root cause as 20260503120000_fix_landlord_invite_cron_auth.sql:
-- The 20260403100001 migration scheduled the upgrade-landlord-status cron
-- via raw net.http_post() with `Bearer ' || current_setting('app.service_role_key', true)`.
-- That setting is NULL on this database, so every cron firing returned HTTP 401
-- and the M360 backfill upgrade has never run on prod since 2026-04-03.
-- Impact: 4 tenancies stuck in otp_confirmed/human_review (oldest 2026-04-11).
-- The new failure-notification path added in 20260503110000 also depends on
-- this cron, so it is dead on arrival until this fix lands.
--
-- Fix: reschedule using the invoke_edge_function() helper (from
-- 20260121000012_create_pg_cron_jobs.sql), which reads the service-role key
-- from private.edge_function_config and matches every other cron in the repo.
--
-- This was patched directly in prod via SQL on 2026-05-04; this migration
-- brings the repo back in sync so future redeploys don't reintroduce the bug.

BEGIN;

DO $$ BEGIN
  PERFORM cron.unschedule('upgrade-landlord-status');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'upgrade-landlord-status',
  '*/15 * * * *',
  $$ SELECT invoke_edge_function('upgrade-landlord-status') $$
);

COMMIT;

-- rollback:
--   SELECT cron.unschedule('upgrade-landlord-status');
--   SELECT cron.schedule(
--     'upgrade-landlord-status',
--     '*/15 * * * *',
--     $$SELECT net.http_post(
--       url := get_edge_function_url('upgrade-landlord-status'),
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
--       ),
--       body := '{}'::jsonb
--     )$$
--   );
--   Note: rollback restores the broken auth path. Do not roll back unless invoke_edge_function is unavailable.
