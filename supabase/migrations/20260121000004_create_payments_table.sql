-- Flent Secured v2 - Migration: Create Payments Table
-- Tracks all rent payment transactions

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Amount breakdown (all in paise: 1 INR = 100 paise)
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  pg_fee_paise BIGINT NOT NULL DEFAULT 0 CHECK (pg_fee_paise >= 0),
  cashback_applied_paise BIGINT NOT NULL DEFAULT 0 CHECK (cashback_applied_paise >= 0),
  cashback_earned_paise BIGINT NOT NULL DEFAULT 0 CHECK (cashback_earned_paise >= 0),
  total_paid_paise BIGINT GENERATED ALWAYS AS (amount_paise + pg_fee_paise - cashback_applied_paise) STORED,

  -- Payment status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'success', 'failed', 'refunded', 'partially_refunded')),

  -- PayU transaction details
  payu_txn_id TEXT,
  payu_mihpayid TEXT UNIQUE, -- PayU's unique transaction ID
  payu_status TEXT, -- Raw status from PayU
  payu_error_code TEXT,
  payu_error_message TEXT,

  -- Payment method details
  payment_method TEXT CHECK (payment_method IN ('upi', 'upi_intent', 'upi_collect', 'card', 'netbanking', 'wallet')),
  payment_method_details JSONB, -- Bank name, UPI app, card type, etc.

  -- Settlement details
  settlement_status TEXT DEFAULT 'pending'
    CHECK (settlement_status IN ('pending', 'processing', 'settled', 'failed')),
  settled_to_bank_account_id UUID REFERENCES bank_accounts(id),
  settlement_utr TEXT, -- UTR from bank settlement

  -- Idempotency
  idempotency_key TEXT UNIQUE NOT NULL,

  -- For which month's rent
  rent_month DATE NOT NULL, -- First day of the rent month

  -- Refund tracking
  refund_amount_paise BIGINT DEFAULT 0 CHECK (refund_amount_paise >= 0),
  refund_reason TEXT,
  refund_initiated_at TIMESTAMPTZ,
  refund_completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ, -- When payment was confirmed successful
  settled_at TIMESTAMPTZ, -- When money was settled to landlord

  -- IP and device info for fraud detection
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT
);

-- Indexes for common queries
CREATE INDEX idx_payments_tenancy_id ON payments(tenancy_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payu_mihpayid ON payments(payu_mihpayid) WHERE payu_mihpayid IS NOT NULL;
CREATE INDEX idx_payments_idempotency_key ON payments(idempotency_key);
CREATE INDEX idx_payments_rent_month ON payments(tenancy_id, rent_month);
CREATE INDEX idx_payments_settlement_status ON payments(settlement_status) WHERE status = 'success';
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- Prevent duplicate payments for same month
CREATE UNIQUE INDEX idx_payments_unique_month
  ON payments(tenancy_id, rent_month)
  WHERE status IN ('pending', 'processing', 'success');

COMMENT ON TABLE payments IS 'All rent payment transactions with full audit trail';
COMMENT ON COLUMN payments.amount_paise IS 'Base rent amount in paise (before fees, after cashback deduction from rent)';
COMMENT ON COLUMN payments.pg_fee_paise IS 'Payment gateway fee charged to tenant in paise';
COMMENT ON COLUMN payments.cashback_applied_paise IS 'Cashback amount deducted from this payment in paise';
COMMENT ON COLUMN payments.cashback_earned_paise IS 'Cashback earned from this payment (1% of amount_paise)';
COMMENT ON COLUMN payments.rent_month IS 'First day of the month this payment is for';
