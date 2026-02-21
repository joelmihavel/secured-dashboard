-- Flent Secured v2 - Migration: Cashback balance sync trigger
-- Keeps users.cashback_balance_paise in sync with the cashback_ledger
-- Uses actual cashback_ledger column names: transaction_type and amount_paise

CREATE OR REPLACE FUNCTION sync_cashback_balance()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  new_balance BIGINT;
BEGIN
  -- Get the user_id from either NEW or OLD record
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Recalculate balance from ledger using actual transaction_type values
  -- Credits: earned, bonus (add to balance)
  -- Debits: applied, expired, reversal, adjustment (subtract from balance)
  SELECT COALESCE(SUM(
    CASE WHEN transaction_type IN ('earned', 'bonus') THEN amount_paise
         WHEN transaction_type IN ('applied', 'expired', 'reversal', 'adjustment') THEN -amount_paise
         ELSE 0
    END
  ), 0) INTO new_balance
  FROM cashback_ledger
  WHERE user_id = target_user_id;

  -- Update user's balance (floor at 0)
  UPDATE users SET cashback_balance_paise = GREATEST(new_balance, 0) WHERE id = target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_cashback_balance
  AFTER INSERT OR UPDATE OR DELETE ON cashback_ledger
  FOR EACH ROW
  EXECUTE FUNCTION sync_cashback_balance();
