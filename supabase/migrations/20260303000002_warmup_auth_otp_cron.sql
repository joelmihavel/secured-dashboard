-- OPT-10: Keep auth-otp edge function isolate warm to avoid cold starts (100-500ms)
-- Pings the health endpoint every 4 minutes via pg_cron + pg_net

DO $$ BEGIN
  PERFORM cron.unschedule('warmup-auth-otp');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'warmup-auth-otp',
  '*/4 * * * *',
  $$SELECT net.http_post(
    url := 'https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/auth-otp',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTA5MiwiZXhwIjoyMDc4ODE3MDkyfQ.RiKkfFqA7ZlIgxW_pbkQ8YjvbCvzohPL244n0A-ubks"}'::jsonb,
    body := '{"action":"health"}'::jsonb
  )$$
);
