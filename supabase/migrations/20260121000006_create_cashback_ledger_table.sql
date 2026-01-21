-- Flent Secured v2 - Migration: Create Cashback Ledger Table
-- Tracks all cashback credits and debits for users

CREATE TABLE IF NOT EXISTS cashback_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Transaction type
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'earned', -- Cashback earned from payment
    'applied', -- Cashback applied to payment (deduction)
    'expired', -- Cashback expired (not used within validity)
    'bonus', -- Bonus cashback (referral, promo)
    'adjustment', -- Manual adjustment (support case)
    'reversal' -- Reversal of earned cashback (e.g., refund)
  )),

  -- Amount (positive for credits, stored as positive, type determines direction)
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),

  -- Running balance after this transaction
  balance_after_paise BIGINT NOT NULL,

  -- Related entities
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,

  -- Description for audit/display
  description TEXT NOT NULL,

  -- For bonus/promo tracking
  promo_code TEXT,
  referral_user_id UUID REFERENCES users(id),

  -- Expiry tracking
  expires_at TIMESTAMPTZ, -- When this cashback expires
  expired_at TIMESTAMPTZ, -- When it actually expired

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cashback_ledger_user ON cashback_ledger(user_id);
CREATE INDEX idx_cashback_ledger_user_created ON cashback_ledger(user_id, created_at DESC);
CREATE INDEX idx_cashback_ledger_payment ON cashback_ledger(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_cashback_ledger_type ON cashback_ledger(user_id, transaction_type);
CREATE INDEX idx_cashback_ledger_expiring ON cashback_ledger(expires_at)
  WHERE transaction_type = 'earned' AND expired_at IS NULL;

-- Function to calculate current cashback balance
CREATE OR REPLACE FUNCTION get_cashback_balance(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  balance BIGINT;
BEGIN
  SELECT COALESCE(balance_after_paise, 0)
  INTO balance
  FROM cashback_ledger
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get available (non-expired) cashback
CREATE OR REPLACE FUNCTION get_available_cashback(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  earned BIGINT;
  used BIGINT;
  expired BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN transaction_type IN ('earned', 'bonus') THEN amount_paise ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type IN ('applied', 'reversal') THEN amount_paise ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'expired' THEN amount_paise ELSE 0 END), 0)
  INTO earned, used, expired
  FROM cashback_ledger
  WHERE user_id = p_user_id;

  RETURN GREATEST(earned - used - expired, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE cashback_ledger IS 'Double-entry ledger for all cashback transactions';
COMMENT ON COLUMN cashback_ledger.balance_after_paise IS 'Running balance after this transaction for quick balance lookup';
COMMENT ON COLUMN cashback_ledger.expires_at IS 'Cashback expiry date (typically 90 days from earning)';
