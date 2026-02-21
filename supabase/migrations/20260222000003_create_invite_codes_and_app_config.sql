-- ==============================================
-- INVITE CODES TABLE
-- Admin-generated codes: 2 letters + 2 digits in shuffled positions
-- ==============================================

CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(4) UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'used', 'revoked')),
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  batch_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_status ON invite_codes(status);
CREATE INDEX IF NOT EXISTS idx_invite_codes_batch ON invite_codes(batch_number);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage invite codes (edge functions use service role)
CREATE POLICY "Service role full access on invite_codes"
  ON invite_codes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- INVITE CODE RATE LIMITING
-- ==============================================

CREATE TABLE IF NOT EXISTS invite_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_attempted VARCHAR(10) NOT NULL,
  was_valid BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_attempts_user_time
  ON invite_code_attempts(user_id, attempted_at DESC);

ALTER TABLE invite_code_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on invite_code_attempts"
  ON invite_code_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- APP CONFIG TABLE (dynamic settings)
-- ==============================================

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read config (for review timeline, batch info)
CREATE POLICY "Authenticated can read app_config"
  ON app_config FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role can write
CREATE POLICY "Service role can manage app_config"
  ON app_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- SEED APP CONFIG
-- ==============================================

INSERT INTO app_config (key, value) VALUES
  ('review_timeline', '{"hours": 24, "display_text": "Approximately 24 hrs"}'::jsonb),
  ('batch_config', '{
    "current_batch": 1,
    "batch_size": 200,
    "batch_launch_date": null,
    "rejection_cooldown_days": 30
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ==============================================
-- ADD invite_code_id TO waitlist_entries
-- ==============================================

ALTER TABLE waitlist_entries
  ADD COLUMN IF NOT EXISTS invite_code_id UUID REFERENCES invite_codes(id),
  ADD COLUMN IF NOT EXISTS batch_number INTEGER DEFAULT 1;

-- ==============================================
-- GENERATE INVITE CODES FUNCTION
-- Generates batch of codes with format: 2 letters + 2 digits in random positions
-- Letters: A-Z excluding I, O (confused with 1, 0)
-- Digits: 2-9 excluding 0, 1 (confused with O, I)
-- ==============================================

CREATE OR REPLACE FUNCTION generate_invite_codes(p_count INTEGER DEFAULT 100)
RETURNS TABLE(generated_code TEXT) AS $$
DECLARE
  v_batch INTEGER;
  v_code TEXT;
  v_generated INTEGER := 0;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := p_count * 10;
  v_letters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_digits TEXT := '2345679';
  v_chars TEXT[];
  v_positions INTEGER[];
  v_letter_pos_idx INTEGER;
  v_rand FLOAT;
  -- 6 possible placements for 2 letters in 4 positions: C(4,2) = 6
  v_letter_combos INTEGER[][] := ARRAY[
    ARRAY[1,2], ARRAY[1,3], ARRAY[1,4],
    ARRAY[2,3], ARRAY[2,4], ARRAY[3,4]
  ];
  v_combo INTEGER[];
  i INTEGER;
BEGIN
  -- Get next batch number
  SELECT COALESCE(MAX(batch_number), 0) + 1 INTO v_batch FROM invite_codes;

  WHILE v_generated < p_count AND v_attempts < v_max_attempts LOOP
    v_attempts := v_attempts + 1;
    v_chars := ARRAY['','','',''];

    -- Pick random letter position combo (1 of 6)
    v_letter_pos_idx := floor(random() * 6)::int + 1;
    v_combo := v_letter_combos[v_letter_pos_idx];

    -- Fill all 4 positions
    FOR i IN 1..4 LOOP
      IF i = v_combo[1] OR i = v_combo[2] THEN
        -- Letter position
        v_chars[i] := substring(v_letters from (floor(random() * length(v_letters))::int + 1) for 1);
      ELSE
        -- Digit position
        v_chars[i] := substring(v_digits from (floor(random() * length(v_digits))::int + 1) for 1);
      END IF;
    END LOOP;

    v_code := v_chars[1] || v_chars[2] || v_chars[3] || v_chars[4];

    -- Try to insert (skip duplicates)
    BEGIN
      INSERT INTO invite_codes (code, batch_number) VALUES (v_code, v_batch);
      v_generated := v_generated + 1;
      generated_code := v_code;
      RETURN NEXT;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- CLAIM INVITE CODE FUNCTION (atomic validate + claim)
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

  -- Atomically claim the code (SELECT FOR UPDATE prevents race conditions)
  SELECT ic.id, ic.status INTO v_code_id, v_code_status
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

  IF v_code_status = 'used' THEN
    success := false;
    error_code := 'ALREADY_USED';
    error_message := 'This invite code has already been used';
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

  -- Claim the code
  UPDATE invite_codes
  SET status = 'used', used_by = p_user_id, used_at = now()
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

-- ==============================================
-- GENERATE INITIAL 100 INVITE CODES
-- ==============================================

SELECT * FROM generate_invite_codes(100);
