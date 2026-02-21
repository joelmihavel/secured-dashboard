-- Flent Secured v2 - Migration: Add card expiry and nickname to payment_methods
-- Adds structured expiry fields (month/year integers) and a user-defined nickname

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS card_expiry_month INTEGER;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS card_expiry_year INTEGER;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Validate expiry month is 1-12 when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_methods_card_expiry_month_check'
  ) THEN
    ALTER TABLE payment_methods
      ADD CONSTRAINT payment_methods_card_expiry_month_check
      CHECK (card_expiry_month IS NULL OR (card_expiry_month >= 1 AND card_expiry_month <= 12));
  END IF;
END $$;

-- Validate expiry year is reasonable (2024-2050)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_methods_card_expiry_year_check'
  ) THEN
    ALTER TABLE payment_methods
      ADD CONSTRAINT payment_methods_card_expiry_year_check
      CHECK (card_expiry_year IS NULL OR (card_expiry_year >= 2024 AND card_expiry_year <= 2050));
  END IF;
END $$;

COMMENT ON COLUMN payment_methods.card_expiry_month IS 'Card expiry month (1-12) for structured expiry tracking';
COMMENT ON COLUMN payment_methods.card_expiry_year IS 'Card expiry year (4-digit) for structured expiry tracking';
COMMENT ON COLUMN payment_methods.nickname IS 'User-defined friendly name for this payment method';
