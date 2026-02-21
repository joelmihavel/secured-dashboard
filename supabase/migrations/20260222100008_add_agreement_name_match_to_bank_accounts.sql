-- Add agreement landlord name matching columns to bank_accounts
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS agreement_name_matched BOOLEAN,
  ADD COLUMN IF NOT EXISTS agreement_name_match_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS agreement_name_match_details JSONB;

COMMENT ON COLUMN bank_accounts.agreement_name_matched IS 'Whether Cashfree name_at_bank matched a landlord name from the rental agreement';
COMMENT ON COLUMN bank_accounts.agreement_name_match_score IS 'Best match confidence score (0-100) across all agreement landlord names';
COMMENT ON COLUMN bank_accounts.agreement_name_match_details IS 'Gemini AI match reasoning, which landlord matched, all candidates';
