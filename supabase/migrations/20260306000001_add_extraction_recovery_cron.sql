-- Flent Secured v2 - Migration: Extraction Recovery unique constraint + cron
--
-- Part 1: Unique constraint on tenancies to prevent duplicate tenancies per user+extraction.
-- Part 2: pg_cron schedule to run extraction-recovery every 30 minutes.

-- ==============================================
-- Part 1: Unique constraint on tenancies
-- ==============================================
-- Prevents both recovery and confirm-extraction from creating duplicate tenancies
-- for the same user+extraction pair. The loser gets a 23505 error, which both
-- functions handle gracefully.
-- Note: extracted_rental_info_id can be NULL for old/manual tenancies, and
-- PostgreSQL treats each NULL as unique, so this only applies to non-null pairs.

-- Deduplicate before adding constraint: keep the newest tenancy per (user_id, extracted_rental_info_id)
-- and delete older duplicates. Only affects rows where extracted_rental_info_id IS NOT NULL.
DELETE FROM tenancies t1
USING tenancies t2
WHERE t1.user_id = t2.user_id
  AND t1.extracted_rental_info_id = t2.extracted_rental_info_id
  AND t1.extracted_rental_info_id IS NOT NULL
  AND t1.created_at < t2.created_at;

ALTER TABLE tenancies
ADD CONSTRAINT unique_user_extraction
UNIQUE (user_id, extracted_rental_info_id);

-- ==============================================
-- Part 2: pg_cron schedule for extraction-recovery
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('extraction-recovery');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'extraction-recovery',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/extraction-recovery',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTA5MiwiZXhwIjoyMDc4ODE3MDkyfQ.RiKkfFqA7ZlIgxW_pbkQ8YjvbCvzohPL244n0A-ubks"}'::jsonb
  )$$
);
