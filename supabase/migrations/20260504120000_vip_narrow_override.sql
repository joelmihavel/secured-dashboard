-- PR-1 (course-corrected): replace claim_invite_code RPC.
--
-- Goals:
--   1. Move the extraction-readiness check INSIDE the RPC as defense in
--      depth. The edge function already gates this, but a future code path
--      (deep link, admin tool, integration test) could call the RPC directly,
--      and the invariant must hold there too. Returns EXTRACTION_NOT_READY
--      if the latest extracted_rental_info row for the user is not
--      'completed' (or there is no row at all).
--   2. Read PAN verification from bank_accounts.pan_verified, NOT from
--      users.pan_verified. The users column exists but is essentially
--      never set in production — the actual PAN-verified flag lives on
--      the landlord bank account row. Combine bank + PAN into a single
--      check against bank_accounts (party_type='landlord') and branch on
--      which gate failed for the right error code.
--   3. Narrow VIP override per refined design: VIP cleanly bypasses the
--      admin-queue + extraction-quality gates (manual_review, missing
--      stamp paper, invalid_document, etc.), but does NOT bypass
--      bank/PAN verification — those are absolute compliance requirements.
--
-- The function returns the same TABLE shape (success, error_code,
-- error_message, auto_approved) and remains SECURITY DEFINER /
-- LANGUAGE plpgsql.
--
-- Existing-claim ordering note: ALREADY_CLAIMED still runs first, before
-- the extraction/bank/PAN checks. A user who already burned their one
-- code shouldn't re-trigger compliance churn — they get the idempotent
-- "you already used a code" message regardless of current bank/PAN state.

-- @safe-destructive: replacing claim_invite_code RPC with narrowed VIP
-- override + corrected PAN/BANK source-of-truth (bank_accounts, not
-- users.pan_verified). Same TABLE return shape — no caller break.
DROP FUNCTION IF EXISTS public.claim_invite_code(uuid, text);

CREATE FUNCTION public.claim_invite_code(p_user_id uuid, p_code text)
RETURNS TABLE(
  success boolean,
  error_code text,
  error_message text,
  auto_approved boolean
)
-- @security-definer: must update users.user_status + waitlist_entries.admin_review and read bank_accounts/extracted_rental_info across user boundaries during the atomic invite-code claim. Caller is the claim-invite-code edge function which has already authenticated the user.
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
  v_extraction_status TEXT;
  v_has_verified_bank BOOLEAN;
  v_has_verified_pan BOOLEAN;
