-- ==============================================
-- Migration: Tighten payment_gateway constraint to PayU-only
-- Date: 2026-02-28
-- Purpose: Remove 'cashfree' from the payment_gateway CHECK constraint
--          and drop the Cashfree-only settlement index (zero matching rows).
-- ==============================================

-- 1. Update any lingering cashfree rows to payu (safety net)
UPDATE payments SET payment_gateway = 'payu' WHERE payment_gateway = 'cashfree';

-- 2. Drop and recreate the CHECK constraint as PayU-only
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_gateway_check;

ALTER TABLE payments ADD CONSTRAINT payments_payment_gateway_check
  CHECK (payment_gateway IN ('payu'));

-- 3. Drop the Cashfree-only partial index (filters on payment_gateway = 'cashfree', zero rows)
DROP INDEX IF EXISTS idx_payments_cf_settlement_pending;
