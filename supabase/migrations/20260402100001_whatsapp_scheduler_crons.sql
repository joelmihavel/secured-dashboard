-- WhatsApp notification scheduler cron jobs
--
-- 1. process-notification-schedule: every 5 min — processes scheduled notifications
--    and sends rent-due reminders on 1st, 3rd, 5th of each month
-- 2. send-onboarding-reminders: every 5 min — sends onboarding drop-off nudges
--    at 15 min and 6 hours after signup

-- ==============================================
-- 1. Process notification schedule (every 5 minutes)
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('process-notification-schedule');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-notification-schedule',
  '*/5 * * * *',
  $$SELECT invoke_edge_function('process-notification-schedule')$$
);

-- ==============================================
-- 2. Send onboarding reminders (every 5 minutes)
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('send-onboarding-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'send-onboarding-reminders',
  '*/5 * * * *',
  $$SELECT invoke_edge_function('send-onboarding-reminders')$$
);
