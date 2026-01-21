-- Flent Secured v2 - Migration: Add Landlord Invite Columns
-- Adds columns for landlord approval tokens and OTP verification

-- ==============================================
-- MODIFY EXISTING COLUMNS
-- ==============================================

-- Change landlord_approval_token from UUID to TEXT for secure random tokens
-- First drop the existing column and recreate with TEXT type
ALTER TABLE tenancies DROP COLUMN IF EXISTS landlord_approval_token;

-- ==============================================
-- ADD COLUMNS TO TENANCIES TABLE
-- ==============================================

-- Add landlord approval token columns
ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS landlord_approval_token TEXT,
  ADD COLUMN IF NOT EXISTS landlord_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS landlord_invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS landlord_invite_count INTEGER NOT NULL DEFAULT 0;

-- Add landlord OTP verification columns
ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS landlord_otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS landlord_otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS landlord_otp_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landlord_otp_verified BOOLEAN NOT NULL DEFAULT false;

-- Add landlord response tracking
ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS landlord_response TEXT CHECK (landlord_response IN ('approved', 'disputed', 'pending')),
  ADD COLUMN IF NOT EXISTS landlord_dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS landlord_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS landlord_disputed_at TIMESTAMPTZ;

-- ==============================================
-- INDEXES
-- ==============================================

-- Fast lookup by approval token
CREATE INDEX IF NOT EXISTS idx_tenancies_approval_token ON tenancies(landlord_approval_token)
  WHERE landlord_approval_token IS NOT NULL;

-- Find pending landlord approvals
CREATE INDEX IF NOT EXISTS idx_tenancies_pending_approval ON tenancies(landlord_invite_sent_at)
  WHERE landlord_approved = false AND landlord_approval_token IS NOT NULL;

-- ==============================================
-- FUNCTION: Generate and store landlord OTP
-- ==============================================

CREATE OR REPLACE FUNCTION generate_landlord_otp(
  p_tenancy_id UUID,
  p_email TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_otp TEXT;
  v_otp_hash TEXT;
  v_tenancy RECORD;
BEGIN
  -- Get tenancy and verify email matches
  SELECT * INTO v_tenancy FROM tenancies WHERE id = p_tenancy_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenancy not found';
  END IF;

  -- Verify email matches landlord email
  IF LOWER(v_tenancy.landlord_email) != LOWER(p_email) THEN
    RAISE EXCEPTION 'Email does not match landlord on record';
  END IF;

  -- Check for too many attempts
  IF v_tenancy.landlord_otp_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many OTP attempts. Please contact support.';
  END IF;

  -- Generate 6-digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Hash the OTP before storing
  v_otp_hash := encode(sha256(v_otp::bytea), 'hex');

  -- Update tenancy with OTP
  UPDATE tenancies SET
    landlord_otp_hash = v_otp_hash,
    landlord_otp_expires_at = NOW() + INTERVAL '10 minutes',
    landlord_otp_attempts = landlord_otp_attempts + 1,
    updated_at = NOW()
  WHERE id = p_tenancy_id;

  -- Return the plain OTP (caller sends this to landlord via email)
  RETURN v_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNCTION: Verify landlord OTP
-- ==============================================

CREATE OR REPLACE FUNCTION verify_landlord_otp(
  p_tenancy_id UUID,
  p_otp TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tenancy RECORD;
  v_otp_hash TEXT;
BEGIN
  -- Get tenancy
  SELECT * INTO v_tenancy FROM tenancies WHERE id = p_tenancy_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if OTP exists and not expired
  IF v_tenancy.landlord_otp_hash IS NULL OR v_tenancy.landlord_otp_expires_at < NOW() THEN
    RETURN false;
  END IF;

  -- Hash the provided OTP
  v_otp_hash := encode(sha256(p_otp::bytea), 'hex');

  -- Verify OTP matches
  IF v_otp_hash = v_tenancy.landlord_otp_hash THEN
    -- Mark OTP as verified
    UPDATE tenancies SET
      landlord_otp_verified = true,
      landlord_otp_hash = NULL, -- Clear the OTP
      landlord_otp_expires_at = NULL,
      updated_at = NOW()
    WHERE id = p_tenancy_id;

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON COLUMN tenancies.landlord_approval_token IS 'Secure token for landlord approval URL';
COMMENT ON COLUMN tenancies.landlord_otp_hash IS 'SHA-256 hash of landlord OTP for verification';
COMMENT ON COLUMN tenancies.landlord_otp_attempts IS 'Number of OTP generation attempts (rate limiting)';
COMMENT ON FUNCTION generate_landlord_otp IS 'Generates a 6-digit OTP for landlord verification';
COMMENT ON FUNCTION verify_landlord_otp IS 'Verifies landlord OTP and marks as verified';
