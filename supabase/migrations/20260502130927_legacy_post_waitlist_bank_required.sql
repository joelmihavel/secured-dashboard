-- TEMP: legacy_post_waitlist_bank_required
--
-- Surgical fix for the cohort of approved users who never collected landlord
-- bank details, because the 2026-05-01 release moved add-bank-details from
-- post-waitlist to pre-waitlist. Approved users from before that release
-- have user_status='approved' but no verified landlord bank_accounts row,
-- and the journey router (rn-app/app/index.tsx) sends them straight to the
-- dashboard where pay-rent silently fails at settlement (BANK_NOT_VERIFIED).
--
-- This column flags the affected cohort so the OTA'd client can route them
-- back to /(agreement)/add-bank-details on cold start. Once they verify a
-- landlord bank, verify-bank's existing call to check_and_advance_to_active
-- promotes their user_status to 'active', and the approved-branch routing
-- (the only branch that reads this flag) never fires for them again.
--
-- REMOVAL: when
--   SELECT count(*) FROM users WHERE legacy_post_waitlist_bank_required = true
-- reaches 0, the column and the client check are dead code. See
-- docs/legacy-post-waitlist-bank-fix.md for the removal checklist.

ALTER TABLE public.users
  ADD COLUMN legacy_post_waitlist_bank_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.legacy_post_waitlist_bank_required IS
  'TEMP — flags pre-2026-05-01 approved users who never collected landlord bank details. '
  'Read by rn-app journey router to route to /(agreement)/add-bank-details on cold start. '
  'Drop when count reaches 0; see docs/legacy-post-waitlist-bank-fix.md.';

-- Backfill the cohort. Computed as: approved tenants (or null-role) with no
-- verified landlord bank, excluding test users and approved landlords.
-- Snapshot taken at migration time; new approvals will not get this flag
-- because PR2's admin-waitlist change auto-advances new-flow users to 'active'
-- when their tenancy.bank_verified is already true.
UPDATE public.users
SET legacy_post_waitlist_bank_required = true
WHERE user_status = 'approved'
  AND COALESCE(role::text, 'tenant') <> 'landlord'
  AND COALESCE(is_test_user, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.user_id = public.users.id
      AND ba.party_type = 'landlord'
      AND ba.verified = true
  );
