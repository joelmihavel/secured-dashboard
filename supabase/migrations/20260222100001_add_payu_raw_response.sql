-- Flent Secured v2 - Migration: Add PayU raw response storage columns
-- Stores the full PayU API response and initiation parameters for debugging and reconciliation

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payu_raw_response JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payu_initiation_params JSONB;

COMMENT ON COLUMN payments.payu_raw_response IS 'Full raw JSON response from PayU webhook/callback for audit and debugging';
COMMENT ON COLUMN payments.payu_initiation_params IS 'Parameters sent to PayU when initiating the payment (hash, txnid, etc.)';
