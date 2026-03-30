-- Session Tracking & Token Revocation
--
-- Adds server-side session management for:
-- 1. Session revocation (force-logout stolen devices)
-- 2. Token blacklist (invalidate old tokens after re-auth)
-- 3. Concurrent session visibility
--
-- These tables are checked by edge functions via createAuthenticatedClient()
-- when validating JWT tokens.

-- ==============================================
-- ACTIVE SESSIONS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- JWT "jti" claim (unique token identifier). Null for legacy sessions
  -- created before this migration.
  token_jti TEXT,
  -- Device metadata for "manage sessions" UI
  device_info TEXT,
  ip_address INET,
  user_agent TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  -- Revocation
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT
);

-- Indexes for hot-path queries
CREATE INDEX idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX idx_active_sessions_token_jti ON public.active_sessions(token_jti) WHERE token_jti IS NOT NULL;
CREATE INDEX idx_active_sessions_expires ON public.active_sessions(expires_at) WHERE NOT is_revoked;

-- ==============================================
-- REVOKED TOKENS TABLE
-- ==============================================
-- Lightweight blacklist checked during token validation.
-- Entries auto-expire via cleanup cron (tokens are short-lived anyway).

CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  -- Auto-cleanup: no need to keep entries for tokens that already expired
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_revoked_tokens_user_id ON public.revoked_tokens(user_id);
CREATE INDEX idx_revoked_tokens_expires ON public.revoked_tokens(expires_at);

-- ==============================================
-- RLS POLICIES
-- ==============================================

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;

-- Users can see their own sessions (for "manage sessions" UI)
CREATE POLICY "Users can view own sessions"
  ON public.active_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update/delete sessions
CREATE POLICY "Service role manages sessions"
  ON public.active_sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Revoked tokens: service role only (edge functions check via service client)
CREATE POLICY "Service role manages revoked tokens"
  ON public.revoked_tokens FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ==============================================
-- CLEANUP CRON: Remove expired sessions and tokens
-- ==============================================
-- Runs daily at 3 AM UTC. Keeps the tables lean.

SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 3 * * *',
  $$
    DELETE FROM public.active_sessions
    WHERE expires_at < NOW() - INTERVAL '1 day';

    DELETE FROM public.revoked_tokens
    WHERE expires_at < NOW();
  $$
);

-- ==============================================
-- HELPER: Revoke all sessions for a user (called on re-auth)
-- ==============================================

CREATE OR REPLACE FUNCTION public.revoke_all_user_sessions(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'Re-authenticated'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark all active sessions as revoked
  UPDATE public.active_sessions
  SET is_revoked = true,
      revoked_at = NOW(),
      revocation_reason = p_reason
  WHERE user_id = p_user_id
    AND NOT is_revoked;

  -- Blacklist all tokens from those sessions
  INSERT INTO public.revoked_tokens (jti, user_id, reason, expires_at)
  SELECT token_jti, user_id, p_reason, NOW() + INTERVAL '24 hours'
  FROM public.active_sessions
  WHERE user_id = p_user_id
    AND token_jti IS NOT NULL
    AND revoked_at = NOW()  -- Just-revoked sessions
  ON CONFLICT (jti) DO NOTHING;
END;
$$;
