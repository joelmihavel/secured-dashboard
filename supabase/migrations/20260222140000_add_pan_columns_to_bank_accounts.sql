-- Add PAN card verification columns to bank_accounts table
-- Used by the verify-pan edge function to store PAN verification results

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS pan_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS pan_number_masked VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pan_type TEXT CHECK (pan_type IN ('Individual', 'HUF', 'Company', 'Trust', 'AOP', 'BOI', 'Government', 'AJP', 'LLP')),
  ADD COLUMN IF NOT EXISTS pan_registered_name TEXT,
  ADD COLUMN IF NOT EXISTS pan_status TEXT,
  ADD COLUMN IF NOT EXISTS pan_name_match_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS pan_name_matched BOOLEAN,
  ADD COLUMN IF NOT EXISTS pan_verification_details JSONB,
  ADD COLUMN IF NOT EXISTS pan_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN bank_accounts.pan_number_encrypted IS 'AES-256 encrypted PAN number';
COMMENT ON COLUMN bank_accounts.pan_number_masked IS 'Display format: ABXXXXXX CD';
COMMENT ON COLUMN bank_accounts.pan_type IS 'PAN type from Cashfree: Individual, HUF, Company, etc.';
COMMENT ON COLUMN bank_accounts.pan_registered_name IS 'Name registered with PAN from Cashfree';
COMMENT ON COLUMN bank_accounts.pan_name_matched IS 'Whether PAN name matched a landlord in agreement';

-- Add pan_verified to tenancies for tracking
ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT FALSE;

-- Add PAN verification audit actions
COMMENT ON TABLE bank_accounts IS 'Bank accounts with optional PAN verification. PAN columns added 2026-02-22.';
