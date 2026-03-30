-- Add UPI VPA support to bank_accounts table
-- Allows landlord bank accounts to be verified via UPI Penny Drop (Cashfree)
-- UPI flow verifies landlord name but uses VPA for payouts (no bank details needed)

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS upi_vpa TEXT,
  ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'bank_penny_drop'
    CHECK (verification_method IN ('bank_penny_drop', 'upi_penny_drop'));

-- UPI-verified accounts don't have bank details — make these nullable
ALTER TABLE bank_accounts
  ALTER COLUMN account_number_encrypted DROP NOT NULL;
ALTER TABLE bank_accounts
  ALTER COLUMN account_number_masked DROP NOT NULL;
ALTER TABLE bank_accounts
  ALTER COLUMN ifsc_code DROP NOT NULL;

COMMENT ON COLUMN bank_accounts.upi_vpa IS 'UPI VPA used for penny drop verification and payouts (when verification_method=upi_penny_drop)';
COMMENT ON COLUMN bank_accounts.verification_method IS 'How the landlord was verified: bank_penny_drop (bank details) or upi_penny_drop (UPI VPA)';
