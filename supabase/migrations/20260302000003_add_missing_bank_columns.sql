-- Agreement name matching columns on bank_accounts
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS agreement_name_matched BOOLEAN,
  ADD COLUMN IF NOT EXISTS agreement_name_match_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS agreement_name_match_details JSONB;

-- PAN verification columns on bank_accounts
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS pan_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS pan_number_masked VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pan_type TEXT,
  ADD COLUMN IF NOT EXISTS pan_registered_name TEXT,
  ADD COLUMN IF NOT EXISTS pan_status TEXT,
  ADD COLUMN IF NOT EXISTS pan_name_match_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS pan_name_matched BOOLEAN,
  ADD COLUMN IF NOT EXISTS pan_verification_details JSONB,
  ADD COLUMN IF NOT EXISTS pan_verified_at TIMESTAMPTZ;

-- PAN verified flag on tenancies
ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT FALSE;
