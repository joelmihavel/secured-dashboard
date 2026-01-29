-- Flent Secured v2 - Migration: Payment Methods, Refunds, Referrals, Notification Preferences
-- Date: 2026-01-29
-- Description: Creates missing tables identified in BACKEND_GAP_ANALYSIS.md
-- Deploy to: v2-dev-branch (development)

-- ==============================================
-- TABLE: payment_methods
-- Stores saved payment methods for users (UPI, Cards, Net Banking)
-- ==============================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Payment method type
  type TEXT NOT NULL CHECK (type IN ('upi', 'card', 'netbanking')),
  display_name TEXT NOT NULL, -- User-friendly name like "HDFC Debit ****1234"

  -- UPI fields
  upi_vpa TEXT, -- e.g., "user@oksbi"
  upi_provider TEXT, -- gpay, phonepe, paytm, bhim, etc.

  -- Card fields (tokenized - never store full card details)
  card_token TEXT, -- PayU/Payment gateway token
  card_last4 VARCHAR(4),
  card_network TEXT CHECK (card_network IN ('visa', 'mastercard', 'rupay', 'amex', 'diners', 'maestro') OR card_network IS NULL),
  card_type TEXT CHECK (card_type IN ('credit', 'debit', 'prepaid') OR card_type IS NULL),
  card_issuer TEXT, -- Bank name
  card_expiry TEXT, -- MM/YY format (only store if needed for display)

  -- Net Banking fields
  bank_code TEXT, -- Standard bank code for net banking
  bank_name TEXT,

  -- Common fields
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'expired')),
  verified_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional provider-specific data

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete for payment methods
);

-- ==============================================
-- TABLE: refunds
-- Tracks refund requests and their status
-- ==============================================

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,

  -- Refund details
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'processing', 'completed', 'failed', 'rejected', 'cancelled')),
  reason TEXT NOT NULL,
  rejection_reason TEXT, -- Why refund was rejected (if applicable)

  -- Payment gateway details
  payu_refund_id TEXT, -- PayU's refund transaction ID
  payu_status TEXT, -- Raw status from PayU
  payu_response JSONB, -- Full response from PayU for debugging

  -- Bank details
  refund_arn TEXT, -- Acquirer Reference Number
  bank_reference TEXT,

  -- Processing info
  initiated_by UUID REFERENCES auth.users(id), -- User or admin who initiated
  processed_by TEXT, -- 'system', 'admin', or admin user ID

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ, -- When refund was processed by gateway
  completed_at TIMESTAMPTZ, -- When money was actually credited back

  -- Idempotency
  idempotency_key TEXT UNIQUE
);

-- ==============================================
-- TABLE: referral_codes
-- Manages referral codes for user acquisition
-- ==============================================

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,

  -- Owner (null for system-generated promo codes)
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Usage limits
  max_uses INTEGER DEFAULT 10,
  current_uses INTEGER NOT NULL DEFAULT 0 CHECK (current_uses >= 0),

  -- Rewards (in paise)
  reward_amount_paise BIGINT NOT NULL DEFAULT 10000, -- Rs 100 default
  referrer_reward_paise BIGINT NOT NULL DEFAULT 10000, -- Reward for referrer
  referee_reward_paise BIGINT NOT NULL DEFAULT 10000, -- Reward for referee

  -- Validity
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,

  -- Type
  code_type TEXT NOT NULL DEFAULT 'user' CHECK (code_type IN ('user', 'promo', 'influencer', 'partner')),
  campaign_name TEXT, -- For promo codes, track campaign

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- TABLE: referral_redemptions
-- Tracks who used which referral code
-- ==============================================

CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE RESTRICT,
  referee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rewards tracking
  referee_reward_paise BIGINT NOT NULL,
  referrer_reward_paise BIGINT NOT NULL,
  referee_credited BOOLEAN NOT NULL DEFAULT false,
  referrer_credited BOOLEAN NOT NULL DEFAULT false,
  referee_credited_at TIMESTAMPTZ,
  referrer_credited_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each user can only use one referral code ever
  UNIQUE(referee_user_id)
);

-- ==============================================
-- TABLE: notification_preferences
-- User-level notification settings
-- ==============================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Channel preferences
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Notification type preferences
  payment_reminders BOOLEAN NOT NULL DEFAULT true,
  payment_confirmations BOOLEAN NOT NULL DEFAULT true,
  cashback_notifications BOOLEAN NOT NULL DEFAULT true,
  landlord_updates BOOLEAN NOT NULL DEFAULT true,
  verification_updates BOOLEAN NOT NULL DEFAULT true,
  promotional BOOLEAN NOT NULL DEFAULT false, -- Opt-in for marketing

  -- Quiet hours (optional)
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME, -- e.g., '22:00'
  quiet_hours_end TIME, -- e.g., '08:00'

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- INDEXES
-- ==============================================

-- payment_methods indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_default ON payment_methods(user_id, is_default) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(user_id, type) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_user_upi_vpa ON payment_methods(user_id, upi_vpa) WHERE type = 'upi' AND deleted_at IS NULL;

