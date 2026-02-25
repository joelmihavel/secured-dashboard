-- =============================================================================
-- Flent Secured v2 - Cashback Instant Discount Migration
-- Date: 2026-02-25
--
-- Replaces wallet-based earn/redeem cashback with instant 1% rent discount.
-- User pays (rent - 1%), landlord gets full rent, Flent covers the gap.
--
-- Changes:
--   1. Fix 6 audit trail bugs in cashback functions
--   2. Add 'discount' transaction type to cashback_ledger
--   3. Add flent_subsidy_paise and net_rent_paise columns to payments
--   4. Add double-discount prevention index
--   5. Add auto-reversal trigger on payment refund
--   6. Soft-deprecate wallet columns (comments only, no drops)
-- =============================================================================

-- =============================================================================
-- 1a. Add 'discount' transaction type to cashback_ledger
-- =============================================================================

ALTER TABLE cashback_ledger
  DROP CONSTRAINT IF EXISTS cashback_ledger_transaction_type_check;

ALTER TABLE cashback_ledger
  ADD CONSTRAINT cashback_ledger_transaction_type_check CHECK (transaction_type IN (
    'earned',           -- Cashback earned from payment (legacy)
    'applied',          -- Cashback applied to payment / wallet debit (legacy)
    'expired',          -- Cashback expired
    'bonus',            -- Bonus cashback (promo)
    'referral_bonus',   -- Referral bonus cashback
    'promotional',      -- Promotional cashback
    'adjustment',       -- Manual adjustment (support case)
    'reversal',         -- Reversal (refund, etc.)
    'discount'          -- NEW: Instant 1% rent discount audit entry
  ));

-- =============================================================================
-- 1b. New columns on payments table
-- =============================================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS flent_subsidy_paise BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS net_rent_paise BIGINT;

-- Add check constraint for flent_subsidy_paise (non-negative)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_flent_subsidy_paise_check'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_flent_subsidy_paise_check
      CHECK (flent_subsidy_paise >= 0);
  END IF;
END;
$$;

-- =============================================================================
-- 1c. Fix Bug #2: Double-credit index on wrong column
-- The existing idx_cashback_ledger_unique_earned is on (reference_id, transaction_type)
-- but reference_id is often NULL. Recreate on (payment_id, transaction_type).
-- =============================================================================

DROP INDEX IF EXISTS idx_cashback_ledger_unique_earned;

CREATE UNIQUE INDEX idx_cashback_ledger_unique_earned
  ON cashback_ledger (payment_id, transaction_type)
  WHERE transaction_type = 'earned' AND payment_id IS NOT NULL;

-- =============================================================================
-- 1d. Double-discount prevention index (NEW)
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_cashback_ledger_unique_discount
  ON cashback_ledger (payment_id, transaction_type)
  WHERE transaction_type = 'discount' AND payment_id IS NOT NULL;

-- =============================================================================
-- 1e. Fix Bug #1 + #3: Rewrite get_available_cashback()
-- Unify: all credit types included, reversal is a DEBIT (not credit)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_cashback(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  credits BIGINT;
  debits BIGINT;
BEGIN
  SELECT
    -- Credits: all types that add to the wallet
    COALESCE(SUM(CASE
      WHEN transaction_type IN ('earned', 'bonus', 'referral_bonus', 'promotional')
      THEN amount_paise ELSE 0 END), 0),
    -- Debits: all types that reduce the wallet
    COALESCE(SUM(CASE
      WHEN transaction_type IN ('applied', 'reversal', 'expired', 'adjustment')
      THEN amount_paise ELSE 0 END), 0)
  INTO credits, debits
  FROM cashback_ledger
  WHERE user_id = p_user_id;

  RETURN GREATEST(credits - debits, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- 1f. Fix Bug #1 + #3: Rewrite debit_cashback()
-- Include bonus/referral_bonus/promotional as credits, reversal as debit
-- =============================================================================

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
  -- Lock the user's cashback rows and compute balance
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type IN ('earned', 'bonus', 'referral_bonus', 'promotional') THEN amount_paise
      WHEN transaction_type IN ('applied', 'reversal', 'expired', 'adjustment') THEN -amount_paise
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

-- =============================================================================
-- 1g. Fix Bug #4: Rewrite sync_cashback_balance()
-- Include referral_bonus and promotional as credits
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_cashback_balance()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  new_balance BIGINT;
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Credits: earned, bonus, referral_bonus, promotional
  -- Debits: applied, expired, reversal, adjustment
  -- Note: 'discount' is an audit-only entry (no wallet impact)
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type IN ('earned', 'bonus', 'referral_bonus', 'promotional') THEN amount_paise
      WHEN transaction_type IN ('applied', 'expired', 'reversal', 'adjustment') THEN -amount_paise
      ELSE 0
    END
  ), 0) INTO new_balance
  FROM cashback_ledger
  WHERE user_id = target_user_id;

  UPDATE users SET cashback_balance_paise = GREATEST(new_balance, 0) WHERE id = target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1h. Fix Bug #5: Auto-reverse cashback/discount on payment refund
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_reverse_cashback_on_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_discount_amount BIGINT;
  v_user_id UUID;
BEGIN
  -- Only trigger when status changes TO 'refunded'
  IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
    v_user_id := NEW.user_id;

    -- Check if there's a 'discount' audit entry for this payment
    SELECT amount_paise INTO v_discount_amount
    FROM cashback_ledger
    WHERE payment_id = NEW.id
      AND transaction_type = 'discount'
    LIMIT 1;

    IF v_discount_amount IS NOT NULL AND v_discount_amount > 0 THEN
      -- Insert reversal entry
      INSERT INTO cashback_ledger (
        user_id, transaction_type, amount_paise, balance_after_paise,
        payment_id, tenancy_id, reference_type, reference_id, description
      )
      VALUES (
        v_user_id, 'reversal', v_discount_amount, 0,
        NEW.id, NEW.tenancy_id, 'payment', NEW.id,
        'Instant discount reversed due to payment refund'
      );
    END IF;

    -- Also reverse any legacy 'earned' entries
    -- (for historical payments under the old model)
    IF EXISTS (
      SELECT 1 FROM cashback_ledger
      WHERE payment_id = NEW.id AND transaction_type = 'earned'
    ) THEN
      INSERT INTO cashback_ledger (
        user_id, transaction_type, amount_paise, balance_after_paise,
        payment_id, tenancy_id, reference_type, reference_id, description
      )
      SELECT
        v_user_id, 'reversal', amount_paise, 0,
        NEW.id, NEW.tenancy_id, 'payment', NEW.id,
        'Cashback reversed due to payment refund'
      FROM cashback_ledger
      WHERE payment_id = NEW.id AND transaction_type = 'earned';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS trg_auto_reverse_cashback_on_refund ON payments;

CREATE TRIGGER trg_auto_reverse_cashback_on_refund
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_reverse_cashback_on_refund();

-- =============================================================================
-- 1i. Soft-deprecate wallet columns (comments only, no drops)
-- =============================================================================

COMMENT ON COLUMN users.cashback_balance_paise IS
  'DEPRECATED: Wallet removed in instant-discount model. Kept for historical data. sync_cashback_balance trigger still updates it.';

COMMENT ON COLUMN payments.cashback_earned_paise IS
  'DEPRECATED: Set to 0 for new payments under instant-discount model. Historical payments may have non-zero values.';

COMMENT ON COLUMN payments.intended_cashback_paise IS
  'DEPRECATED: No deferred wallet debit needed in instant-discount model. Set to 0 for new payments.';

-- Done!
