-- Fix: Payment unique constraints were too restrictive
--
-- PROBLEM:
--   idx_payments_unique_month: UNIQUE(tenancy_id, payment_month) WHERE status IN ('initiated','processing','success')
--   idx_payments_active_per_month: UNIQUE(tenancy_id, payment_month) WHERE status NOT IN ('failed','expired','refunded')
--
--   Both constraints prevent new payment INSERTs when a 'success' record already exists
--   for the same month. But partial payments and retries require multiple successful payments
--   per month (the edge function explicitly allows this — see initiate-payment line 321).
--
-- FIX:
--   Drop both constraints. Replace with a narrow constraint that only prevents concurrent
--   in-progress payments (initiated/processing) — matching the edge function's own soft check.
--   Multiple successful, failed, or refunded payments per month are allowed.

-- Drop the original overly-broad unique constraint
DROP INDEX IF EXISTS idx_payments_unique_month;

-- Drop the security-hardening variant (equally restrictive)
DROP INDEX IF EXISTS idx_payments_active_per_month;

-- New constraint: only one in-progress payment per tenancy per month
-- This prevents double-charge while allowing retries and partial payments
CREATE UNIQUE INDEX idx_payments_in_progress_per_month
ON payments (tenancy_id, payment_month)
WHERE status IN ('initiated', 'processing');
