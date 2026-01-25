-- =============================================================================
-- Migration: Fix identity_verifications for Twilio Verify + Cashfree Mobile 360 flow
--
-- Changes:
-- 1. Adds missing status values (OTP_SENT, OTP_EXPIRED, OTP_INVALID, CONSENT_GIVEN)
-- 2. Makes user_id nullable for pending consent records (before user is created)
-- 3. Adds consent_phone to track phone number for pending consent
-- 4. Adds OTP tracking columns for compliance and retry logic
-- =============================================================================

-- Drop the existing constraint
ALTER TABLE identity_verifications
  DROP CONSTRAINT IF EXISTS identity_verifications_status_check;

-- Add updated constraint with all statuses
ALTER TABLE identity_verifications
  ADD CONSTRAINT identity_verifications_status_check
  CHECK (status IN (
    'SUCCESS',
    'DETAILS_NOT_FOUND',
    'PENDING',
    'FAILED',
    'OTP_SENT',          -- When OTP has been sent, awaiting verification
    'OTP_EXPIRED',       -- When OTP has expired
    'OTP_INVALID',       -- When wrong OTP entered too many times
    'CONSENT_GIVEN'      -- When user has consented via Twilio auth OTP
  ));

-- Make user_id nullable for pending consent records (before auth)
ALTER TABLE identity_verifications
  ALTER COLUMN user_id DROP NOT NULL;

-- Add column for tracking consent phone (for pending records without user_id)
ALTER TABLE identity_verifications
  ADD COLUMN IF NOT EXISTS consent_phone VARCHAR(15);

-- Add columns for OTP consent tracking (for compliance)
ALTER TABLE identity_verifications
  ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip INET,
  ADD COLUMN IF NOT EXISTS otp_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0;

-- Add index for faster lookups by status
CREATE INDEX IF NOT EXISTS idx_identity_verifications_status
  ON identity_verifications(status);

-- Add index for looking up pending OTP verifications by phone
CREATE INDEX IF NOT EXISTS idx_identity_verifications_consent_phone
  ON identity_verifications(consent_phone, status)
  WHERE consent_phone IS NOT NULL;

-- Add index for looking up pending OTP verifications by user
CREATE INDEX IF NOT EXISTS idx_identity_verifications_otp_pending
  ON identity_verifications(user_id, status)
  WHERE status IN ('OTP_SENT', 'CONSENT_GIVEN');

-- Function to increment OTP attempts
CREATE OR REPLACE FUNCTION increment_otp_attempts(p_phone VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  v_attempts INTEGER;
BEGIN
  UPDATE identity_verifications
  SET otp_attempts = otp_attempts + 1
  WHERE consent_phone = p_phone AND status = 'OTP_SENT'
  RETURNING otp_attempts INTO v_attempts;

  RETURN COALESCE(v_attempts, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON COLUMN identity_verifications.status IS
  'Verification status: OTP_SENT (awaiting OTP), CONSENT_GIVEN (Twilio OTP verified, can call Mobile 360), SUCCESS (M360 data retrieved), DETAILS_NOT_FOUND, FAILED, OTP_EXPIRED, OTP_INVALID';

COMMENT ON COLUMN identity_verifications.consent_phone IS
  'Phone number for pending consent records (before user account exists)';

COMMENT ON COLUMN identity_verifications.consent_timestamp IS
  'Timestamp when user gave consent for Mobile 360 verification (compliance requirement)';

COMMENT ON COLUMN identity_verifications.consent_ip IS
  'IP address from which consent was given (compliance requirement)';
