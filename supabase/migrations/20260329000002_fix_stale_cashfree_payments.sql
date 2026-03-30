-- Fix stale payment expiry to also handle Cashfree payments that never got an order ID
-- Previously only checked payu_mihpayid IS NULL, missing Cashfree orphans

CREATE OR REPLACE FUNCTION expire_stale_payments()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  WITH expired AS (
    UPDATE payments
    SET
      status = 'failed',
      error_message = 'Payment expired — never reached payment gateway',
      updated_at = NOW()
    WHERE status IN ('initiated', 'processing')
      AND created_at < NOW() - INTERVAL '5 minutes'
      AND (
        -- PayU: never reached gateway (no mihpayid)
        (payment_gateway IS NULL OR payment_gateway = 'payu') AND payu_mihpayid IS NULL
        OR
        -- Cashfree: never got an order ID
        payment_gateway = 'cashfree' AND cf_order_id IS NULL
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO affected FROM expired;

  IF affected > 0 THEN
    RAISE LOG 'expire_stale_payments: marked % abandoned payment(s) as failed', affected;
  END IF;

  RETURN affected;
END;
$$ LANGUAGE plpgsql;
