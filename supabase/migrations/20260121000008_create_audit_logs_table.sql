-- Flent Secured v2 - Migration: Create Audit Logs Table
-- Comprehensive audit trail for compliance and debugging

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN (
    'user', -- Normal user action
    'system', -- Automated system action (cron, webhook)
    'admin', -- Admin/support action
    'service' -- External service callback
  )),

  -- What action was performed
  action TEXT NOT NULL, -- e.g., 'PAYMENT_INITIATED', 'BANK_VERIFIED'
  action_category TEXT NOT NULL CHECK (action_category IN (
    'auth', -- Login, logout, OTP
    'payment', -- Payment related
    'verification', -- Bank, identity, utility verification
    'tenancy', -- Tenancy CRUD
    'profile', -- Profile updates
    'landlord', -- Landlord actions
    'cashback', -- Cashback operations
    'notification', -- Notifications sent
    'system', -- System events
    'security' -- Security events
  )),

  -- What entity was affected
  entity_type TEXT, -- e.g., 'payment', 'tenancy', 'bank_account'
  entity_id UUID,

  -- Action details
  details JSONB, -- Flexible storage for action-specific data
  old_values JSONB, -- Previous state for updates
  new_values JSONB, -- New state for updates

  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT, -- Correlation ID for tracing

  -- Edge function context
  function_name TEXT, -- e.g., 'initiate-payment'
  function_version TEXT,

  -- Result
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'partial')),
  error_code TEXT,
  error_message TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_category ON audit_logs(action_category);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_audit_logs_status ON audit_logs(status) WHERE status != 'success';

-- Partition by month for better query performance (optional, enable for high volume)
-- Note: Uncomment and adjust for production if needed
-- CREATE TABLE audit_logs_y2026m01 PARTITION OF audit_logs
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Helper function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_actor_type TEXT,
  p_action TEXT,
  p_action_category TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_function_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id, actor_type, action, action_category,
    entity_type, entity_id, details, old_values, new_values,
    ip_address, user_agent, request_id, function_name,
    status, error_code, error_message
  )
  VALUES (
    p_user_id, p_actor_type, p_action, p_action_category,
    p_entity_type, p_entity_id, p_details, p_old_values, p_new_values,
    p_ip_address, p_user_agent, p_request_id, p_function_name,
    p_status, p_error_code, p_error_message
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all significant system events';
COMMENT ON COLUMN audit_logs.details IS 'Action-specific data not captured in other columns';
COMMENT ON COLUMN audit_logs.request_id IS 'Correlation ID for tracing across services';
