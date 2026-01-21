-- Flent Secured v2 - Migration: Create Identity Verifications Table
-- Stores Cashfree Mobile 360 verification data

CREATE TABLE IF NOT EXISTS identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,

  -- Verification metadata from Cashfree
  verification_id TEXT NOT NULL, -- Cashfree verification_id
  reference_id TEXT, -- Cashfree reference_id (our correlation ID)
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'DETAILS_NOT_FOUND', 'PENDING', 'FAILED')),
  verified_at TIMESTAMPTZ,

  -- Personal details (from Mobile 360)
  m360_full_name TEXT,
  m360_gender TEXT,
  m360_date_of_birth DATE,
  m360_age INTEGER,
  m360_occupation TEXT,
  m360_total_income TEXT, -- String as API returns ranges like "5-10 Lakhs"
  m360_relatives JSONB, -- Array: [{name, relation}]

  -- Contact info
  m360_phone_numbers JSONB, -- Array: [{number, type, source}]
  m360_emails JSONB, -- Array: [{email, source}]

  -- Identity documents (masked/partial for security)
  m360_pan_details JSONB, -- [{pan (masked), name, type, aadhaar_linked}]
  m360_aadhaar_masked TEXT, -- Last 4 digits only: XXXX XXXX 1234
  m360_passport_details JSONB,
  m360_driving_license_details JSONB,
  m360_voter_details JSONB,
  m360_ration_card_details JSONB,

  -- Financial data
  m360_bank_accounts JSONB, -- [{account_masked, ifsc, bank_name}]
  m360_employment_details JSONB, -- UAN, EPFO, establishment details

  -- Addresses
  m360_addresses JSONB, -- [{address, city, state, pincode, type, source}]

  -- Intelligence scores (key for risk assessment)
  m360_credit_score INTEGER,
  m360_mobile_intelligence JSONB, -- {valid, subscriber_status, connection_type, provider, connection_date}
  m360_risk_intelligence JSONB, -- {safe, risk_level, reason, description}

  -- Social presence
  m360_social_profiles JSONB, -- [{platform, url, username}]

  -- Raw response for audit (encrypted in production)
  raw_response JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for quick lookups
CREATE INDEX idx_identity_verifications_user ON identity_verifications(user_id);
CREATE INDEX idx_identity_verifications_tenancy ON identity_verifications(tenancy_id) WHERE tenancy_id IS NOT NULL;
CREATE INDEX idx_identity_verifications_verification_id ON identity_verifications(verification_id);
CREATE INDEX idx_identity_verifications_status ON identity_verifications(status);
CREATE INDEX idx_identity_verifications_created ON identity_verifications(created_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_identity_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_identity_verifications_updated_at
  BEFORE UPDATE ON identity_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_identity_verifications_updated_at();

COMMENT ON TABLE identity_verifications IS 'Cashfree Mobile 360 verification results for KYC';
COMMENT ON COLUMN identity_verifications.m360_credit_score IS 'Credit score from Mobile 360 (300-900 range)';
COMMENT ON COLUMN identity_verifications.m360_risk_intelligence IS 'Risk assessment: safe flag, level, reason, description';
COMMENT ON COLUMN identity_verifications.raw_response IS 'Full API response for audit (should be encrypted at rest)';
