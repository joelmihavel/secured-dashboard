-- Flent Secured v2 - Migration: Add two-tier settlement/payout tracking
-- Tier 1: PayU settlement (PayU settles to Flent's account)
-- Tier 2: Landlord payout (Flent disburses to landlord's bank account)
-- This separates the existing single-tier settlement into a proper two-tier flow.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payu_settlement_status TEXT DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payu_settlement_utr TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payu_settled_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS landlord_payout_status TEXT DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS landlord_payout_paise BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS landlord_payout_utr TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS landlord_payout_at TIMESTAMPTZ;

-- Add check constraints for status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_payu_settlement_status_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_payu_settlement_status_check
      CHECK (payu_settlement_status IN ('pending', 'processing', 'settled', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_landlord_payout_status_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_landlord_payout_status_check
      CHECK (landlord_payout_status IN ('pending', 'processing', 'settled', 'failed'));
  END IF;
END $$;

-- Index for settlement polling (find successful payments awaiting settlement)
CREATE INDEX IF NOT EXISTS idx_payments_payu_settlement_pending
  ON payments(payu_settlement_status)
  WHERE status = 'success' AND payu_settlement_status IN ('pending', 'processing');

-- Index for landlord payout processing
CREATE INDEX IF NOT EXISTS idx_payments_landlord_payout_pending
  ON payments(landlord_payout_status)
  WHERE payu_settlement_status = 'settled' AND landlord_payout_status IN ('pending', 'processing');

COMMENT ON COLUMN payments.payu_settlement_status IS 'Tier 1: PayU settlement to Flent account status';
COMMENT ON COLUMN payments.payu_settlement_utr IS 'UTR from PayU settlement to Flent';
COMMENT ON COLUMN payments.payu_settled_at IS 'When PayU settled funds to Flent';
COMMENT ON COLUMN payments.landlord_payout_status IS 'Tier 2: Flent payout to landlord bank account status';
COMMENT ON COLUMN payments.landlord_payout_paise IS 'Amount disbursed to landlord in paise (rent minus Flent commission)';
COMMENT ON COLUMN payments.landlord_payout_utr IS 'UTR from Flent payout to landlord';
COMMENT ON COLUMN payments.landlord_payout_at IS 'When Flent disbursed to landlord';
