-- Flent Secured v2 - Migration: Fix cashback expiry function
-- The previous expire_old_cashback() used DISTINCT ON (user_id) which only expired
-- ONE entry per user per cron run. This replacement processes ALL expired entries
-- using FOR UPDATE SKIP LOCKED for concurrent safety.

CREATE OR REPLACE FUNCTION expire_old_cashback()
RETURNS void AS $$
DECLARE
  v_entry RECORD;
  v_current_balance BIGINT;
BEGIN
  -- Process ALL expired cashback entries, not just one per user
  FOR v_entry IN
    SELECT id, user_id, amount_paise
    FROM cashback_ledger
    WHERE transaction_type = 'earned'
      AND expired_at IS NULL
      AND expires_at < NOW()
    ORDER BY user_id, created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Get current balance (recalculated per entry for running accuracy)
    SELECT get_cashback_balance(v_entry.user_id) INTO v_current_balance;

    -- Create expiry ledger entry
    INSERT INTO cashback_ledger (
      user_id, transaction_type, amount_paise, balance_after_paise,
      description
    ) VALUES (
      v_entry.user_id,
      'expired',
      v_entry.amount_paise,
      GREATEST(v_current_balance - v_entry.amount_paise, 0),
      'Cashback expired after 90 days'
    );

    -- Mark original entry as expired
    UPDATE cashback_ledger
    SET expired_at = NOW()
    WHERE id = v_entry.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_cashback IS 'Expires ALL overdue cashback entries with row-level locking for concurrent safety';
