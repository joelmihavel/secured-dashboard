-- =============================================================================
-- Cashback Dedup — replaced by partial indexes in 20260225000001
--
-- The broad UNIQUE (payment_id, transaction_type) constraint was too restrictive:
-- it blocked multiple 'reversal' entries for the same payment (needed when both
-- 'discount' and 'earned' entries exist for a refunded payment).
--
-- Dedup is now handled by:
--   idx_cashback_ledger_unique_earned   (partial: WHERE transaction_type='earned')
--   idx_cashback_ledger_unique_discount (partial: WHERE transaction_type='discount')
-- =============================================================================

-- Drop the over-broad constraint if it exists
ALTER TABLE cashback_ledger
  DROP CONSTRAINT IF EXISTS cashback_ledger_payment_type_unique;
