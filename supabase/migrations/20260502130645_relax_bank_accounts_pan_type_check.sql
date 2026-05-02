-- Relax bank_accounts.pan_type check constraint
--
-- Background: the original constraint allowed only a fixed list of nine PAN
-- entity types (Individual, HUF, Company, Trust, AOP, BOI, Government, AJP,
-- LLP). verify-pan stores whatever string Cashfree returns (or whatever the
-- local determinePanType() helper produces). Cashfree variants like
-- "Hindu Undivided Family", "PartnershipFirm", "Person", and the local
-- "Firm" mapping for 4th-char F all fail this constraint, causing every
-- non-Individual landlord PAN to fail with a generic DB_ERROR. 130
-- successful PAN rows are all "Individual" — every other entity type was
-- silently blocked.
--
-- pan_type is metadata for display, not a security boundary. Drop the
-- value list, keep only a sanity length cap.

ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_pan_type_check;

ALTER TABLE bank_accounts
  ADD CONSTRAINT bank_accounts_pan_type_check
  CHECK (pan_type IS NULL OR length(pan_type) <= 50)
  NOT VALID;
