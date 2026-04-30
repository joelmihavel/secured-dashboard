-- Audit fixes for the VIP-claim / approval flow.
--
-- 1. Drop the legacy waitlist_entries.status column. It hasn't been written
--    to since 20260214000004's one-shot backfill — every approved user on
--    the DB is desynced (admin_review='approved' but status='pending_review').
--    Verified zero readers in supabase/functions, rn-app/src, admin-app, and
--    the materialized views (v_risk_detail, v_user_funnel select admin_review,
--    not status).
--
-- 2. The waitlist_entries_update_own RLS policy was the one production reader
--    of `status`, gating UPDATE on `status='pending_review'`. Because status
--    never moved off that default, the gate was effectively always-true —
--    approved users could mutate their own waitlist row. Replace with a gate
--    on admin_review.
--
-- 3. Add an audit trigger on users.user_status. Today every promotion
--    (signed_up → waitlisted → approved → active) is invisible in audit_logs:
--    the existing triggers (sync_user_status_on_waitlist_change,
--    check_and_advance_to_active) update users.user_status without writing
--    audit rows, so we have no forensic trail for "how/when did this user
--    get promoted?"
--
-- 4. Fold VIP promotion + advance-to-active into the claim_invite_code RPC.
--    Currently the edge function claim-invite-code/index.ts does two
--    separate UPDATEs after the RPC call (waitlist_entries, then users) —
--    not transactional. If the network or function dies between the RPC and
--    the UPDATEs, the code is consumed but the user isn't promoted, leaving
--    them un-promotable (idempotency check on the next attempt sees a code
--    already claimed). Folding all the writes into the RPC eliminates this
--    window.
--
-- 5. Same RPC change closes the "bank verified before VIP code" race: if a
--    user verified their bank BEFORE entering the code, check_and_advance_
--    to_active was never re-fired and the user got stuck on user_status=
--    'approved' indefinitely. Frontend's decideApprovedTarget masked it by
--    routing to /(main) anyway, but user_status stayed inconsistent and
--    invisible to any cohort/RLS gate that branches on 'active'. The new
--    RPC explicitly calls check_and_advance_to_active after VIP promotion.

BEGIN;

-- ============================================================================
-- 1 + 2.  Drop legacy `status` column and fix the broken RLS policy
-- ============================================================================

-- Drop the policy first so the column drop succeeds (the policy depends on it).
DROP POLICY IF EXISTS waitlist_entries_update_own ON public.waitlist_entries;

ALTER TABLE public.waitlist_entries DROP COLUMN IF EXISTS status;

-- Recreate the policy on the column that actually tracks approval state.
-- A user can update their own waitlist row only while admin_review is in a
-- non-terminal state (NULL / 'due' / 'in_progress'). Once admin_review is
-- 'approved' or 'rejected', the row becomes read-only to the user.
CREATE POLICY waitlist_entries_update_own
  ON public.waitlist_entries
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND admin_review IS DISTINCT FROM 'approved'
    AND admin_review IS DISTINCT FROM 'rejected'
  );

COMMENT ON POLICY waitlist_entries_update_own ON public.waitlist_entries IS
  'Authenticated users may UPDATE their own waitlist row only while '
  'admin_review is non-terminal. Replaces the prior policy that gated on '
  'the legacy `status` column (always pending_review → effectively a no-op '
  'gate that let approved users mutate their own row).';

