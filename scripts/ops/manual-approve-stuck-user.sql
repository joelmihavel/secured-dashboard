-- One-shot manual approval for the 1 fully-verified user stuck in
-- admin queue with a manual_review extraction caused by a missing
-- stamp paper. Run AFTER PR-1 has been deployed (so future uploads
-- are routed through missing_stamp_paper recovery instead of
-- accumulating in the queue).
--
-- Predicate: user_status='waitlisted' AND latest extraction is
-- contract_status='manual_review' AND certificate_no IS NULL AND
-- a verified landlord bank with verified PAN exists.
--
-- Verify the count first:
--
--   WITH stuck AS (
--     SELECT u.id
--     FROM users u
--     JOIN extracted_rental_info eri ON eri.user_id = u.id
--     WHERE u.user_status = 'waitlisted'
--       AND eri.contract_status = 'manual_review'
--       AND eri.certificate_no IS NULL
--       AND eri.id = (SELECT id FROM extracted_rental_info
--                      WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1)
--       AND EXISTS (SELECT 1 FROM bank_accounts ba
--                    WHERE ba.user_id = u.id AND ba.party_type='landlord'
--                      AND ba.verified=true AND ba.pan_verified=true)
--   )
--   SELECT count(*) FROM stuck;
--
-- Expected: 1 (subject to drift).

BEGIN;

WITH stuck AS (
  SELECT u.id
  FROM public.users u
  JOIN public.extracted_rental_info eri ON eri.user_id = u.id
  WHERE u.user_status = 'waitlisted'
    AND eri.contract_status = 'manual_review'
    AND eri.certificate_no IS NULL
    AND eri.id = (
      SELECT id FROM public.extracted_rental_info
      WHERE user_id = u.id
      ORDER BY created_at DESC
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.user_id = u.id
        AND ba.party_type = 'landlord'
        AND ba.verified = true
        AND ba.pan_verified = true
    )
)
UPDATE public.waitlist_entries
  SET admin_review = 'approved'
  WHERE user_id IN (SELECT id FROM stuck);

WITH stuck AS (
  SELECT u.id
  FROM public.users u
  JOIN public.extracted_rental_info eri ON eri.user_id = u.id
  WHERE u.user_status = 'waitlisted'
    AND eri.contract_status = 'manual_review'
    AND eri.certificate_no IS NULL
    AND eri.id = (
      SELECT id FROM public.extracted_rental_info
      WHERE user_id = u.id
      ORDER BY created_at DESC
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.user_id = u.id
        AND ba.party_type = 'landlord'
        AND ba.verified = true
        AND ba.pan_verified = true
    )
)
UPDATE public.users
  SET user_status = 'approved',
      status_updated_at = NOW()
  WHERE id IN (SELECT id FROM stuck)
    AND user_status = 'waitlisted';

-- Auto-advance any newly-approved users to 'active' if their bank+PAN+landlord
-- approval invariants are met. This RPC is pre-existing; we just call it.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT u.id
    FROM public.users u
    WHERE u.status_updated_at > NOW() - INTERVAL '1 minute'
      AND u.user_status = 'approved'
  ) LOOP
    PERFORM public.check_and_advance_to_active(r.id);
  END LOOP;
END $$;

COMMIT;
