-- Flent Secured v2 - Migration: Fix waitlist_entries FK constraint
-- Date: 2026-02-14
-- Description: The waitlist_entries table was pre-created with user_id FK pointing
--   to 'profiles' table (Supabase template artifact). This migration re-points it
--   to auth.users(id) which is the canonical user identity table.

-- Drop the existing FK constraint (points to profiles table)
ALTER TABLE waitlist_entries DROP CONSTRAINT IF EXISTS waitlist_entries_user_id_fkey;

-- Re-add FK pointing to auth.users
ALTER TABLE waitlist_entries
  ADD CONSTRAINT waitlist_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
