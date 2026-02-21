-- Add bank name match columns to utility_verifications
-- Enables 3-way name verification: agreement landlord <> bill consumer <> bank account holder

ALTER TABLE utility_verifications
  ADD COLUMN IF NOT EXISTS bank_name_match_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS bank_name_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS match_details JSONB;
