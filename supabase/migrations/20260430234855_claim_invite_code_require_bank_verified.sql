-- Backend gate: claim_invite_code refuses to consume a code if the user
-- hasn't verified a landlord bank account yet. Closes the slip path where
-- a deep link or push-notification tap could land an unverified-bank user
-- on /(waitlist), let them claim a VIP code, and walk away as
-- user_status='approved' without ever passing the name-match check.
--
-- Observed in dev with user d4e9652a-... (phone +91 6362877970): they
-- reached /(waitlist) via the BackButton silent escape, claimed VIP, ended
-- up 'approved' despite their bank attempt having NAME_MISMATCH'd against
-- the agreement landlord.
--
-- Intended flow (per product):
--   signup → upload agreement → bank verify (name-match) → /(waitlist)
--   → claim VIP → 'approved' → check_and_advance_to_active → 'active'
--
-- The frontend already gates this via bankDetailsAreSettled, but a
-- DB-level check makes the property hold even if a future code path
-- regresses or a deep link bypasses the screen guard.

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
  v_bank_verified BOOLEAN;
BEGIN
  -- Idempotency: a user can only claim one invite code, ever.
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
  -- BANK-VERIFIED GATE (added in this migration)
  -- ============================================================
  -- Refuse the claim if the user doesn't have a verified landlord
  -- bank_accounts row. Mirrors userHasLandlordBankRow on the client
  -- (verified=true filter). The frontend should never reach this
  -- error in normal flow, but the DB-level check makes the
  -- "bank-verify before VIP" invariant un-bypassable.
  SELECT EXISTS (
    SELECT 1 FROM public.bank_accounts
    WHERE user_id = p_user_id
      AND party_type = 'landlord'
      AND verified = true
  ) INTO v_bank_verified;

  IF NOT v_bank_verified THEN
    success := false;
    error_code := 'BANK_NOT_VERIFIED';
    error_message := 'Please verify your landlord''s bank details before claiming an invite code.';
    auto_approved := false;
    RETURN NEXT; RETURN;
  END IF;

  -- ============================================================
  -- ATOMIC CODE LOCK + READ
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

  -- VIP promotion (kept from prior migration). At this point we already
  -- know the user has bank_verified=true, so check_and_advance_to_active
  -- will succeed and flip them straight to 'active'.
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
  'Atomically consumes invite code. Refuses with BANK_NOT_VERIFIED if the '
  'user does not have a verified landlord bank account — enforces the '
  'product flow (bank verify before claim) at the DB level. For is_vip '
  'codes auto-promotes to approved and advances to active.';
