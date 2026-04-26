-- Fix: waitlist_entries.user_id has no foreign key constraint, so when a user
-- row is deleted the waitlist_entry survives as an orphan. Over time these
-- orphans accumulate and inflate get_onboarded_count() as well as showing
-- up as duplicate rows in v_user_funnel via users-JOIN paths.
--
-- This migration:
--   1. Deletes any existing orphan waitlist_entries (prerequisite for
--      constraint creation).
--   2. Adds a FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
--      matching the pattern already used on extracted_rental_info and
--      tenancies.
--
-- NOTE: dated 2026-04-25 because the original 20260424000001 slot collided
-- with create_stamp_verifications (applied to prod first via the admin-app
-- branch). The schema effects below are already present in production;
-- the steps are written idempotently so re-applying is a no-op.

-- Step 1: clean up existing orphans (idempotent — DELETE matches nothing once clean)
DELETE FROM public.waitlist_entries w
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = w.user_id
);

-- Step 2: add FK with cascade, only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waitlist_entries_user_id_fkey'
      AND conrelid = 'public.waitlist_entries'::regclass
  ) THEN
    ALTER TABLE public.waitlist_entries
      ADD CONSTRAINT waitlist_entries_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- rollback:
--   ALTER TABLE public.waitlist_entries DROP CONSTRAINT IF EXISTS waitlist_entries_user_id_fkey;
--   -- The DELETE of orphans in step 1 cannot be reversed; orphans were already
--   -- broken (their user_id pointed to a deleted user). No restorable state existed.
