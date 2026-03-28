-- Add 'retrying' to landlord_payout_status CHECK constraint
-- Required by: cashfree-split-webhook (FAILED/REVERSED → 'retrying')
--              poll-settlement-status (36hr check queries 'retrying')

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_landlord_payout_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_landlord_payout_status_check
  CHECK (landlord_payout_status IN ('pending', 'ready', 'held', 'processing', 'retrying', 'settled', 'failed'));

-- Add gateway-agnostic columns to refunds table (Cashfree support)
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'payu';
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS gateway_refund_id TEXT;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS gateway_refund_status TEXT;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS gateway_metadata JSONB;

-- Update settle-to-landlord cron to every 5 minutes
-- Instant Settlements enabled: 1hr window, so 5min cadence ensures timely transfers
SELECT cron.unschedule('settle-to-landlord');
SELECT cron.schedule(
  'settle-to-landlord',
  '*/5 * * * *',
  $$SELECT invoke_edge_function('settle-to-landlord')$$
);
