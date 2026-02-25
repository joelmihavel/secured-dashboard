-- ==============================================
-- Migration: Add gateway-agnostic payment columns for Cashfree migration
-- Date: 2026-02-26
-- Purpose: Add generic gateway columns alongside PayU-specific columns
--          to support dual-gateway operation during PayU->Cashfree migration.
-- Risk: None -- purely additive columns, zero breaking changes.
-- ==============================================

-- ============================================
-- PAYMENTS TABLE -- Gateway-agnostic columns
-- ============================================

-- Gateway discriminator
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'payu';

-- Add named CHECK constraint (separate statement to handle IF NOT EXISTS column)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_gateway_check'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_payment_gateway_check
      CHECK (payment_gateway IN ('payu', 'cashfree'));
  END IF;
END $$;

-- Generic gateway identifiers (replaces payu_txn_id, payu_mihpayid for new payments)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_order_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_status TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_error_code TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_error_message TEXT;

-- JSONB for gateway-specific raw data (replaces payu_raw_response, payu_initiation_params)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_metadata JSONB DEFAULT '{}';

-- Settlement tracking (generic)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_settlement_status TEXT DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_settlement_utr TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_settled_at TIMESTAMPTZ;

-- Payout tracking (Cashfree Payouts)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payout_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payout_status TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payout_utr TEXT;

-- ============================================
-- REFUNDS TABLE -- Gateway-agnostic columns
-- ============================================

ALTER TABLE refunds ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'payu';
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS gateway_refund_id TEXT;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS gateway_refund_status TEXT;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS gateway_metadata JSONB DEFAULT '{}';

-- ============================================
-- PAYMENT METHODS TABLE -- Gateway-agnostic columns
-- ============================================

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'payu';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS gateway_instrument_id TEXT;

-- ============================================
-- PROCESSED WEBHOOKS -- Deduplication table
-- ============================================

CREATE TABLE IF NOT EXISTS processed_webhooks (
  event_id TEXT PRIMARY KEY,
  payment_gateway TEXT NOT NULL,
  payment_id UUID REFERENCES payments(id),
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_expires
  ON processed_webhooks(expires_at);

-- ============================================
-- BANK ACCOUNTS -- Beneficiary tracking
-- ============================================

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS cf_beneficiary_id TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS cf_beneficiary_status TEXT;

-- ============================================
-- PAYMENTS STATUS -- Add 'expired' status
-- ============================================

-- Cashfree orders can expire, so add 'expired' to the status CHECK constraint.
-- Drop any existing constraint (auto-generated name varies by DB).
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find existing CHECK constraint on status column
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  WHERE c.conrelid = 'payments'::regclass
    AND c.contype = 'c'
    AND a.attname = 'status'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('initiated', 'processing', 'success', 'failed', 'refunded', 'partially_refunded', 'expired'));

-- ============================================
-- INDEXES -- Query optimization
-- ============================================

CREATE INDEX IF NOT EXISTS idx_payments_gateway
  ON payments(payment_gateway);

CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id
  ON payments(gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_id
  ON payments(gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_cf_settlement_pending
  ON payments(gateway_settlement_status)
  WHERE status = 'success'
    AND payment_gateway = 'cashfree'
    AND gateway_settlement_status IN ('pending', 'processing');

-- ============================================
-- BACKFILL -- Existing PayU payments
-- ============================================

UPDATE payments SET
  gateway_order_id = payu_txn_id,
  gateway_payment_id = payu_mihpayid,
  gateway_status = payu_status,
  gateway_error_code = payu_error_code,
  gateway_error_message = payu_error_message,
  gateway_metadata = COALESCE(payu_raw_response, '{}')::jsonb,
  gateway_settlement_status = COALESCE(payu_settlement_status, 'pending'),
  gateway_settlement_utr = payu_settlement_utr,
  gateway_settled_at = payu_settled_at
WHERE payment_gateway = 'payu';

-- ============================================
-- CLEANUP CRON -- Auto-expire processed_webhooks
-- ============================================

-- Add cron job to clean up expired webhook dedup entries (daily at 3 AM)
SELECT cron.schedule(
  'cleanup-processed-webhooks',
  '0 3 * * *',
  $$DELETE FROM processed_webhooks WHERE expires_at < NOW()$$
);
