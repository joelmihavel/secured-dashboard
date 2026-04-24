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

-- Step 1: clean up existing orphans
DELETE FROM public.waitlist_entries w
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = w.user_id
);

-- Step 2: add FK with cascade
ALTER TABLE public.waitlist_entries
  ADD CONSTRAINT waitlist_entries_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE CASCADE;
