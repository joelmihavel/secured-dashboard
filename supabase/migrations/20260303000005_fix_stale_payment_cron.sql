-- Flent Secured v2 - Migration: Fix stale payment expiry cron
--
-- Problem: The previous expire_stale_payments() cron expires ALL initiated/processing
-- payments after 5 min, even those that DID reach PayU (payu_mihpayid IS NOT NULL).
-- This is too aggressive — netbanking payments can take 10-15 min at the bank.
-- The webhook can still transition failed→success, but it creates noisy false-fails.
--
-- Fix: Only expire payments where payu_mihpayid IS NULL (never reached PayU).
-- Payments that reached PayU will be handled by the webhook or check-payment-status.
--
-- Also adds a pg_cron job for the cleanup-stale-payments edge function as a safety
-- net for payments that DID reach PayU but never got a webhook (runs every 30 min).

-- ==============================================
-- 1. Fix the SQL function: only expire payments that never reached PayU
-- ==============================================

CREATE OR REPLACE FUNCTION expire_stale_payments()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  WITH expired AS (
    UPDATE payments
    SET
      status = 'failed',
      payu_status = COALESCE(payu_status, 'expired_no_webhook'),
      error_message = 'Payment expired — never reached payment gateway',
      updated_at = NOW()
    WHERE status IN ('initiated', 'processing')
      AND created_at < NOW() - INTERVAL '5 minutes'
      AND payu_mihpayid IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO affected FROM expired;

  IF affected > 0 THEN
    RAISE LOG 'expire_stale_payments: marked % abandoned payment(s) as failed', affected;
  END IF;

  RETURN affected;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_stale_payments() IS
  'Auto-expire payments stuck in initiated/processing for >5 min that never reached PayU (mihpayid IS NULL)';

-- ==============================================
-- 2. Add cron for cleanup-stale-payments edge function (safety net)
--    Runs every 30 min, verifies with PayU before expiring
--    Uses service_role JWT auth (same pattern as other cron-invoked edge functions)
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-stale-payments');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-stale-payments',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://zqlowjveyqiagnbmfwsb.supabase.co/functions/v1/cleanup-stale-payments',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbG93anZleXFpYWduYm1md3NiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk5NjU1NSwiZXhwIjoyMDg0NTcyNTU1fQ.2eeohYeOPhcN1mAkoNmhU3FBAKcmDEnEQ9sx8LnapSU"}'::jsonb
  )$$
);
