-- Fix generate_invite_codes: PL/pgSQL 2D array indexing doesn't support row slicing.
-- Use simple IF/ELSIF instead.

-- First, delete the broken batch of all-digit codes
DELETE FROM invite_codes WHERE batch_number = 1;

-- Replace the function with corrected version
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
  v_lp1 INTEGER;
  v_lp2 INTEGER;
  v_combo_idx INTEGER;
  i INTEGER;
BEGIN
  -- Get next batch number
  SELECT COALESCE(MAX(batch_number), 0) + 1 INTO v_batch FROM invite_codes;

  WHILE v_generated < p_count AND v_attempts < v_max_attempts LOOP
    v_attempts := v_attempts + 1;
    v_chars := ARRAY['','','',''];

    -- Pick random combo for letter positions (1 of 6 combos of C(4,2))
    v_combo_idx := floor(random() * 6)::int;
    CASE v_combo_idx
      WHEN 0 THEN v_lp1 := 1; v_lp2 := 2;
      WHEN 1 THEN v_lp1 := 1; v_lp2 := 3;
      WHEN 2 THEN v_lp1 := 1; v_lp2 := 4;
      WHEN 3 THEN v_lp1 := 2; v_lp2 := 3;
      WHEN 4 THEN v_lp1 := 2; v_lp2 := 4;
      WHEN 5 THEN v_lp1 := 3; v_lp2 := 4;
    END CASE;

    -- Fill all 4 positions
    FOR i IN 1..4 LOOP
      IF i = v_lp1 OR i = v_lp2 THEN
        v_chars[i] := substring(v_letters from (floor(random() * length(v_letters))::int + 1) for 1);
      ELSE
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

-- Also update the original function in case it's called again
-- (this CREATE OR REPLACE above handles it)

-- Generate fresh 100 invite codes
SELECT * FROM generate_invite_codes(100);
