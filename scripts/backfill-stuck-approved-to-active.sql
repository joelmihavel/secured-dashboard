-- One-shot backfill: advance all currently-stuck 'approved' users to 'active'
-- where their tenancy already has bank_verified=true.
--
-- Why this exists:
--   admin-waitlist used to set user_status='approved' without calling the
--   check_and_advance_to_active RPC. In the new pre-waitlist add-bank flow
--   (released 2026-05-01), tenancies.bank_verified gets set BEFORE approval,
--   so the verify-bank-side RPC call no-oped. That left users sitting at
--   'approved' even though both gates (status=approved + bank_verified=true)
--   were satisfied.
--
--   admin-waitlist now calls the RPC inline (PR2), so this backfill only
--   needs to run once to clear the existing stuck cohort.
--
-- Run after deploying the updated admin-waitlist edge function.
-- Idempotent: the RPC is a no-op if either gate is unsatisfied.

DO $$
DECLARE
  stuck_user RECORD;
  promoted_count INTEGER := 0;
BEGIN
  FOR stuck_user IN
    SELECT u.id, u.full_name, u.phone
    FROM public.users u
    WHERE u.user_status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.tenancies t
        WHERE t.user_id = u.id AND t.bank_verified = true
      )
  LOOP
    PERFORM public.check_and_advance_to_active(stuck_user.id);
    promoted_count := promoted_count + 1;
    RAISE NOTICE 'Advanced user % (% / %) to active', stuck_user.id, stuck_user.full_name, stuck_user.phone;
  END LOOP;

  RAISE NOTICE 'Backfill complete. Attempted % users.', promoted_count;
END $$;

-- Verify result
SELECT user_status, COUNT(*)
FROM public.users
WHERE user_status IN ('approved', 'active')
GROUP BY user_status
ORDER BY user_status;