BEGIN
  -- ============================================================
  -- 1. ALREADY_CLAIMED — idempotent guard
  -- ============================================================
  -- A user can only claim one invite code, ever.
  SELECT invite_code_id INTO v_existing_code
  FROM public.waitlist_entries
  WHERE user_id = p_user_id AND invite_code_id IS NOT NULL;

  IF v_existing_code IS NOT NULL THEN
    success := false; error_code := 'ALREADY_CLAIMED';
    error_message := 'You have already used an invite code';
    auto_approved := false;
    RETURN NEXT; RETURN;
  END IF;

  -- ============================================================
  -- 2. EXTRACTION_NOT_READY — defense in depth
  -- ============================================================
  -- The edge function already gates this, but mirror the check in the RPC
  -- so deep links / admin tools / direct RPC callers can't bypass it.
  -- Only fires when the latest extraction is anything other than
  -- 'completed' (pending, processing, failed, extraction_failed).
  -- contract_status (manual_review / missing_stamp_paper / invalid_document /
  -- expired) is INTENTIONALLY not blocked here — VIP overrides those by
  -- design, and non-VIP claims of those rows are handled by the
  -- use_count/admin_review queue.
  SELECT extraction_status INTO v_extraction_status
  FROM public.extracted_rental_info
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_extraction_status IS NULL OR v_extraction_status <> 'completed' THEN
    success := false;
    error_code := 'EXTRACTION_NOT_READY';
    error_message := 'Your agreement is still being scanned. Please wait a moment and try again.';
    auto_approved := false;
    RETURN NEXT; RETURN;
  END IF;

  -- ============================================================
  -- 3. BANK_NOT_VERIFIED + PAN_NOT_VERIFIED — combined check
  -- ============================================================
  -- Source of truth is bank_accounts (party_type='landlord'), NOT users.
  -- We split the EXISTS into two boolean reads so we can return a
  -- specific error code for whichever gate the user is currently failing.
  -- VIP CANNOT bypass either of these — bank+PAN are absolute compliance
  -- requirements, regardless of code type.
  SELECT EXISTS (
    SELECT 1 FROM public.bank_accounts
    WHERE user_id = p_user_id
      AND party_type = 'landlord'
      AND verified = true
  ) INTO v_has_verified_bank;

  IF NOT v_has_verified_bank THEN
    success := false;
    error_code := 'BANK_NOT_VERIFIED';
    error_message := 'Please verify your landlord''s bank details first.';
    auto_approved := false;
    RETURN NEXT; RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bank_accounts
    WHERE user_id = p_user_id
      AND party_type = 'landlord'
      AND verified = true
      AND pan_verified = true
  ) INTO v_has_verified_pan;

  IF NOT v_has_verified_pan THEN
    success := false;
    error_code := 'PAN_NOT_VERIFIED';
    error_message := 'Please verify your PAN first.';
    auto_approved := false;
    RETURN NEXT; RETURN;
  END IF;

  -- ============================================================
  -- 4. ATOMIC CODE LOCK + READ
  -- ============================================================
  SELECT ic.id, ic.status, ic.max_uses, ic.use_count, ic.is_vip
    INTO v_code_id, v_code_status, v_max_uses, v_use_count, v_is_vip
  FROM public.invite_codes ic
  WHERE ic.code = upper(p_code)
  FOR UPDATE SKIP LOCKED;

  IF v_code_id IS NULL THEN
    success := false; error_code := 'INVALID_CODE';
    error_message := 'This invite code is not valid';
    auto_approved := false;
    RETURN NEXT; RETURN;
  END IF;

  IF v_code_status = 'revoked' THEN
    success := false; error_code := 'CODE_REVOKED';
    error_message := 'This invite code is no longer valid';
    auto_approved := false;
    RETURN NEXT; RETURN;
  END IF;

  IF v_use_count >= v_max_uses THEN
    success := false; error_code := 'ALREADY_USED';
    error_message := 'This invite code has already been used';
    auto_approved := false;
    RETURN NEXT; RETURN;
  END IF;

  -- ============================================================
  -- 5. CONSUME CODE + LINK TO WAITLIST
  -- ============================================================
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

  -- ============================================================
  -- 6. VIP PROMOTION (narrowed)
  -- ============================================================
  -- VIP cleanly overrides the admin-review queue and extraction quality
  -- (manual_review, missing_stamp_paper, etc.), but at this point we have
  -- already verified bank+PAN above, so check_and_advance_to_active will
  -- succeed and flip the user straight to 'active'.
  -- The NOT IN guard on user_status preserves terminal states (already
  -- approved/active or not_eligible) — we don't backflip a user who's
  -- past this point.
  IF v_is_vip THEN
    UPDATE public.waitlist_entries
    SET admin_review = 'approved'
    WHERE user_id = p_user_id;

    UPDATE public.users
    SET user_status = 'approved',
        status_updated_at = NOW()
    WHERE id = p_user_id
      AND user_status NOT IN ('approved', 'active', 'not_eligible');

    PERFORM public.check_and_advance_to_active(p_user_id);

    auto_approved := true;
  END IF;

  success := true; error_code := NULL; error_message := NULL;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.claim_invite_code(uuid, text) IS
  'Atomically consumes invite code. Order: ALREADY_CLAIMED, '
  'EXTRACTION_NOT_READY (defense in depth, mirrors edge-function gate), '
  'BANK_NOT_VERIFIED + PAN_NOT_VERIFIED (read from bank_accounts where '
  'party_type=landlord — VIP cannot bypass), code lock + validation, '
  'consumption, VIP promotion. VIP overrides admin queue + extraction '
  'quality but NOT bank/PAN compliance.';

-- rollback:
--   DROP FUNCTION IF EXISTS public.claim_invite_code(uuid, text);
--   Then re-apply the prior body from migration
--   20260430230846_user_status_audit_and_atomic_claim.sql which
--   installed the previous claim_invite_code definition. That migration
--   is the source of truth for the pre-this-change behaviour
--   (consumption + VIP promotion without the narrowed extraction/bank/
--   PAN gates).
