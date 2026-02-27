-- Add maintenance_paise to tenancies table
-- Copied from extracted_rental_info during confirm-extraction flow
-- Defaults to 0 (no maintenance charge)

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS maintenance_paise BIGINT NOT NULL DEFAULT 0
    CHECK (maintenance_paise >= 0);

COMMENT ON COLUMN tenancies.maintenance_paise IS 'Monthly maintenance charge in paise (1 INR = 100 paise), 0 if none';
