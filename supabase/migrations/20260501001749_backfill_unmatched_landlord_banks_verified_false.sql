-- Backfill: flip verified=false for landlord bank rows whose agreement-name
-- match returned no_match (or went through the now-removed "skipped"
-- bypass). Pre-fix the deferred-match path updated agreement_name_matched
-- but kept verified=true, letting users walk past /(waitlist) without a
-- real match. New product rule: bank.verified must equal name-match
-- success. Tenancies' bank_verified follows the same rule.
--
-- Scoped to user_id that exists in public.users to avoid the audit_table_
-- changes trigger tripping on orphan bank rows whose user was deleted.
--
-- Companion to the verify-bank / verify-upi-vpa edge-function changes that
-- refuse with AGREEMENT_NOT_PROCESSED when no landlord names are
-- available, and to runDeferredBankNameMatching's update to flip
-- verified=false on no_match.

BEGIN;

-- 1. bank_accounts: verified=true with confirmed name mismatch.
UPDATE public.bank_accounts ba
SET
  verified = false,
  verified_at = NULL,
  updated_at = NOW()
WHERE ba.party_type = 'landlord'
  AND ba.verified = true
  AND ba.agreement_name_matched = false
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = ba.user_id);

-- 2. bank_accounts: verified=true via the removed "skipped" bypass (no real
--    match ran). Treat as unverified going forward.
UPDATE public.bank_accounts ba
SET
  verified = false,
  verified_at = NULL,
  agreement_name_matched = false,
  updated_at = NOW()
WHERE ba.party_type = 'landlord'
  AND ba.verified = true
  AND (ba.agreement_name_match_details->>'skipped')::text = 'true'
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = ba.user_id);

-- 3. tenancies: reset bank_verified for tenancies whose user no longer has
--    a verified+matched landlord bank.
UPDATE public.tenancies t
SET
  bank_verified = false,
  updated_at = NOW()
WHERE t.bank_verified = true
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = t.user_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.user_id = t.user_id
      AND ba.party_type = 'landlord'
      AND ba.verified = true
      AND ba.agreement_name_matched = true
  );

COMMIT;
