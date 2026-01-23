-- Flent Secured v2 - Migration: Add name matching columns to utility_verifications
-- Adds columns to track landlord name matching for ownership verification

-- Add name matching columns
ALTER TABLE utility_verifications
  ADD COLUMN IF NOT EXISTS name_match_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS name_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Update constraint for utility_type to only allow electricity
-- (water and gas are not used in current implementation)
ALTER TABLE utility_verifications
  DROP CONSTRAINT IF EXISTS utility_verifications_utility_type_check;

ALTER TABLE utility_verifications
  ADD CONSTRAINT utility_verifications_utility_type_check
  CHECK (utility_type = 'electricity');

-- Add comments
COMMENT ON COLUMN utility_verifications.name_match_score IS 'Fuzzy match percentage between bill consumer name and landlord name';
COMMENT ON COLUMN utility_verifications.name_verified IS 'Whether the consumer name matches the landlord name (above threshold)';
