-- Flent Secured v2 - Migration: Fix Refunds & Referrals Schema
-- Date: 2026-01-29
-- Description: Fixes schema mismatches between Edge Functions and database
-- - Adds missing columns to refunds table
-- - Updates validate_referral_code and apply_referral_code functions
-- - Adds referral_code_id to users table

-- ==============================================
-- FIX: refunds table - Add missing columns
-- ==============================================

DO $$
BEGIN
  -- Add user_id column (denormalized for easier querying)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'refunds' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE refunds ADD COLUMN user_id UUID REFERENCES auth.users(id);
    CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);
  END IF;

  -- Add requested_at column (when user requested the refund)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'refunds' AND column_name = 'requested_at'
  ) THEN
    ALTER TABLE refunds ADD COLUMN requested_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add cashback_reversed_paise column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'refunds' AND column_name = 'cashback_reversed_paise'
  ) THEN
    ALTER TABLE refunds ADD COLUMN cashback_reversed_paise BIGINT DEFAULT 0;
  END IF;

  -- Add requested_by column (separate from initiated_by for admin vs user)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'refunds' AND column_name = 'requested_by'
  ) THEN
    ALTER TABLE refunds ADD COLUMN requested_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- ==============================================
-- FIX: users table - Add referral_code_id column
-- ==============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referral_code_id'
  ) THEN
    ALTER TABLE users ADD COLUMN referral_code_id UUID REFERENCES referral_codes(id);
  END IF;
END $$;

-- ==============================================
-- FIX: Update validate_referral_code function
-- Returns additional fields expected by Edge Function
-- ==============================================

-- Must drop first because return type is changing
DROP FUNCTION IF EXISTS validate_referral_code(TEXT);

CREATE OR REPLACE FUNCTION validate_referral_code(p_code TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  code_id UUID,
  reward_paise BIGINT,
  error_message TEXT,
  owner_name TEXT,
  reward_type TEXT,
  reward_amount_paise BIGINT,
  priority_boost INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN rc.id IS NULL THEN false
      WHEN NOT rc.is_active THEN false
      WHEN rc.expires_at IS NOT NULL AND rc.expires_at <= NOW() THEN false
      WHEN rc.current_uses >= rc.max_uses THEN false
      ELSE true
    END as is_valid,
    rc.id as code_id,
    COALESCE(rc.referee_reward_paise, 0::BIGINT) as reward_paise,
    CASE
      WHEN rc.id IS NULL THEN 'Invalid referral code'
      WHEN NOT rc.is_active THEN 'This referral code is no longer active'
      WHEN rc.expires_at IS NOT NULL AND rc.expires_at <= NOW() THEN 'This referral code has expired'
      WHEN rc.current_uses >= rc.max_uses THEN 'This referral code has reached its maximum uses'
      ELSE NULL
    END as error_message,
    u.full_name as owner_name,
    CASE
      WHEN rc.referee_reward_paise > 0 AND (rc.metadata->>'priority_boost')::int > 0 THEN 'both'
      WHEN rc.referee_reward_paise > 0 THEN 'cashback'
      WHEN (rc.metadata->>'priority_boost')::int > 0 THEN 'priority'
      ELSE 'none'
    END as reward_type,
    COALESCE(rc.referee_reward_paise, 0::BIGINT) as reward_amount_paise,
    COALESCE((rc.metadata->>'priority_boost')::int, 0) as priority_boost
  FROM referral_codes rc
  LEFT JOIN users u ON u.id = rc.owner_user_id
  WHERE UPPER(rc.code) = UPPER(p_code);

  -- If no rows returned, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      0::BIGINT,
      'Invalid referral code'::TEXT,
      NULL::TEXT,
      'none'::TEXT,
      0::BIGINT,
      0::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FIX: Update apply_referral_code function
-- Returns additional fields expected by Edge Function
-- ==============================================

-- Must drop first because return type is changing
DROP FUNCTION IF EXISTS apply_referral_code(UUID, TEXT);

CREATE OR REPLACE FUNCTION apply_referral_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  error_message TEXT,
  reward_paise BIGINT,
  reward_type TEXT,
  reward_amount_paise BIGINT,
  priority_boost INTEGER
) AS $$
DECLARE
  v_validation RECORD;
  v_existing_redemption UUID;
  v_owner_user_id UUID;
  v_reward_type TEXT;
  v_reward_paise BIGINT;
  v_priority_boost INTEGER;
