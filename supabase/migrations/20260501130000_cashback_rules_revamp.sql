-- Flent Secured v2 — Cashback Rules Revamp
--
-- Locks in the instant-discount-only model and decommissions all
-- accumulation-era machinery. Specifically:
--
--   1. Adds an `app_config` row driving the flat ₹1000 promo (realtime
--      kill switch + per-month + amount-threshold gating). Replaces the
--      env-var-based FLAT_BONUS_PROMO_MONTH / FLAT_BONUS_AMOUNT_PAISE
--      constants previously read at edge function module load time.
--   2. Fixes `sync_cashback_balance` to credit `'reinstatement'`.
--      The type was added to the constraint in 20260430130000 but
--      never wired into the balance trigger — refund-fail recovery
--      and settlement-fail auto-refund weren't actually crediting
--      users back. (Bug B3.)
--   3. Fixes `auto_reverse_cashback_on_refund` to stop generating
--      `'reversal'` rows for the audit-only `'discount'` entries.
--      A reversal of a discount was being treated as a wallet debit,
--      silently reducing balances on refund. (Bug B2.)
--   4. Stops `apply_referral_code` from writing `'referral_bonus'` ledger
--      rows. Accumulation is being decommissioned; referrals will be
--      paid through a separate mechanism if/when needed. The function
--      still records the redemption (`referral_redemptions` row +
--      `users.referral_code_id`); only the wallet credit is dropped.
--      (Source of bug B5.)
--   5. Drains the single legacy outlier wallet (₹330 on prod) via an
--      `'adjustment'` debit. Verified on production: exactly one user
--      has `cashback_balance_paise > 0` from a single legacy `'earned'`
--      row dated 2026-03-06. The pay-out itself is handled out-of-band
--      (manual UPI / next-payment discount); this migration only zeros
--      the ledger so the field can stop being read.
--   6. Adds the partial unique index for `'flat_bonus'` to match the
--      one already in place for `'discount'` and `'earned'`. Defends
--      against duplicate webhook deliveries inserting two flat_bonus
--      rows for the same payment. (Bug A7.)
--   7. Drops the once-ever-per-user reservation columns + trigger
--      (`users.flat_bonus_claimed_at`, `flat_bonus_claimed_payment_id`,
--      `release_flat_bonus_on_payment_failed`). The new model gates
--      on (a) the `app_config.flat_bonus_promo` flag, (b) per-(user,
--      rent_month) uniqueness via a payments lookup. No need for a
--      reservation row.
--
-- @safe-destructive: column drops in section 7 are destructive but the
--   columns are decommissioned by this same migration. RPC + reservation
--   logic that reads them is removed in the corresponding edge-function
--   PR (deployed alongside this migration).

BEGIN;

-- ============================================================================
-- 1. app_config row + helper for the flat ₹1000 promo
-- ============================================================================
--
-- Shape:
--   {
--     "enabled":           bool,            // master kill switch
--     "rent_month":        "YYYY-MM" | null, // promo applies only to this month
--     "amount_paise":      int,             // bonus value (₹1000 = 100000)
--     "min_payment_paise": int              // user's payment must be ≥ this
--   }
--
-- Defaults are OFF — admin must explicitly flip `enabled` to true.
-- A change to this row is visible to the next initiate-payment call,
-- bypassing the env-var propagation lag entirely.

