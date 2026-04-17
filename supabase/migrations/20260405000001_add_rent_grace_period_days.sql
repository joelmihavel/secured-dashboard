-- Flent Secured v2 - Migration: Add rent_grace_period_days to extracted_rental_info
--
-- Many Indian rental agreements specify a grace period (e.g., "rent due on 1st,
-- grace period up to 5th"). This was previously not extracted, causing
-- cashback_cutoff_day on tenancies to be set equal to rent_due_day —
-- penalizing tenants who pay within the contractual grace window.
--
-- This column stores the extracted grace period so that cashback_cutoff_day
-- can be set to rent_due_day + grace_period_days (capped at 28).

ALTER TABLE extracted_rental_info
  ADD COLUMN IF NOT EXISTS rent_grace_period_days INTEGER
    CHECK (rent_grace_period_days IS NULL OR (rent_grace_period_days >= 0 AND rent_grace_period_days <= 28));

COMMENT ON COLUMN extracted_rental_info.rent_grace_period_days IS
  'Grace period in days after rent_due_day within which payment is still considered on-time per the agreement. Extracted from agreement text.';
