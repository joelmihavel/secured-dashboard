-- Auth Rate Limiting: Add attempt_count and ip_address columns + helper RPCs
-- Required for: S1 (rate limiting), S2 (atomic verify), B6 (listUsers replacement)

-- 1. Add attempt_count and ip_address to otp_requests
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 2. RPC for atomic attempt increment (returns new count)
CREATE OR REPLACE FUNCTION increment_otp_attempt(req_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE otp_requests SET attempt_count = attempt_count + 1
  WHERE id = req_id
  RETURNING attempt_count;
$$;

-- 3. RPC for auth user lookup by phone (replaces unpaginated listUsers)
CREATE OR REPLACE FUNCTION get_auth_user_by_phone(p_phone TEXT)
RETURNS TABLE(id UUID, phone TEXT, email TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, phone, email FROM auth.users WHERE phone = p_phone LIMIT 1;
$$;

-- 4. Indexes for rate limit queries
CREATE INDEX IF NOT EXISTS idx_otp_requests_phone_created
  ON otp_requests(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_requests_ip_created
  ON otp_requests(ip_address, created_at);
