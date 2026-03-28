-- Convenience fee billing: Flent bills convenience fees in Cashfree order amount
-- PayU continues to charge fees separately (pg_billed model)

-- 1. Payments table: track convenience fee and billing model
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS convenience_fee_paise BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_billing_model TEXT NOT NULL DEFAULT 'pg_billed';

COMMENT ON COLUMN payments.convenience_fee_paise IS 'Convenience fee charged by Flent, included in total_amount_paise when fee_billing_model=included. 0 for UPI or pg_billed model.';
COMMENT ON COLUMN payments.fee_billing_model IS 'pg_billed = PG charges fee separately (PayU). included = fee baked into order_amount (Cashfree).';

-- 2. Fee config: add gateway column for per-gateway rates
ALTER TABLE fee_config ADD COLUMN IF NOT EXISTS gateway TEXT NOT NULL DEFAULT 'default';

-- Drop old unique constraint on method (one rate per method)
ALTER TABLE fee_config DROP CONSTRAINT IF EXISTS fee_config_method_key;

-- Add composite unique: one rate per (method, gateway)
ALTER TABLE fee_config ADD CONSTRAINT fee_config_method_gateway_key UNIQUE (method, gateway);

-- 3. Seed Cashfree-specific rates (from Cashfree merchant agreement)
-- These are Flent's convenience fees — controllable via DB updates
INSERT INTO fee_config (method, rate, fee_type, gateway, is_active) VALUES
  ('upi',         0,    'percentage', 'cashfree', true),
  ('credit_card', 0.02, 'percentage', 'cashfree', true),
  ('debit_card',  0.009,'percentage', 'cashfree', true),
  ('netbanking',  1500, 'flat_paise', 'cashfree', true)
ON CONFLICT (method, gateway) DO NOTHING;
