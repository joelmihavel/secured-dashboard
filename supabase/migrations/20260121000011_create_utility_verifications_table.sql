-- Flent Secured v2 - Migration: Create Utility Verifications Table
-- Stores electricity bill verification data for address verification

CREATE TABLE IF NOT EXISTS utility_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,

  -- Utility type and provider
  utility_type TEXT NOT NULL DEFAULT 'electricity'
    CHECK (utility_type IN ('electricity', 'gas', 'water')),
  operator_code TEXT NOT NULL, -- e.g., 'BESCOM', 'TPDDL', 'MSEDCL'
  operator_name TEXT, -- Human readable name

  -- Consumer details
  consumer_number TEXT NOT NULL,
  consumer_name TEXT, -- Name from bill

  -- Verification status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'not_found')),
  verification_reference TEXT, -- API Club reference

  -- Bill data (from API Club response)
  bill_amount_paise BIGINT,
  bill_due_date DATE,
  bill_period_from DATE,
  bill_period_to DATE,
  bill_address TEXT, -- Address from bill
  bill_data JSONB, -- Full bill response for reference

  -- Address matching
  address_match_score DECIMAL(5,2), -- Percentage match with tenancy address
  address_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_utility_verifications_user ON utility_verifications(user_id);
CREATE INDEX idx_utility_verifications_tenancy ON utility_verifications(tenancy_id) WHERE tenancy_id IS NOT NULL;
CREATE INDEX idx_utility_verifications_status ON utility_verifications(status);
CREATE INDEX idx_utility_verifications_consumer ON utility_verifications(consumer_number, operator_code);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_utility_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_utility_verifications_updated_at
  BEFORE UPDATE ON utility_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_utility_verifications_updated_at();

-- RLS Policies
ALTER TABLE utility_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY utility_verifications_user_select ON utility_verifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY utility_verifications_service_all ON utility_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Audit trigger
CREATE TRIGGER trigger_audit_utility_verifications
  AFTER INSERT OR UPDATE ON utility_verifications
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_changes();

COMMENT ON TABLE utility_verifications IS 'Electricity/utility bill verifications for address proof';
COMMENT ON COLUMN utility_verifications.address_match_score IS 'Fuzzy match percentage between bill address and tenancy address';
