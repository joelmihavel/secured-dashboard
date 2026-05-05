-- One-shot backfill: revert users whose user_status='waitlisted' but whose
-- latest extraction is missing_stamp_paper / invalid_document / expired
-- back to user_status='signed_up'. This brings the existing data in line
-- with the new invariant introduced in the bundle:
--
--   "user_status='waitlisted' implies the latest extraction is usable
--    (NOT in {missing_stamp_paper, invalid_document, expired})"
--
-- After the bundle ships, the journey router will route these users to
-- /(agreement)/upload directly via the new routeOnInvalidExtraction()
-- helper — no flash on the bank screen, no waitlist screen detour. They
-- come back, re-upload with the stamp paper, and proceed cleanly.
--
-- Predicate matches the gate that was added to ensureWaitlistState so
-- this is the symmetric "fix existing rows that broke the new gate".
-- audit_logs trail their prior status via the existing user_status_audit
-- trigger.

BEGIN;

WITH targets AS (
  SELECT u.id
  FROM public.users u
  JOIN public.extracted_rental_info eri ON eri.user_id = u.id
  WHERE u.user_status = 'waitlisted'
    AND eri.id = (
      SELECT id FROM public.extracted_rental_info
      WHERE user_id = u.id
      ORDER BY created_at DESC
      LIMIT 1
    )
    AND eri.contract_status IN ('missing_stamp_paper', 'invalid_document', 'expired')
)
UPDATE public.users
  SET user_status = 'signed_up',
      status_updated_at = NOW()
  WHERE id IN (SELECT id FROM targets);

DO $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM public.users u
  JOIN public.extracted_rental_info eri ON eri.user_id = u.id
  WHERE u.user_status = 'waitlisted'
    AND eri.id = (
      SELECT id FROM public.extracted_rental_info
      WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
    )
    AND eri.contract_status IN ('missing_stamp_paper', 'invalid_document', 'expired');
  RAISE NOTICE 'Backfill complete. Remaining waitlisted-with-invalid-extraction: %', v_remaining;
END $$;

COMMIT;
