-- PayU -> Cashfree Payment Gateway Migration
-- Branch: atrishabh/cashfree-migration
--
-- NOTE: Migration 20260226000001 already added:
--   - processed_webhooks table
--   - payment_gateway column (default 'payu')
--   - gateway_order_id, gateway_payment_id, gateway_metadata columns
--   - cf_beneficiary_id, cf_beneficiary_status on bank_accounts
--   - 'expired' and 'partially_refunded' in status CHECK
--
-- This migration adds:
--   - 'cashfree' to payment_gateway CHECK constraint
--   - Easy Split specific columns (cf_order_id, cf_split_posted, etc.)
--   - Indexes for Cashfree operations

-- 1. Update payment_gateway CHECK to include 'cashfree'
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_gateway_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_gateway_check
  CHECK (payment_gateway IN ('payu', 'cashfree', 'demo'));

-- 2. Ensure DEFAULT is 'payu' for backward compat
ALTER TABLE payments ALTER COLUMN payment_gateway SET DEFAULT 'payu';

-- 3. Update status CHECK to include 'expired' (idempotent -- may already exist from 20260226000001)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('initiated', 'processing', 'success', 'failed', 'refunded', 'expired', 'partially_refunded'));

-- 4. Easy Split specific columns (NOT on main yet, from dev branch)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cf_order_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cf_split_posted BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS split_retry_count INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS actual_pg_fee_paise INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS net_collected_paise INTEGER;

-- 5. Indexes for Cashfree operations
CREATE INDEX IF NOT EXISTS idx_payments_cf_order_id
  ON payments(cf_order_id) WHERE cf_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_split_pending
  ON payments(cf_split_posted, split_retry_count)
  WHERE status = 'success' AND cf_split_posted = FALSE AND split_retry_count < 3;
