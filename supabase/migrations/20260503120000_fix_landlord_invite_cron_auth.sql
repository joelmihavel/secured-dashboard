-- Fix landlord-invite cron auth.
--
-- The 20260503100000 migration scheduled the two new crons via raw
-- net.http_post() with `Bearer ' || current_setting('app.service_role_key', true)`.
-- That setting is NULL on this database — only `app.settings.jwt_exp` is set
-- at the database level, never the service-role key. Result: every cron
-- firing returned HTTP 401 ("No authorization header provided"), so neither
-- reconcile-landlord-invite-deliveries nor retry-landlord-invites ran for
-- the first ~2 hours after deploy.
--
-- Every other cron-driven edge function in this project uses the
-- `invoke_edge_function(fn_name, body)` helper from the
-- 20260121000012_create_pg_cron_jobs.sql migration. That helper reads the
-- service role key from `private.edge_function_config` (set during initial
-- project provisioning), avoiding the NULL-setting trap. We re-schedule the
-- two crons here using the same helper so they're consistent with the rest
-- of the codebase and resilient to future runs of the original migration.
--
-- This was patched directly in prod via SQL on 2026-05-03; this migration
-- brings the repo back in sync so future redeploys don't reintroduce the
-- bug.

BEGIN;

DO $$ BEGIN
  PERFORM cron.unschedule('retry-landlord-invites');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'retry-landlord-invites',
  '*/15 * * * *',
  $$ SELECT invoke_edge_function('retry-landlord-invites') $$
);

DO $$ BEGIN
  PERFORM cron.unschedule('reconcile-landlord-invite-deliveries');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reconcile-landlord-invite-deliveries',
  '* * * * *',
  $$ SELECT invoke_edge_function('reconcile-landlord-invite-deliveries') $$
);

COMMIT;
