-- Prevent duplicate in-progress payments for the same tenancy+month.
-- This is a partial unique index that only applies to active payments
-- (initiated, processing). Terminal states (success, failed, etc.) are
-- excluded so multiple successful payments per month are still allowed.
--
-- Solves TOCTOU race: two concurrent initiate-payment requests could
-- both pass the application-level check and insert, but this constraint
-- ensures only one survives.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_active_per_month
  ON payments(tenancy_id, payment_month)
  WHERE status IN ('initiated', 'processing');
