-- Flent Secured v2 - Migration: Backfill rent_amount_paise
-- Restores original rent amounts that were incorrectly stored as reduced amounts.
-- When cashback was applied, rent_amount_paise was set to (rent - cashback) instead of
-- keeping the original rent. This backfill adds cashback_applied_paise back to restore
-- the true rent amount.
--
-- Idempotent: Uses a table comment sentinel to prevent double-execution.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_description d
    JOIN pg_catalog.pg_class c ON d.objoid = c.oid
    WHERE c.relname = 'payments' AND d.description = 'rent_backfill_completed') THEN

    UPDATE payments
    SET rent_amount_paise = rent_amount_paise + cashback_applied_paise
    WHERE cashback_applied_paise > 0 AND status IN ('success', 'failed');

    COMMENT ON TABLE payments IS 'rent_backfill_completed';
  END IF;
END $$;
