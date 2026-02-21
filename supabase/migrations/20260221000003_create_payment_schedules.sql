-- Flent Secured v2 - Migration: Create payment_schedules table
-- Stores auto-pay / scheduled payment configurations per user+tenancy

CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('upi', 'card', 'netbanking', 'wallet')),
  scheduled_day INTEGER NOT NULL CHECK (scheduled_day BETWEEN 1 AND 28),
  auto_apply_cashback BOOLEAN DEFAULT false,
  upi_vpa TEXT,
  card_token TEXT,
  bank_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  next_execution_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only one active schedule per user+tenancy
CREATE UNIQUE INDEX idx_one_active_schedule_per_tenancy
  ON payment_schedules(user_id, tenancy_id)
  WHERE status = 'active';

-- General lookup indexes
CREATE INDEX idx_payment_schedules_user ON payment_schedules(user_id);
CREATE INDEX idx_payment_schedules_tenancy ON payment_schedules(tenancy_id);
CREATE INDEX idx_payment_schedules_next_exec ON payment_schedules(next_execution_date)
  WHERE status = 'active';

-- RLS
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules" ON payment_schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules" ON payment_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules" ON payment_schedules
  FOR UPDATE USING (auth.uid() = user_id);

-- Reuse the existing update_updated_at_column() function from users table migration
CREATE TRIGGER update_payment_schedules_timestamp
  BEFORE UPDATE ON payment_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payment_schedules IS 'Auto-pay / scheduled payment configurations';
COMMENT ON COLUMN payment_schedules.scheduled_day IS 'Day of month to execute payment (1-28)';
COMMENT ON COLUMN payment_schedules.auto_apply_cashback IS 'Whether to auto-apply available cashback to scheduled payments';