INSERT INTO public.app_config (key, value, updated_at)
VALUES (
  'flat_bonus_promo',
  jsonb_build_object(
    'enabled',           false,
    'rent_month',        NULL,
    'amount_paise',      100000,    -- ₹1,000
    'min_payment_paise', 3000000    -- ₹30,000
  ),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- @security-definer: edge functions read this via service role; the helper
--   is exposed to service_role only so anonymous callers can't fingerprint
--   the promo schedule.
CREATE OR REPLACE FUNCTION public.get_flat_bonus_promo()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
DECLARE
  cfg JSONB;
BEGIN
  SELECT value INTO cfg FROM app_config WHERE key = 'flat_bonus_promo';
  IF cfg IS NULL THEN
    RETURN jsonb_build_object(
      'enabled',           false,
      'rent_month',        NULL,
      'amount_paise',      100000,
      'min_payment_paise', 3000000
    );
  END IF;
  RETURN cfg;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_flat_bonus_promo() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_flat_bonus_promo() TO service_role;

COMMENT ON FUNCTION public.get_flat_bonus_promo() IS
  'Returns the flat ₹1000 promo config. Read by initiate-payment per request '
  'so admin flag flips are picked up in real time. Toggle with '
  'UPDATE app_config SET value = jsonb_set(value, ''{enabled}'', ''true'') '
  'WHERE key = ''flat_bonus_promo''.';

-- ============================================================================
-- 2. sync_cashback_balance — credit 'reinstatement' (Bug B3)
-- ============================================================================
--
-- Note: 'discount' and 'flat_bonus' remain audit-only (not summed). Their
-- effect on the user is a smaller gateway charge, not a wallet credit.

CREATE OR REPLACE FUNCTION sync_cashback_balance()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  new_balance BIGINT;
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Credits: legacy earnings + bonuses + reinstatements (refund-fail recovery)
  -- Debits:  wallet redemption + reversals + expiry + manual adjustments
  -- Audit only (no balance impact): 'discount', 'flat_bonus'
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type IN ('earned', 'bonus', 'referral_bonus', 'promotional', 'reinstatement') THEN amount_paise
      WHEN transaction_type IN ('applied', 'expired', 'reversal', 'adjustment') THEN -amount_paise
      ELSE 0
    END
  ), 0) INTO new_balance
  FROM cashback_ledger
  WHERE user_id = target_user_id;

  UPDATE users SET cashback_balance_paise = GREATEST(new_balance, 0) WHERE id = target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. auto_reverse_cashback_on_refund — skip 'discount' rows (Bug B2)
-- ============================================================================
--
-- The 'discount' transaction_type is audit-only (it never credited the
-- wallet). Generating a 'reversal' for it on refund would silently debit
-- the user's wallet for value they never received. With the instant-
-- discount model, the user already paid (rent − discount) at the gateway;
-- on refund, they get back exactly that amount. There is nothing to
-- "reverse" against the wallet.
--
-- Legacy 'earned' rows still get reversed (they DID credit the wallet).

CREATE OR REPLACE FUNCTION auto_reverse_cashback_on_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
    v_user_id := NEW.user_id;

    -- Reverse legacy 'earned' entries only — those credited the wallet
    -- under the old accumulation model. 'discount' rows are audit-only
    -- and do not need reversal.
    IF EXISTS (
      SELECT 1 FROM cashback_ledger
      WHERE payment_id = NEW.id AND transaction_type = 'earned'
    ) THEN
      INSERT INTO cashback_ledger (
        user_id, transaction_type, amount_paise, balance_after_paise,
        payment_id, tenancy_id, reference_type, reference_id, description
      )
      SELECT
        v_user_id, 'reversal', amount_paise, 0,
        NEW.id, NEW.tenancy_id, 'payment', NEW.id,
        'Cashback reversed due to payment refund'
      FROM cashback_ledger
      WHERE payment_id = NEW.id AND transaction_type = 'earned';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. apply_referral_code — stop writing ledger rows (Bug B5 source)
-- ============================================================================
--
-- Accumulation is decommissioned. The referral code is still recorded
-- against the user (for funnel / attribution) but no wallet credit is
-- written. Reward delivery, if reintroduced, will go through the new
-- promo machinery (`app_config.flat_bonus_promo` style flag).

-- Drop and recreate to keep return-type stable (same signature as
-- 20260129200000). Preserves all validation + redemption-record logic;
-- only the two cashback_ledger inserts (referee + referrer) are removed.
DROP FUNCTION IF EXISTS apply_referral_code(UUID, TEXT);

CREATE OR REPLACE FUNCTION apply_referral_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  error_message TEXT,
  reward_paise BIGINT,
  reward_type TEXT,
  reward_amount_paise BIGINT,
  priority_boost INTEGER
) AS $$
DECLARE
  v_validation RECORD;
  v_existing_redemption UUID;
  v_owner_user_id UUID;
  v_reward_type TEXT;
  v_reward_paise BIGINT;
  v_priority_boost INTEGER;
