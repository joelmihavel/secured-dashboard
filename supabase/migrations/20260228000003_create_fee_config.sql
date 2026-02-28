-- ==============================================
-- Fee Config — Dynamic payment gateway fee rates
-- ==============================================
-- Replaces hardcoded env vars with a DB table for easier updates.
-- Public read via edge function, admin write only.

CREATE TABLE IF NOT EXISTS fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  fee_type TEXT DEFAULT 'percentage',
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fee_config ADD CONSTRAINT fee_config_method_key UNIQUE (method);

-- RLS: service role only (edge functions use service client)
ALTER TABLE fee_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read fee config" ON fee_config
  FOR SELECT USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_fee_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fee_config_updated_at
  BEFORE UPDATE ON fee_config
  FOR EACH ROW
  EXECUTE FUNCTION update_fee_config_timestamp();

-- Seed with current values
INSERT INTO fee_config (method, rate) VALUES
  ('upi', 0),
  ('credit_card', 0.02),
  ('debit_card', 0.02),
  ('netbanking', 0.015)
ON CONFLICT (method) DO UPDATE SET
  rate = EXCLUDED.rate;
