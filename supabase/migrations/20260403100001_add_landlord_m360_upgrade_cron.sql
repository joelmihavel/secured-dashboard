-- Flent Secured v2 - Migration: Landlord M360 Upgrade Cron
-- Processes tenancies with landlord_status='otp_confirmed' and runs
-- M360 name match to upgrade to 'verified' if matched.
-- Runs every 15 minutes.

-- ==============================================
-- CRON JOB: Upgrade Landlord Status (Every 15 min)
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('upgrade-landlord-status');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'upgrade-landlord-status',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := get_edge_function_url('upgrade-landlord-status'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  )$$
);