BEGIN
  -- Already-redeemed gate (unchanged from 20260129200000)
  SELECT id INTO v_existing_redemption
  FROM referral_redemptions
  WHERE referee_user_id = p_user_id;

  IF v_existing_redemption IS NOT NULL THEN
    RETURN QUERY SELECT
      false,
      'You have already used a referral code'::TEXT,
      'You have already used a referral code'::TEXT,
      0::BIGINT,
      'none'::TEXT,
      0::BIGINT,
      0::INTEGER;
    RETURN;
  END IF;

  -- Validate the code
  SELECT * INTO v_validation
  FROM validate_referral_code(p_code);

  IF NOT v_validation.is_valid THEN
    RETURN QUERY SELECT
      false,
      v_validation.error_message,
      v_validation.error_message,
      0::BIGINT,
      'none'::TEXT,
      0::BIGINT,
      0::INTEGER;
    RETURN;
  END IF;

  -- Self-code gate
  SELECT owner_user_id INTO v_owner_user_id
  FROM referral_codes WHERE id = v_validation.code_id;

  IF v_owner_user_id = p_user_id THEN
    RETURN QUERY SELECT
      false,
      'You cannot use your own referral code'::TEXT,
      'You cannot use your own referral code'::TEXT,
      0::BIGINT,
      'none'::TEXT,
      0::BIGINT,
      0::INTEGER;
    RETURN;
  END IF;

  -- Resolve reward shape for response (no longer used for crediting)
  SELECT
    COALESCE(rc.referee_reward_paise, 0),
    CASE
      WHEN rc.referee_reward_paise > 0 AND (rc.metadata->>'priority_boost')::int > 0 THEN 'both'
      WHEN rc.referee_reward_paise > 0 THEN 'cashback'
      WHEN (rc.metadata->>'priority_boost')::int > 0 THEN 'priority'
      ELSE 'none'
    END,
    COALESCE((rc.metadata->>'priority_boost')::int, 0)
  INTO v_reward_paise, v_reward_type, v_priority_boost
  FROM referral_codes rc
  WHERE rc.id = v_validation.code_id;

  -- Persist the redemption — referee + referrer reward fields kept for
  -- audit/funnel; not paid out via ledger.
  INSERT INTO referral_redemptions (
    referral_code_id,
    referee_user_id,
    referee_reward_paise,
    referrer_reward_paise
  )
  SELECT
    v_validation.code_id,
    p_user_id,
    rc.referee_reward_paise,
    rc.referrer_reward_paise
  FROM referral_codes rc
  WHERE rc.id = v_validation.code_id;

  UPDATE users
  SET
    referral_code_id = v_validation.code_id,
    referral_applied_at = NOW()
  WHERE id = p_user_id;

  -- NOTE: cashback_ledger inserts intentionally omitted (B5 fix).
  -- Wallet credit is decommissioned. Reward delivery, if reintroduced,
  -- must go through the flat-bonus-style promo flag.

  RETURN QUERY SELECT
    true,
    'Referral code applied successfully!'::TEXT,
    NULL::TEXT,
    v_reward_paise,
    v_reward_type,
    v_reward_paise,
    v_priority_boost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION apply_referral_code IS
  'Records a referral code application for funnel/attribution. Does NOT '
  'credit the cashback wallet — accumulation is decommissioned. Reward '
  'delivery, if reintroduced, must go through the flat-bonus promo flag.';

-- ============================================================================
-- 5. Drain the single legacy outlier wallet
-- ============================================================================
--
-- Production verification (2026-05-01): exactly one user has
-- cashback_balance_paise > 0, holding ₹330 from a single 2026-03-06
-- 'earned' row that pre-dated the instant-discount cutover. The
-- 'adjustment' debit below zeros the wallet via the (already-fixed)
-- sync trigger. Pay-out to the affected user is handled out of band.

INSERT INTO cashback_ledger (
  user_id, transaction_type, amount_paise, balance_after_paise,
  description
)
SELECT
  id, 'adjustment', cashback_balance_paise, 0,
  'Wallet drained — accumulation model decommissioned'
FROM users
WHERE COALESCE(cashback_balance_paise, 0) > 0;

-- ============================================================================
-- 6. Partial unique index for 'flat_bonus' (Bug A7)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_cashback_ledger_unique_flat_bonus
  ON cashback_ledger (payment_id, transaction_type)
  WHERE transaction_type = 'flat_bonus' AND payment_id IS NOT NULL;

-- ============================================================================
-- 7. Drop once-ever-per-user reservation machinery
-- ============================================================================
--
-- The new model relies on the app_config flag + per-(user, rent_month)
-- uniqueness check (a payments query in initiate-payment). There is no
-- need for a per-user reservation row, and keeping it would require
-- compensating UPDATEs at every webhook/reconciliation site.

DROP TRIGGER IF EXISTS trg_release_flat_bonus_on_failure ON payments;
DROP FUNCTION IF EXISTS release_flat_bonus_on_payment_failed();

ALTER TABLE users
  DROP COLUMN IF EXISTS flat_bonus_claimed_payment_id,
  DROP COLUMN IF EXISTS flat_bonus_claimed_at;

COMMIT;
