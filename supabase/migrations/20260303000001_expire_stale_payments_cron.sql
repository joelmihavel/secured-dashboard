-- Flent Secured v2 - Migration: Auto-expire stale payments
--
-- Marks payments as 'failed' if they remain in 'initiated' or 'processing'
-- status for more than 5 minutes without receiving a PayU webhook.
-- Runs every minute via pg_cron.

-- ==============================================
-- Function: expire stale payments
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
      error_message = 'Payment expired — no gateway response within 5 minutes',
      updated_at = NOW()
    WHERE status IN ('initiated', 'processing')
      AND created_at < NOW() - INTERVAL '5 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO affected FROM expired;

  IF affected > 0 THEN
    RAISE LOG 'expire_stale_payments: marked % payment(s) as failed', affected;
  END IF;

  RETURN affected;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_stale_payments() IS 'Auto-expire payments stuck in initiated/processing for >5 min';

-- ==============================================
-- Cron job: run every minute
-- ==============================================

DO $$ BEGIN
  PERFORM cron.unschedule('expire-stale-payments');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-stale-payments',
  '* * * * *',
  $$SELECT expire_stale_payments()$$
);
