-- Flent Secured v2 - Migration: Create Idempotency Keys Table
-- Prevents duplicate operations (especially payments)

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The idempotency key itself (client-provided or generated)
  key TEXT NOT NULL UNIQUE,

  -- Which user/endpoint this is for
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- e.g., 'initiate-payment', 'verify-bank'

  -- The request that was made
  request_hash TEXT NOT NULL, -- SHA256 of request body for validation
  request_body JSONB, -- Stored request for debugging

  -- The response that was returned
  response_status INTEGER,
  response_body JSONB,

  -- State
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Timestamps and TTL
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Lock for concurrent request handling
  locked_at TIMESTAMPTZ,
  locked_by TEXT -- Instance ID that holds the lock
);

-- Indexes
CREATE INDEX idx_idempotency_keys_key ON idempotency_keys(key);
CREATE INDEX idx_idempotency_keys_user ON idempotency_keys(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_keys_pending ON idempotency_keys(status) WHERE status = 'pending';

-- Function to check and acquire idempotency lock
CREATE OR REPLACE FUNCTION acquire_idempotency_lock(
  p_key TEXT,
  p_user_id UUID,
  p_endpoint TEXT,
  p_request_hash TEXT,
  p_request_body JSONB,
  p_instance_id TEXT DEFAULT gen_random_uuid()::TEXT
)
RETURNS TABLE (
  acquired BOOLEAN,
  existing_response JSONB,
  existing_status INTEGER
) AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Try to find existing key
  SELECT ik.status, ik.response_body, ik.response_status, ik.request_hash
  INTO v_existing
  FROM idempotency_keys ik
  WHERE ik.key = p_key
    AND ik.expires_at > NOW()
  FOR UPDATE SKIP LOCKED;

  -- If found and completed, return cached response
  IF FOUND AND v_existing.status = 'completed' THEN
    -- Validate request hash matches
    IF v_existing.request_hash != p_request_hash THEN
      RAISE EXCEPTION 'Idempotency key reused with different request body';
    END IF;

    RETURN QUERY SELECT FALSE, v_existing.response_body, v_existing.response_status;
    RETURN;
  END IF;

  -- If found and processing, return locked state
  IF FOUND AND v_existing.status IN ('pending', 'processing') THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, NULL::INTEGER;
    RETURN;
  END IF;

  -- Insert new key
  INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash, request_body, status, locked_at, locked_by)
  VALUES (p_key, p_user_id, p_endpoint, p_request_hash, p_request_body, 'processing', NOW(), p_instance_id)
  ON CONFLICT (key) DO NOTHING;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, NULL::JSONB, NULL::INTEGER;
  ELSE
    -- Another process inserted, retry
    RETURN QUERY SELECT FALSE, NULL::JSONB, NULL::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to complete idempotency record
CREATE OR REPLACE FUNCTION complete_idempotency(
  p_key TEXT,
  p_status INTEGER,
  p_response JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE idempotency_keys
  SET
    status = 'completed',
    response_status = p_status,
    response_body = p_response,
    completed_at = NOW(),
    locked_at = NULL,
    locked_by = NULL
  WHERE key = p_key;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE idempotency_keys IS 'Ensures exactly-once processing for critical operations';
COMMENT ON COLUMN idempotency_keys.request_hash IS 'SHA256 hash to detect key reuse with different requests';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Keys expire after 24h to prevent unbounded growth';
