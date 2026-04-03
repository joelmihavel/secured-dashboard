-- Fix stale payment expiry to also handle payments that GOT a gateway ID
-- but were never completed (user abandoned mid-flow).
--
-- Previous logic only expired payments where cf_order_id IS NULL or
-- payu_mihpayid IS NULL. This left a gap: if the user opened the gateway
-- session but dropped off, the payment stays in 'initiated' forever,
-- blocking future payment attempts.
--
-- Fix: Add a second pass that expires ANY initiated/processing payment
-- older than 15 minutes, regardless of gateway ID presence. The webhook
-- retry logic re-fetches current status before updating, so a late-arriving
-- success webhook will still reconcile correctly.

CREATE OR REPLACE FUNCTION expire_stale_payments()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
  affected_stale INTEGER;
BEGIN
  -- Pass 1: Immediate expiry for payments that never reached the gateway (existing logic)
  WITH expired AS (
    UPDATE payments
    SET
      status = 'failed',
      error_message = 'Payment expired — never reached payment gateway',
      updated_at = NOW()
    WHERE status IN ('initiated', 'processing')
      AND created_at < NOW() - INTERVAL '5 minutes'
      AND (
        (payment_gateway IS NULL OR payment_gateway = 'payu') AND payu_mihpayid IS NULL
        OR
        payment_gateway = 'cashfree' AND cf_order_id IS NULL
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO affected FROM expired;

  -- Pass 2: Time-based expiry for payments WITH gateway IDs that are still stuck.
  -- 15 minutes is generous — any real payment completes well within this window.
  WITH expired_stale AS (
    UPDATE payments
    SET
      status = 'failed',
      error_message = 'Payment expired — abandoned after gateway session created',
      updated_at = NOW()
    WHERE status IN ('initiated', 'processing')
      AND created_at < NOW() - INTERVAL '15 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO affected_stale FROM expired_stale;

  affected := affected + affected_stale;

  IF affected > 0 THEN
    RAISE LOG 'expire_stale_payments: marked % abandoned payment(s) as failed', affected;
  END IF;

  RETURN affected;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_stale_payments() IS
  'Auto-expire stale payments: 5min for no-gateway-ID, 15min for all (including those with gateway sessions)';
