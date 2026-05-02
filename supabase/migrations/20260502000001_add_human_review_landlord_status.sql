-- Adds 'human_review' as a fifth value to landlord_status, for tenancies
-- where 2 of 3 verification gates (M360, bank-name-match, SHCIL e-stamp)
-- pass but the third is missing or ambiguous. An admin must look at these
-- and either promote to 'verified' or reject.
--
-- Old values: none, invited, otp_confirmed, verified, declined
-- New value:  human_review (added between verified and declined semantically)
--
-- Metadata-only ALTER — brief ACCESS EXCLUSIVE on tenancies, no row scan.

ALTER TABLE public.tenancies
  DROP CONSTRAINT IF EXISTS tenancies_landlord_status_check;

ALTER TABLE public.tenancies
  ADD CONSTRAINT tenancies_landlord_status_check
  CHECK (landlord_status IN (
    'none',
    'invited',
    'otp_confirmed',
    'verified',
    'human_review',
    'declined'
  ));

COMMENT ON COLUMN public.tenancies.landlord_status IS
  'Landlord verification state: none (pre-invite) | invited (OTP sent, not confirmed) | otp_confirmed (OTP done, M360 pending) | verified (all 3 gates: M360, bank, SHCIL) | human_review (2 of 3 gates pass; admin must approve) | declined (landlord rejected)';