-- ============================================================================
-- 3.  Audit trigger for user_status changes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_user_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_status IS DISTINCT FROM OLD.user_status THEN
    INSERT INTO public.audit_logs (
      user_id, actor_type, action, action_category,
      entity_type, entity_id,
      old_values, new_values,
      status
    ) VALUES (
      NEW.id, 'system', 'USER_STATUS_CHANGED', 'verification',
      'user', NEW.id::text,
      jsonb_build_object('user_status', OLD.user_status),
      jsonb_build_object('user_status', NEW.user_status),
      'success'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_status_change ON public.users;
CREATE TRIGGER trg_audit_user_status_change
  AFTER UPDATE OF user_status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_user_status_change();

COMMENT ON FUNCTION public.audit_user_status_change() IS
  'Writes one audit_logs row for every user_status change. Triggered '
  'AFTER UPDATE OF user_status only, so unrelated column updates never '
  'fire the audit insert. The IS DISTINCT FROM guard skips no-op writes '
  '(e.g. UPDATE that sets the same value).';

-- ============================================================================
-- 4 + 5.  Atomic claim_invite_code: consume + VIP promote + advance-to-active
-- ============================================================================

-- Drop and recreate because the return type is changing (added auto_approved).
DROP FUNCTION IF EXISTS public.claim_invite_code(uuid, text);

CREATE FUNCTION public.claim_invite_code(p_user_id uuid, p_code text)
RETURNS TABLE(
  success boolean,
  error_code text,
  error_message text,
  auto_approved boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_code_id UUID;
  v_code_status TEXT;
  v_max_uses INTEGER;
  v_use_count INTEGER;
  v_existing_code UUID;
  v_is_vip BOOLEAN;
BEGIN
  -- Idempotency: a user can only claim one invite code, ever.
  SELECT invite_code_id INTO v_existing_code
  FROM public.waitlist_entries
  WHERE user_id = p_user_id AND invite_code_id IS NOT NULL;

  IF v_existing_code IS NOT NULL THEN
    success := false;
    error_code := 'ALREADY_CLAIMED';
    error_message := 'You have already used an invite code';
    auto_approved := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Atomic lock + read of the code row. SKIP LOCKED prevents two concurrent
  -- claims racing on the same code from blocking each other; the second one
  -- sees v_code_id = NULL and bounces with INVALID_CODE.
  SELECT ic.id, ic.status, ic.max_uses, ic.use_count, ic.is_vip
    INTO v_code_id, v_code_status, v_max_uses, v_use_count, v_is_vip
  FROM public.invite_codes ic
  WHERE ic.code = upper(p_code)
  FOR UPDATE SKIP LOCKED;

  IF v_code_id IS NULL THEN
    success := false;
    error_code := 'INVALID_CODE';
    error_message := 'This invite code is not valid';
    auto_approved := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_code_status = 'revoked' THEN
    success := false;
    error_code := 'CODE_REVOKED';
    error_message := 'This invite code is no longer valid';
    auto_approved := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_use_count >= v_max_uses THEN
    success := false;
    error_code := 'ALREADY_USED';
    error_message := 'This invite code has already been used';
    auto_approved := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Consume the code (existing logic).
  UPDATE public.invite_codes
  SET use_count = use_count + 1,
      used_by   = p_user_id,
      used_at   = now(),
      status    = CASE WHEN use_count + 1 >= max_uses THEN 'used' ELSE status END
  WHERE id = v_code_id;

  UPDATE public.waitlist_entries
  SET invite_code_id = v_code_id
  WHERE user_id = p_user_id;

  auto_approved := false;

  -- VIP promotion (NEW: was previously two non-atomic UPDATEs in the edge
  -- function). All of the following happen inside the same transaction as
  -- the consumption above, so we can never end up with a code consumed but
  -- the user not promoted.
  IF v_is_vip THEN
    UPDATE public.waitlist_entries
    SET admin_review = 'approved'
    WHERE user_id = p_user_id;

    -- Belt-and-braces: the sync_user_status_on_waitlist_change trigger
    -- already sets users.user_status='approved' off the line above, but we
    -- set it explicitly so this RPC doesn't depend on the trigger being
    -- present. Idempotent — won't downgrade a terminal status.
    UPDATE public.users
    SET user_status = 'approved',
        status_updated_at = NOW()
    WHERE id = p_user_id
      AND user_status NOT IN ('approved', 'active', 'not_eligible');

    -- Closes the "bank verified before code claim" gap: if the user already
    -- has bank_verified=true, this advances them to 'active' immediately.
    -- If not, it's a no-op (gates on user_status='approved' AND
    -- bank_verified=true). The next bank-verification will hit the same
    -- function from the bank flow and pick them up.
    PERFORM public.check_and_advance_to_active(p_user_id);

    auto_approved := true;
  END IF;

  success := true;
  error_code := NULL;
  error_message := NULL;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.claim_invite_code(uuid, text) IS
  'Atomically consumes an invite code; for is_vip codes also promotes the '
  'user to approved and advances to active when bank is already verified. '
  'The auto_approved column in the result row tells the edge function '
  'whether to surface the "you''re in" copy to the client. Edge function '
  'should NOT do additional UPDATEs to waitlist_entries/users — this RPC '
  'is the single source of truth for VIP promotion.';

COMMIT;
