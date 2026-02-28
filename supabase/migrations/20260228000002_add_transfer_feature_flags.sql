-- Flent Secured v2 - Migration: Landlord Transfer Feature Flags
-- Two-layer flag system to pause Flent → Landlord transfers:
--   1. System-level: app_config row 'landlord_transfers' (pause ALL transfers globally)
--   2. Transaction-level: payments.transfer_hold column (hold a specific payment)
-- Also fixes CHECK constraint on landlord_payout_status (missing 'ready' + new 'held')

-- ==============================================
-- 1. System-level flag in app_config
-- ==============================================

INSERT INTO app_config (key, value) VALUES
  ('landlord_transfers', '{"enabled":true,"disabled_at":null,"disabled_by":null,"reason":null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ==============================================
-- 2. Transaction-level hold columns on payments
-- ==============================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS transfer_hold BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transfer_hold_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transfer_hold_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transfer_hold_by TEXT;

-- ==============================================
-- 3. Fix CHECK constraint: add missing 'ready' + new 'held'
-- ==============================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_landlord_payout_status_check') THEN
    ALTER TABLE payments DROP CONSTRAINT payments_landlord_payout_status_check;
  END IF;
END $$;
ALTER TABLE payments ADD CONSTRAINT payments_landlord_payout_status_check
  CHECK (landlord_payout_status IN ('pending', 'ready', 'held', 'processing', 'settled', 'failed'));

-- ==============================================
-- 4. Indexes for held payment queries
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_payments_transfer_held
  ON payments(landlord_payout_status) WHERE landlord_payout_status = 'held';
CREATE INDEX IF NOT EXISTS idx_payments_transfer_hold
  ON payments(transfer_hold) WHERE transfer_hold = true;

-- ==============================================
-- 5. Audit trigger on app_config changes (RBI PA/PG compliance)
-- ==============================================

CREATE OR REPLACE FUNCTION audit_app_config_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action, action_category, entity_type,
    old_values, new_values, actor_type, function_name,
    details, created_at
  ) VALUES (
    'APP_CONFIG_CHANGED', 'system', 'app_config',
    jsonb_build_object('value', OLD.value),
    jsonb_build_object('value', NEW.value),
    'service',
    coalesce(current_setting('app.current_function', true), 'sql_editor'),
    jsonb_build_object('config_key', NEW.key),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_app_config ON app_config;
CREATE TRIGGER trigger_audit_app_config
  AFTER UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION audit_app_config_change();
