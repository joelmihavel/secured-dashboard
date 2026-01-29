-- Flent Secured v2 - Migration: Fix Cashback Ledger Transaction Type Constraint
-- Date: 2026-01-29
-- Description: Updates CHECK constraint to include 'referral_bonus' and 'promotional' types
--              required by the apply_referral_code function

-- Drop the existing CHECK constraint and add updated one
ALTER TABLE cashback_ledger
  DROP CONSTRAINT IF EXISTS cashback_ledger_transaction_type_check;

ALTER TABLE cashback_ledger
  ADD CONSTRAINT cashback_ledger_transaction_type_check CHECK (transaction_type IN (
    'earned',           -- Cashback earned from payment
    'applied',          -- Cashback applied to payment (deduction)
    'expired',          -- Cashback expired (not used within validity)
    'bonus',            -- Bonus cashback (promo)
    'referral_bonus',   -- Referral bonus cashback (NEW)
    'promotional',      -- Promotional cashback (NEW)
    'adjustment',       -- Manual adjustment (support case)
    'reversal'          -- Reversal of earned cashback (e.g., refund)
  ));

-- Update get_available_cashback function to handle new types
CREATE OR REPLACE FUNCTION get_available_cashback(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  earned BIGINT;
  used BIGINT;
  expired BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN transaction_type IN ('earned', 'bonus', 'referral_bonus', 'promotional') THEN amount_paise ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type IN ('applied', 'reversal') THEN amount_paise ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'expired' THEN amount_paise ELSE 0 END), 0)
  INTO earned, used, expired
  FROM cashback_ledger
  WHERE user_id = p_user_id;

  RETURN GREATEST(earned - used - expired, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON CONSTRAINT cashback_ledger_transaction_type_check ON cashback_ledger IS 'Valid transaction types including referral and promotional bonuses';
