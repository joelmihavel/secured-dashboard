-- ==============================================
-- INVITE CODES: Multi-use support for VIP/auto-approve codes
-- ==============================================

-- Add columns (idempotent)
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS use_count INTEGER NOT NULL DEFAULT 0;

-- Backfill: already-used codes get use_count = 1
UPDATE invite_codes SET use_count = 1 WHERE status = 'used' AND use_count = 0;

-- ==============================================
-- REPLACE claim_invite_code to support multi-use
-- ==============================================

CREATE OR REPLACE FUNCTION claim_invite_code(p_user_id UUID, p_code TEXT)
RETURNS TABLE(
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_code_id UUID;
  v_code_status TEXT;
  v_max_uses INTEGER;
  v_use_count INTEGER;
  v_existing_code UUID;
BEGIN
  -- Check if user already used an invite code
  SELECT invite_code_id INTO v_existing_code
  FROM waitlist_entries
  WHERE user_id = p_user_id AND invite_code_id IS NOT NULL;

  IF v_existing_code IS NOT NULL THEN
    success := false;
    error_code := 'ALREADY_CLAIMED';
    error_message := 'You have already used an invite code';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Atomically lock the code row
  SELECT ic.id, ic.status, ic.max_uses, ic.use_count
    INTO v_code_id, v_code_status, v_max_uses, v_use_count
  FROM invite_codes ic
  WHERE ic.code = upper(p_code)
  FOR UPDATE SKIP LOCKED;

  IF v_code_id IS NULL THEN
    success := false;
    error_code := 'INVALID_CODE';
    error_message := 'This invite code is not valid';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_code_status = 'revoked' THEN
    success := false;
    error_code := 'CODE_REVOKED';
    error_message := 'This invite code is no longer valid';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check remaining uses
  IF v_use_count >= v_max_uses THEN
    success := false;
    error_code := 'ALREADY_USED';
    error_message := 'This invite code has already been used';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Increment use_count; flip status to 'used' only when fully exhausted
  UPDATE invite_codes
  SET use_count = use_count + 1,
      used_by   = p_user_id,
      used_at   = now(),
      status    = CASE WHEN use_count + 1 >= max_uses THEN 'used' ELSE status END
  WHERE id = v_code_id;

  -- Link to waitlist entry
  UPDATE waitlist_entries
  SET invite_code_id = v_code_id
  WHERE user_id = p_user_id;

  success := true;
  error_code := NULL;
  error_message := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
