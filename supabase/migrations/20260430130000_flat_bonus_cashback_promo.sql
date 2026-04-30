-- Flent Secured v2 — Flat ₹1000 Cashback Promo
--
-- Adds a one-shot per-user promotional cashback layered on top of the existing
-- 1% instant discount. Eligibility is gated on the same cutoff day as 1%, runs
-- only within a configured promo rent_month (env: FLAT_BONUS_PROMO_MONTH), and
-- is awarded once-ever per user.
--
-- Reservation model:
--   * users.flat_bonus_claimed_at — atomic claim marker, set at initiate time
--   * users.flat_bonus_claimed_payment_id — links reservation to a payment so
--     a payment-failed trigger can release it without releasing some OTHER
--     concurrent payment's reservation.
--   * On payment success: reservation stays + 'flat_bonus' ledger row written
--     by webhook for audit. (No re-claim — once-ever.)
--   * On payment failure / stale-cleanup: trigger clears the marker, user can
--     try again. The ledger row never existed (only written on success), so
--     no reversal needed.
--   * On post-success refund: marker stays — user has consumed their once-
--     ever bonus even if the rent itself was refunded. (Per spec: once ever.)

BEGIN;

-- 1. Per-payment breakdown of how much of cashback came from the flat bonus
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS flat_bonus_paise BIGINT NOT NULL DEFAULT 0
    CHECK (flat_bonus_paise >= 0);

COMMENT ON COLUMN payments.flat_bonus_paise IS
  'Portion of cashback_applied_paise that came from the flat ₹1000 promo bonus. '
  'cashback_applied_paise still equals total cashback (1% + flat); this column '
  'is the breakdown used by the receipt UI.';

-- 2. Once-ever flat-bonus claim marker on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS flat_bonus_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flat_bonus_claimed_payment_id UUID
    REFERENCES payments(id) ON DELETE SET NULL;

COMMENT ON COLUMN users.flat_bonus_claimed_at IS
  'When the user first reserved the once-ever ₹1000 flat-bonus discount. '
  'NULL = never claimed (or last claim was released by payment failure). '
  'Non-NULL = either reserved-in-flight or consumed (see flat_bonus_claimed_payment_id).';

COMMENT ON COLUMN users.flat_bonus_claimed_payment_id IS
  'Payment that holds the current reservation. The release trigger only clears '
  'the reservation if the failing payment matches — prevents one failure from '
  'releasing a different concurrent payment''s reservation.';

-- 3. Allow 'flat_bonus' as a cashback_ledger transaction_type. Re-creates the
--    constraint to include the full set of types currently in use across the
--    code base (matching 20260225000001_cashback_instant_discount.sql plus the
--    'reinstatement' type added by the refund handler).
ALTER TABLE cashback_ledger
  DROP CONSTRAINT IF EXISTS cashback_ledger_transaction_type_check;

ALTER TABLE cashback_ledger
  ADD CONSTRAINT cashback_ledger_transaction_type_check CHECK (transaction_type IN (
    'earned',
    'applied',
    'expired',
    'bonus',
    'adjustment',
    'reversal',
    'discount',
    'referral_bonus',
    'promotional',
    'reinstatement',
    'flat_bonus'
  ));

-- 4. Allow total_amount_paise = 0. The flat ₹1000 bonus can fully cover rent
--    in test-user scenarios (₹10 demo rent), where the demo branch records the
--    payment as success without hitting a real gateway. Real-flow keeps a ₹1
--    floor inside initiate-payment so Cashfree always has a non-zero amount.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_total_amount_paise_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_total_amount_paise_check CHECK (total_amount_paise >= 0);

-- 5. Release-on-failure trigger. When a payment that consumed the flat bonus
--    transitions from a non-terminal state ('initiated' or 'processing') to
--    'failed', release the reservation so the user can try again. Refunds
--    (success → refunded) do NOT release — the bonus has been consumed.
CREATE OR REPLACE FUNCTION release_flat_bonus_on_payment_failed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed'
     AND OLD.status IN ('initiated', 'processing')
     AND COALESCE(NEW.flat_bonus_paise, 0) > 0
     AND NEW.user_id IS NOT NULL
  THEN
    UPDATE users
       SET flat_bonus_claimed_at = NULL,
           flat_bonus_claimed_payment_id = NULL
     WHERE id = NEW.user_id
       AND flat_bonus_claimed_payment_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_release_flat_bonus_on_failure ON payments;

CREATE TRIGGER trg_release_flat_bonus_on_failure
  AFTER UPDATE OF status ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'failed' AND OLD.status IN ('initiated', 'processing'))
  EXECUTE FUNCTION release_flat_bonus_on_payment_failed();

COMMIT;
