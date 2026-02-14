-- Flent Secured v2 - Migration: Set default priority_boost on referral codes
-- Date: 2026-02-14
-- Description: User-generated referral codes should give a position bump by default.
--   Sets priority_boost=5 for existing user codes and updates the generate function
--   to include it for new codes.

-- ==============================================
-- BACKFILL: Set priority_boost for existing user codes
-- ==============================================

UPDATE referral_codes
SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{priority_boost}', '5')
WHERE code_type = 'user'
  AND (metadata IS NULL OR (metadata->>'priority_boost') IS NULL);

-- ==============================================
-- UPDATE: generate_user_referral_code to include priority_boost
-- ==============================================

CREATE OR REPLACE FUNCTION generate_user_referral_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
  v_attempts INTEGER := 0;
BEGIN
  -- Check if user already has a code
  SELECT code INTO v_code
  FROM referral_codes
  WHERE owner_user_id = p_user_id AND code_type = 'user'
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Generate unique code
  LOOP
    v_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || p_user_id::TEXT || NOW()::TEXT) FROM 1 FOR 6));

    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO referral_codes (code, owner_user_id, code_type, metadata)
      VALUES (v_code, p_user_id, 'user', '{"priority_boost": 5}');
      RETURN v_code;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique referral code';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
