-- Flent Secured v2 - Migration: Create Bank Accounts Table
-- Stores verified bank account details for landlords (and optionally tenants)

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Party type: whose bank account is this?
  party_type TEXT NOT NULL CHECK (party_type IN ('tenant', 'landlord')),

  -- Bank account details
  account_holder_name TEXT NOT NULL,
  account_number_encrypted TEXT NOT NULL, -- Encrypted full account number
  account_number_masked TEXT NOT NULL, -- Last 4 digits for display (e.g., "XXXX1234")
  ifsc_code VARCHAR(11) NOT NULL,
  bank_name TEXT,
  branch_name TEXT,
  account_type TEXT DEFAULT 'savings' CHECK (account_type IN ('savings', 'current')),

  -- Verification via Cashfree Penny Drop
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  penny_drop_txn_id TEXT, -- Cashfree transaction ID
  penny_drop_reference_id TEXT, -- Cashfree reference ID
  penny_drop_status TEXT, -- SUCCESS, FAILED, PENDING
  penny_drop_name_match_score DECIMAL(5,2), -- Name matching percentage
  verified_account_holder_name TEXT, -- Name returned by bank
  verified_at TIMESTAMPTZ,

  -- Is this the primary/default account for the user?
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX idx_bank_accounts_verified ON bank_accounts(user_id, verified) WHERE verified = TRUE;
CREATE INDEX idx_bank_accounts_party_type ON bank_accounts(user_id, party_type);

-- Ensure only one primary account per user per party_type
CREATE UNIQUE INDEX idx_bank_accounts_primary
  ON bank_accounts(user_id, party_type)
  WHERE is_primary = TRUE;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_accounts_updated_at();

-- Function to ensure only one primary account
CREATE OR REPLACE FUNCTION ensure_single_primary_bank_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    UPDATE bank_accounts
    SET is_primary = FALSE
    WHERE user_id = NEW.user_id
      AND party_type = NEW.party_type
      AND id != NEW.id
      AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_primary_bank
  BEFORE INSERT OR UPDATE OF is_primary ON bank_accounts
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION ensure_single_primary_bank_account();

COMMENT ON TABLE bank_accounts IS 'Bank accounts for landlords (receiving rent) and tenants (refunds)';
COMMENT ON COLUMN bank_accounts.account_number_encrypted IS 'AES-256 encrypted account number';
COMMENT ON COLUMN bank_accounts.account_number_masked IS 'Display format: XXXX1234';
COMMENT ON COLUMN bank_accounts.penny_drop_name_match_score IS 'Percentage match between provided and bank-verified name';
