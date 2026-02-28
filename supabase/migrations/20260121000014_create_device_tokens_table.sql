-- Flent Secured v2 - Migration: Device Tokens Table
-- Stores push notification tokens for mobile devices
-- Made idempotent for v2→main merge (table may already exist)

-- ==============================================
-- TABLE: device_tokens
-- ==============================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  device_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  bundle_id TEXT,
  sandbox BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns that may not exist on a pre-existing table
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS bundle_id TEXT;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS sandbox BOOLEAN DEFAULT false;

-- ==============================================
-- INDEXES
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active ON device_tokens(user_id)
  WHERE is_active = true;

DO $$ BEGIN
  CREATE UNIQUE INDEX idx_device_tokens_unique ON device_tokens(token, platform);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_device_tokens_last_used ON device_tokens(last_used_at)
  WHERE is_active = true;

-- ==============================================
-- TRIGGER: Update updated_at timestamp
-- ==============================================

DROP TRIGGER IF EXISTS update_device_tokens_timestamp ON device_tokens;
CREATE TRIGGER update_device_tokens_timestamp
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- FUNCTION: Register or update device token
-- ==============================================

CREATE OR REPLACE FUNCTION register_device_token(
  p_user_id UUID,
  p_token TEXT,
  p_platform TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_bundle_id TEXT DEFAULT NULL,
  p_sandbox BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_token_id UUID;
BEGIN
  INSERT INTO device_tokens (
    user_id, token, platform, device_id, device_name, bundle_id, sandbox, last_used_at
  ) VALUES (
    p_user_id, p_token, p_platform, p_device_id, p_device_name, p_bundle_id, p_sandbox, NOW()
  )
  ON CONFLICT (token, platform) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    device_id = COALESCE(EXCLUDED.device_id, device_tokens.device_id),
    device_name = COALESCE(EXCLUDED.device_name, device_tokens.device_name),
    bundle_id = COALESCE(EXCLUDED.bundle_id, device_tokens.bundle_id),
    sandbox = EXCLUDED.sandbox,
    is_active = true,
    last_used_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNCTION: Deactivate device token
-- ==============================================

CREATE OR REPLACE FUNCTION deactivate_device_token(
  p_token TEXT,
  p_platform TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE device_tokens
  SET is_active = false, updated_at = NOW()
  WHERE token = p_token
    AND (p_platform IS NULL OR platform = p_platform);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNCTION: Get user's active device tokens
-- ==============================================

CREATE OR REPLACE FUNCTION get_user_device_tokens(p_user_id UUID)
RETURNS TABLE (
  token TEXT,
  platform TEXT,
  sandbox BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT dt.token, dt.platform, dt.sandbox
  FROM device_tokens dt
  WHERE dt.user_id = p_user_id
    AND dt.is_active = true
  ORDER BY dt.last_used_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- RLS POLICIES
-- ==============================================

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY device_tokens_select ON device_tokens
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY device_tokens_insert ON device_tokens
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY device_tokens_update ON device_tokens
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY device_tokens_delete ON device_tokens
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY device_tokens_service_all ON device_tokens
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE device_tokens IS 'Stores push notification tokens for mobile and web devices';
COMMENT ON COLUMN device_tokens.token IS 'FCM registration token or APNs device token';
COMMENT ON COLUMN device_tokens.sandbox IS 'iOS only: true for sandbox/development, false for production';
COMMENT ON FUNCTION register_device_token IS 'Upserts a device token, reactivating if previously deactivated';
COMMENT ON FUNCTION deactivate_device_token IS 'Marks a device token as inactive (e.g., on logout or token invalidation)';
