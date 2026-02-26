-- Flent Secured v2 - Migration: Add cashback_cutoff_day to tenancies
--
-- The cashback_cutoff_day determines the last day of each month by which
-- a rent payment must be made to qualify for the 1% instant discount.
--
-- If NULL, the application defaults to 7 (7th of the month).
-- This value can be extracted from the rent agreement during document processing,
-- or manually set via confirm-extraction / update-extraction.

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS cashback_cutoff_day INTEGER
    CHECK (cashback_cutoff_day IS NULL OR (cashback_cutoff_day >= 1 AND cashback_cutoff_day <= 28));

COMMENT ON COLUMN tenancies.cashback_cutoff_day IS
  'Day of month by which rent must be paid to qualify for cashback. NULL defaults to 7. Extracted from rent agreement or set manually.';