-- refunds indexes
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_payu_refund_id ON refunds(payu_refund_id) WHERE payu_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at DESC);

-- referral_codes indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes(is_active, expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_referral_codes_type ON referral_codes(code_type);

-- referral_redemptions indexes
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_code ON referral_redemptions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referee ON referral_redemptions(referee_user_id);

-- ==============================================
-- TRIGGERS: Auto-update updated_at
-- ==============================================

-- payment_methods updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_methods_updated_at();

-- refunds updated_at trigger
CREATE OR REPLACE FUNCTION update_refunds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_refunds_updated_at();

-- referral_codes updated_at trigger
CREATE OR REPLACE FUNCTION update_referral_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_referral_codes_updated_at
  BEFORE UPDATE ON referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_codes_updated_at();

-- notification_preferences updated_at trigger
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- ==============================================
-- TRIGGER: Ensure only one default payment method per user
-- ==============================================

CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE payment_methods
    SET is_default = false, updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_payment_method
  AFTER INSERT OR UPDATE OF is_default ON payment_methods
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_payment_method();

-- ==============================================
-- TRIGGER: Increment referral code usage on redemption
-- ==============================================

CREATE OR REPLACE FUNCTION increment_referral_code_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE referral_codes
  SET current_uses = current_uses + 1, updated_at = NOW()
  WHERE id = NEW.referral_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_referral_usage
  AFTER INSERT ON referral_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION increment_referral_code_usage();

-- ==============================================
-- TRIGGER: Create default notification preferences on user creation
-- ==============================================

CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to users table (will fire after handle_new_user)
DROP TRIGGER IF EXISTS on_user_created_notification_prefs ON public.users;
CREATE TRIGGER on_user_created_notification_prefs
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- ==============================================
-- RLS POLICIES: payment_methods
-- ==============================================

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment methods
CREATE POLICY payment_methods_select_own ON payment_methods
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can insert their own payment methods
CREATE POLICY payment_methods_insert_own ON payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own payment methods
CREATE POLICY payment_methods_update_own ON payment_methods
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can soft-delete their own payment methods
CREATE POLICY payment_methods_delete_own ON payment_methods
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY payment_methods_service_all ON payment_methods
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================
-- RLS POLICIES: refunds
-- ==============================================

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Users can view refunds for their payments
CREATE POLICY refunds_select_own ON refunds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments p
      JOIN tenancies t ON t.id = p.tenancy_id
      WHERE p.id = refunds.payment_id
        AND t.user_id = auth.uid()
    )
  );

-- Only service role can create/update refunds (via Edge Functions)
CREATE POLICY refunds_service_all ON refunds
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================
-- RLS POLICIES: referral_codes
-- ==============================================

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active public codes (for validation)
CREATE POLICY referral_codes_select_active ON referral_codes
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND current_uses < max_uses
  );

-- Users can view their own referral codes
CREATE POLICY referral_codes_select_own ON referral_codes
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- Only service role can create/update referral codes
CREATE POLICY referral_codes_service_all ON referral_codes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================
-- RLS POLICIES: referral_redemptions
-- ==============================================

ALTER TABLE referral_redemptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own redemption
CREATE POLICY referral_redemptions_select_own ON referral_redemptions
  FOR SELECT TO authenticated
  USING (referee_user_id = auth.uid());

-- Referral code owners can see who used their codes
CREATE POLICY referral_redemptions_select_referrer ON referral_redemptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM referral_codes rc
      WHERE rc.id = referral_redemptions.referral_code_id
        AND rc.owner_user_id = auth.uid()
    )
  );

-- Only service role can create/update redemptions
CREATE POLICY referral_redemptions_service_all ON referral_redemptions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================
-- RLS POLICIES: notification_preferences
-- ==============================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY notification_preferences_select_own ON notification_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY notification_preferences_update_own ON notification_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can insert their own preferences (fallback if trigger fails)
CREATE POLICY notification_preferences_insert_own ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY notification_preferences_service_all ON notification_preferences
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================
-- MISSING RLS POLICIES: utility_verifications
-- ==============================================

-- Check if policy exists before creating (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'utility_verifications'
      AND policyname = 'utility_verifications_select_own'
  ) THEN
    CREATE POLICY utility_verifications_select_own ON utility_verifications
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ==============================================
-- MISSING RLS POLICIES: device_tokens
-- ==============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'device_tokens'
      AND policyname = 'device_tokens_user_crud'
  ) THEN
    CREATE POLICY device_tokens_user_crud ON device_tokens
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ==============================================
-- HELPER FUNCTIONS
-- ==============================================

-- Function to validate referral code
CREATE OR REPLACE FUNCTION validate_referral_code(p_code TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  code_id UUID,
  reward_paise BIGINT,
  error_message TEXT
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
    END as error_message
  FROM referral_codes rc
  WHERE UPPER(rc.code) = UPPER(p_code);

  -- If no rows returned, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::BIGINT, 'Invalid referral code'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply referral code
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  reward_paise BIGINT
) AS $$
DECLARE
  v_validation RECORD;
  v_existing_redemption UUID;
  v_owner_user_id UUID;
