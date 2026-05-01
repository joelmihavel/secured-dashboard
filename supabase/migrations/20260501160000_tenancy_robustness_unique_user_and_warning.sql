-- Tenancy robustness: enforce one open tenancy per user + warn on missing
-- tenancy when waitlist admin_review approval cascades.
--
-- Background:
--
-- The existing constraint UNIQUE (user_id, extracted_rental_info_id) doesn't
-- prevent the same user from owning multiple OPEN tenancies. Two failure modes:
--   1. extracted_rental_info_id is NULL on legacy/manually-created rows;
--      Postgres treats every NULL as distinct in a unique tuple.
--   2. Each re-upload generates a new extracted_rental_info row, so the
--      composite unique never trips even when stale rows weren't superseded.
-- Audit on dev DB found 3 users with 2/2/12 open tenancies; cleanup performed
-- separately before this migration.
--
-- Fix layer 1 — partial unique index gating user_id while a tenancy is open.
-- Closed states ('expired', 'terminated') are excluded so historical rows
-- don't conflict.
--
-- Fix layer 2 — sync_user_status_on_waitlist_change() previously executed
-- two cascaded UPDATEs (users + tenancies) but reported nothing if the
-- tenancy UPDATE matched zero rows (no tenancy yet). Add a RAISE WARNING
-- so orphan-approved users are visible in logs without breaking the cascade
-- (we don't RAISE EXCEPTION because legitimate flows can approve a user
-- before the tenancy lands; recovery cron heals these).
--
-- Idempotent: CREATE UNIQUE INDEX IF NOT EXISTS + CREATE OR REPLACE FUNCTION.

-- ============================================================
-- 1. Partial unique index — one open tenancy per user
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_open_tenancy
  ON public.tenancies (user_id)
  WHERE status IN ('pending_verification', 'active');

COMMENT ON INDEX public.unique_user_open_tenancy IS
  'One tenancy per user while in an open state (pending_verification | active). '
  'Closed states (expired, terminated) are excluded so a user can have a new '
  'tenancy after a prior one ends.';

-- ============================================================
-- 2. Add visibility warning to sync trigger function
-- ============================================================
-- This rewrites the body of sync_user_status_on_waitlist_change() to log a
-- warning when admin_review='approved' fires but no tenancy is present to
-- activate. Behavior otherwise unchanged from 20260308000003.

CREATE OR REPLACE FUNCTION public.sync_user_status_on_waitlist_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenancy_count integer;
BEGIN
  IF NEW.admin_review IS DISTINCT FROM OLD.admin_review THEN
    IF NEW.admin_review = 'approved' THEN
      UPDATE public.users
      SET user_status = 'approved',
          status_updated_at = NOW()
      WHERE id = NEW.user_id
        AND user_status NOT IN ('approved', 'active', 'not_eligible');

      -- Activate the user's open tenancy. The partial unique index added by
      -- 20260501160000 guarantees at most one matching row.
      UPDATE public.tenancies
      SET status = 'active',
          updated_at = NOW()
      WHERE user_id = NEW.user_id
        AND status = 'pending_verification';

      GET DIAGNOSTICS v_tenancy_count = ROW_COUNT;

      IF v_tenancy_count = 0 THEN
        -- Not fatal — extraction-recovery cron and finalizeExtractionForOnboarding
        -- both handle the late-tenancy case. But we want a log breadcrumb so
        -- silently-orphaned approvals don't go unnoticed.
        RAISE WARNING 'Waitlist approval for user % has no pending_verification tenancy to activate', NEW.user_id;
      END IF;

    ELSIF NEW.admin_review = 'rejected' THEN
      UPDATE public.users
      SET user_status = 'not_eligible',
          status_updated_at = NOW()
      WHERE id = NEW.user_id
        AND user_status NOT IN ('approved', 'active', 'not_eligible');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_user_status_on_waitlist_change() IS
  'Cascades waitlist_entries.admin_review changes to users.user_status and '
  'tenancies.status. RAISE WARNING (not EXCEPTION) on missing tenancy so '
  'orphan approvals are observable without breaking the cascade.';
