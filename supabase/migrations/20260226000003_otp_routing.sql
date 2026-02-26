-- ==============================================
-- OTP Routing: Server-side state for unified auth
-- ==============================================

-- 1. OTP Requests table (server-side state for routing decisions)
CREATE TABLE IF NOT EXISTS otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('twilio', 'cashfree_m360')),
  verification_id TEXT,           -- Twilio SID or Cashfree verification_id
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  client_ip TEXT
);

-- Index for routing lookups: find latest pending request for a phone
CREATE INDEX idx_otp_requests_phone ON otp_requests(phone, status, created_at DESC);

-- Auto-expire stale OTP requests (run every 5 minutes)
-- Marks pending requests older than their expires_at as expired
SELECT cron.schedule(
  'expire-stale-otp-requests',
  '*/5 * * * *',
  $$UPDATE otp_requests SET status = 'expired' WHERE status = 'pending' AND expires_at < now()$$
);

-- 2. m360_status on users table (routing lookup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'm360_status'
  ) THEN
    ALTER TABLE users ADD COLUMN m360_status TEXT DEFAULT NULL
      CHECK (m360_status IN ('pending', 'fetched', 'not_available', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'm360_status_updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN m360_status_updated_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Partial index: only non-null rows participate in routing queries
CREATE INDEX IF NOT EXISTS idx_users_m360_status ON users(m360_status) WHERE m360_status IS NOT NULL;

-- 3. Backfill m360_status from existing identity_verifications (priority-ordered, idempotent)

-- First: users with successful M360 verification → 'fetched'
UPDATE users u SET m360_status = 'fetched', m360_status_updated_at = iv.verified_at
FROM (
  SELECT DISTINCT ON (user_id) user_id, verified_at
  FROM identity_verifications
  WHERE status = 'SUCCESS' AND user_id IS NOT NULL
  ORDER BY user_id, created_at DESC
) iv WHERE u.id = iv.user_id AND u.m360_status IS NULL;

-- Second: users with DETAILS_NOT_FOUND → 'not_available'
UPDATE users u SET m360_status = 'not_available', m360_status_updated_at = iv.created_at
FROM (
  SELECT DISTINCT ON (user_id) user_id, created_at
  FROM identity_verifications
  WHERE status = 'DETAILS_NOT_FOUND' AND user_id IS NOT NULL
  ORDER BY user_id, created_at DESC
) iv WHERE u.id = iv.user_id AND u.m360_status IS NULL;

-- 4. RLS policies for otp_requests
ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (edge functions use service role)
CREATE POLICY "Service role full access on otp_requests"
  ON otp_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users cannot directly access otp_requests (all access goes through edge functions)
-- No user-facing policy needed