BEGIN
  -- Check if user already used a referral code
  SELECT id INTO v_existing_redemption
  FROM referral_redemptions
  WHERE referee_user_id = p_user_id;

  IF v_existing_redemption IS NOT NULL THEN
    RETURN QUERY SELECT false, 'You have already used a referral code'::TEXT, 0::BIGINT;
    RETURN;
  END IF;

  -- Validate the code
  SELECT * INTO v_validation
  FROM validate_referral_code(p_code);

  IF NOT v_validation.is_valid THEN
    RETURN QUERY SELECT false, v_validation.error_message, 0::BIGINT;
    RETURN;
  END IF;

  -- Check user isn't using their own code
  SELECT owner_user_id INTO v_owner_user_id
  FROM referral_codes WHERE id = v_validation.code_id;

  IF v_owner_user_id = p_user_id THEN
    RETURN QUERY SELECT false, 'You cannot use your own referral code'::TEXT, 0::BIGINT;
    RETURN;
  END IF;

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

  RETURN QUERY SELECT true, 'Referral code applied successfully!'::TEXT, v_validation.reward_paise;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique referral code for user
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
      INSERT INTO referral_codes (code, owner_user_id, code_type)
      VALUES (v_code, p_user_id, 'user');
      RETURN v_code;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique referral code';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- ALTER USERS TABLE: Add referral tracking columns
-- ==============================================

DO $$
BEGIN
  -- Add referral_applied_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referral_applied_at'
  ) THEN
    ALTER TABLE users ADD COLUMN referral_applied_at TIMESTAMPTZ;
  END IF;

  -- Add avatar_storage_path if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'avatar_storage_path'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_storage_path TEXT;
  END IF;
END $$;

-- ==============================================
-- ALTER EXTRACTED_RENTAL_INFO: Add user modification tracking
-- ==============================================

DO $$
BEGIN
  -- Add user_modified_data if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extracted_rental_info' AND column_name = 'user_modified_data'
  ) THEN
    ALTER TABLE extracted_rental_info ADD COLUMN user_modified_data JSONB DEFAULT '{}';
  END IF;

  -- Add modification_history if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extracted_rental_info' AND column_name = 'modification_history'
  ) THEN
    ALTER TABLE extracted_rental_info ADD COLUMN modification_history JSONB DEFAULT '[]';
  END IF;
END $$;

-- ==============================================
-- ALTER NOTIFICATIONS: Add dismissed_at for soft delete
-- ==============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'dismissed_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN dismissed_at TIMESTAMPTZ;
  END IF;
END $$;

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE payment_methods IS 'Saved payment methods (UPI, Cards, Net Banking) for users';
COMMENT ON COLUMN payment_methods.card_token IS 'Tokenized card data from payment gateway - never store full card details';
COMMENT ON COLUMN payment_methods.deleted_at IS 'Soft delete timestamp - payment methods should be soft deleted for audit';

COMMENT ON TABLE refunds IS 'Tracks refund requests and their processing status';
COMMENT ON COLUMN refunds.amount_paise IS 'Refund amount in paise (1 INR = 100 paise)';
COMMENT ON COLUMN refunds.payu_refund_id IS 'PayU refund transaction reference';

COMMENT ON TABLE referral_codes IS 'Referral and promotional codes for user acquisition';
COMMENT ON COLUMN referral_codes.code_type IS 'user=personal referral, promo=system campaign, influencer/partner=special partnerships';
COMMENT ON COLUMN referral_codes.reward_amount_paise IS 'Deprecated: Use referee_reward_paise and referrer_reward_paise';

COMMENT ON TABLE referral_redemptions IS 'Tracks which users redeemed which referral codes';

COMMENT ON TABLE notification_preferences IS 'User preferences for notification channels and types';
COMMENT ON COLUMN notification_preferences.promotional IS 'Opt-in required for marketing communications per regulations';

COMMENT ON FUNCTION validate_referral_code IS 'Validates a referral code and returns validity status with error message';
COMMENT ON FUNCTION apply_referral_code IS 'Applies a referral code to a user, creating redemption record';
COMMENT ON FUNCTION generate_user_referral_code IS 'Generates or retrieves a unique referral code for a user';

-- ==============================================
-- ENABLE REALTIME FOR NEW TABLES
-- ==============================================

DO $$
BEGIN
  -- Check if realtime is available and add tables
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Add payment_methods to realtime (for default selection sync)
    ALTER PUBLICATION supabase_realtime ADD TABLE payment_methods;

    -- Add refunds to realtime (for status updates)
    ALTER PUBLICATION supabase_realtime ADD TABLE refunds;

    -- Add referral_codes to realtime (optional, for live usage counters)
    ALTER PUBLICATION supabase_realtime ADD TABLE referral_codes;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Tables already in publication, ignore
    NULL;
END $$;