BEGIN
  -- Check if user already used a referral code
  SELECT id INTO v_existing_redemption
  FROM referral_redemptions
  WHERE referee_user_id = p_user_id;

  IF v_existing_redemption IS NOT NULL THEN
    RETURN QUERY SELECT
      false,
      'You have already used a referral code'::TEXT,
      'You have already used a referral code'::TEXT,
      0::BIGINT,
      'none'::TEXT,
      0::BIGINT,
      0::INTEGER;
    RETURN;
  END IF;

  -- Validate the code
  SELECT * INTO v_validation
  FROM validate_referral_code(p_code);

  IF NOT v_validation.is_valid THEN
    RETURN QUERY SELECT
      false,
      v_validation.error_message,
      v_validation.error_message,
      0::BIGINT,
      'none'::TEXT,
      0::BIGINT,
      0::INTEGER;
    RETURN;
  END IF;

  -- Check user isn't using their own code
  SELECT owner_user_id INTO v_owner_user_id
  FROM referral_codes WHERE id = v_validation.code_id;

  IF v_owner_user_id = p_user_id THEN
    RETURN QUERY SELECT
      false,
      'You cannot use your own referral code'::TEXT,
      'You cannot use your own referral code'::TEXT,
      0::BIGINT,
      'none'::TEXT,
      0::BIGINT,
      0::INTEGER;
    RETURN;
  END IF;

  -- Get reward details
  SELECT
    COALESCE(rc.referee_reward_paise, 0),
    CASE
      WHEN rc.referee_reward_paise > 0 AND (rc.metadata->>'priority_boost')::int > 0 THEN 'both'
      WHEN rc.referee_reward_paise > 0 THEN 'cashback'
      WHEN (rc.metadata->>'priority_boost')::int > 0 THEN 'priority'
      ELSE 'none'
    END,
    COALESCE((rc.metadata->>'priority_boost')::int, 0)
  INTO v_reward_paise, v_reward_type, v_priority_boost
  FROM referral_codes rc
  WHERE rc.id = v_validation.code_id;

  -- Create redemption record
  INSERT INTO referral_redemptions (
    referral_code_id,
    referee_user_id,
    referee_reward_paise,
    referrer_reward_paise
  )
  SELECT
    v_validation.code_id,
    p_user_id,
    rc.referee_reward_paise,
    rc.referrer_reward_paise
  FROM referral_codes rc
  WHERE rc.id = v_validation.code_id;

  -- Update user's referral_code_id
  UPDATE users
  SET
    referral_code_id = v_validation.code_id,
    referral_applied_at = NOW()
  WHERE id = p_user_id;

  -- Credit cashback to referee if applicable
  IF v_reward_paise > 0 THEN
    INSERT INTO cashback_ledger (
      user_id,
      transaction_type,
      amount_paise,
      balance_after_paise,
      description,
      expires_at
    )
    SELECT
      p_user_id,
      'referral_bonus',
      v_reward_paise,
      COALESCE((SELECT SUM(CASE WHEN transaction_type IN ('earned', 'referral_bonus', 'promotional') THEN amount_paise ELSE -amount_paise END) FROM cashback_ledger WHERE user_id = p_user_id), 0) + v_reward_paise,
      'Referral bonus for using code ' || p_code,
      NOW() + INTERVAL '90 days';

    -- Update redemption as credited
    UPDATE referral_redemptions
    SET
      referee_credited = true,
      referee_credited_at = NOW()
    WHERE referee_user_id = p_user_id
      AND referral_code_id = v_validation.code_id;
  END IF;

  -- Credit referrer cashback if applicable
  IF v_owner_user_id IS NOT NULL THEN
    DECLARE
      v_referrer_reward BIGINT;
    BEGIN
      SELECT referrer_reward_paise INTO v_referrer_reward
      FROM referral_codes WHERE id = v_validation.code_id;

      IF v_referrer_reward > 0 THEN
        INSERT INTO cashback_ledger (
          user_id,
          transaction_type,
          amount_paise,
          balance_after_paise,
          description,
          expires_at
        )
        SELECT
          v_owner_user_id,
          'referral_bonus',
          v_referrer_reward,
          COALESCE((SELECT SUM(CASE WHEN transaction_type IN ('earned', 'referral_bonus', 'promotional') THEN amount_paise ELSE -amount_paise END) FROM cashback_ledger WHERE user_id = v_owner_user_id), 0) + v_referrer_reward,
          'Referral bonus - someone used your code',
          NOW() + INTERVAL '90 days';

        -- Update redemption as referrer credited
        UPDATE referral_redemptions
        SET
          referrer_credited = true,
          referrer_credited_at = NOW()
        WHERE referee_user_id = p_user_id
          AND referral_code_id = v_validation.code_id;
      END IF;
    END;
  END IF;

  RETURN QUERY SELECT
    true,
    'Referral code applied successfully!'::TEXT,
    NULL::TEXT,
    v_reward_paise,
    v_reward_type,
    v_reward_paise,
    v_priority_boost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- CREATE: referral_applications view (alias for referral_redemptions)
-- For backward compatibility with Edge Functions
-- ==============================================

CREATE OR REPLACE VIEW referral_applications AS
SELECT
  id,
  referral_code_id,
  referee_user_id as user_id,
  referee_reward_paise,
  referrer_reward_paise,
  referee_credited,
  referrer_credited,
  referee_credited_at,
  referrer_credited_at,
  created_at
FROM referral_redemptions;

-- Grant access to the view
GRANT SELECT ON referral_applications TO authenticated;
GRANT SELECT ON referral_applications TO service_role;

-- ==============================================
-- UPDATE: RLS policy for refunds to use user_id column
-- ==============================================

-- Drop old policy if exists
DROP POLICY IF EXISTS refunds_select_own ON refunds;

-- Create new policy using user_id column
CREATE POLICY refunds_select_own ON refunds
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM payments p
      JOIN tenancies t ON t.id = p.tenancy_id
      WHERE p.id = refunds.payment_id
        AND t.user_id = auth.uid()
    )
  );

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON COLUMN refunds.user_id IS 'User who initiated the refund (denormalized for query performance)';
COMMENT ON COLUMN refunds.requested_at IS 'Timestamp when user requested the refund';
COMMENT ON COLUMN refunds.cashback_reversed_paise IS 'Amount of cashback reversed due to this refund';
COMMENT ON COLUMN refunds.requested_by IS 'User who requested the refund (may differ from initiator for admin actions)';
COMMENT ON VIEW referral_applications IS 'Backward compatibility view for referral_redemptions table';
