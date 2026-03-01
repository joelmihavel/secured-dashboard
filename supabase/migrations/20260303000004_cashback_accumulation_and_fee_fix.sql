-- Migration: Cashback accumulation model + fee double-charge fix
--
-- 1. Add estimated_pg_fee_paise column (we no longer include fee in PayU amount)
-- 2. Add accumulated_redeemed_paise column (tracks how much accumulated balance was redeemed)
-- 3. Create increment/decrement RPCs for cashback_balance_paise

-- New columns on payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS estimated_pg_fee_paise INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS accumulated_redeemed_paise INTEGER DEFAULT 0;

-- Increment cashback balance (for unverified earning)
CREATE OR REPLACE FUNCTION increment_cashback_balance(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET cashback_balance_paise = COALESCE(cashback_balance_paise, 0) + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement cashback balance (for redemption when verified)
CREATE OR REPLACE FUNCTION decrement_cashback_balance(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET cashback_balance_paise = GREATEST(0, COALESCE(cashback_balance_paise, 0) - p_amount)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
