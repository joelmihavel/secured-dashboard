-- Fix dev schema: add missing RPCs, columns, and constraints
-- This migration makes dev DB compatible with the latest auth-otp edge function

-- 1. Add missing columns to otp_requests (IF NOT EXISTS = safe to re-run)
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 2. Create missing RPC: atomic attempt increment
CREATE OR REPLACE FUNCTION increment_otp_attempt(req_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE otp_requests SET attempt_count = attempt_count + 1
  WHERE id = req_id
  RETURNING attempt_count;
$$;

-- 3. Create missing RPC: auth user lookup by phone
CREATE OR REPLACE FUNCTION get_auth_user_by_phone(p_phone TEXT)
RETURNS TABLE(id UUID, phone TEXT, email TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, phone, email FROM auth.users WHERE phone = p_phone LIMIT 1;
$$;

-- 4. Indexes for rate limit queries (IF NOT EXISTS = safe)
CREATE INDEX IF NOT EXISTS idx_otp_requests_phone_created
  ON otp_requests(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_requests_ip_created
  ON otp_requests(ip_address, created_at);

-- 5. Expire legacy provider records and add constraint for new inserts only
UPDATE otp_requests SET status = 'expired'
WHERE provider IN ('twilio', 'demo') AND status = 'pending';

ALTER TABLE otp_requests
  DROP CONSTRAINT IF EXISTS otp_requests_provider_check;
ALTER TABLE otp_requests
  ADD CONSTRAINT otp_requests_provider_check
  CHECK (provider IN ('cashfree_m360')) NOT VALID;

-- 6. Direct user_id RLS policy for payments realtime
DROP POLICY IF EXISTS payments_user_direct_select ON payments;
CREATE POLICY payments_user_direct_select ON payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 7. Netbanking banks table (idempotent)
CREATE TABLE IF NOT EXISTS netbanking_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  short_name TEXT,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 999,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'netbanking_banks_code_key') THEN
    ALTER TABLE netbanking_banks ADD CONSTRAINT netbanking_banks_code_key UNIQUE (bank_code);
  END IF;
END $$;

ALTER TABLE netbanking_banks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read netbanking banks" ON netbanking_banks;
CREATE POLICY "Anyone can read netbanking banks" ON netbanking_banks
  FOR SELECT USING (true);
