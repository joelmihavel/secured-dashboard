-- Payment Security Hardening Migration
-- Addresses: S5 (double-credit prevention), S12 (atomic cashback), S16 (intended cashback), S18 (active payment uniqueness)

-- Ensure required columns exist on cashback_ledger before creating indexes/functions
ALTER TABLE cashback_ledger ADD COLUMN IF NOT EXISTS reference_id uuid;
ALTER TABLE cashback_ledger ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE cashback_ledger ADD COLUMN IF NOT EXISTS balance_after_paise integer;
ALTER TABLE cashback_ledger ADD COLUMN IF NOT EXISTS payment_id uuid;
ALTER TABLE cashback_ledger ADD COLUMN IF NOT EXISTS tenancy_id uuid;
ALTER TABLE cashback_ledger ADD COLUMN IF NOT EXISTS description text;

-- S5: Unique partial index on cashback_ledger to prevent double cashback credit
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashback_ledger_unique_earned
ON cashback_ledger (reference_id, transaction_type)
WHERE transaction_type = 'earned';

-- S16: Add intended_cashback_paise column to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS intended_cashback_paise integer DEFAULT 0;

-- Ensure payment_month column exists before creating index
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_month text;

-- S18: Unique constraint on active payments per tenancy+month
-- Only one non-terminal payment per tenancy per month
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_active_per_month
ON payments (tenancy_id, payment_month)
WHERE status NOT IN ('failed', 'expired', 'refunded');

-- S12: Atomic cashback debit function
CREATE OR REPLACE FUNCTION debit_cashback(
  p_user_id uuid,
  p_amount integer,
  p_payment_id uuid,
  p_tenancy_id uuid,
  p_description text
)
RETURNS integer AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Lock the user's cashback rows
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type IN ('earned') THEN amount_paise
      WHEN transaction_type IN ('applied', 'expired') THEN -amount_paise
      WHEN transaction_type = 'reversal' THEN amount_paise
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM cashback_ledger
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient cashback balance: have %, need %', v_balance, p_amount;
  END IF;

  INSERT INTO cashback_ledger (
    user_id, transaction_type, amount_paise, balance_after_paise,
    payment_id, tenancy_id, reference_type, reference_id, description
  )
  VALUES (
    p_user_id, 'applied', p_amount, v_balance - p_amount,
    p_payment_id, p_tenancy_id, 'payment', p_payment_id, p_description
  );

  RETURN v_balance - p_amount;
END;
$$ LANGUAGE plpgsql;

-- Add 'expired' to payment status enum if it exists
DO $$
BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION
  WHEN undefined_object THEN
    -- payment_status type doesn't exist, status is stored as text
    NULL;
END;
$$;
