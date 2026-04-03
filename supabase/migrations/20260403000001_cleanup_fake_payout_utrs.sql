-- Cleanup: Clear internal tracking refs that were incorrectly written to landlord_payout_utr.
-- settle-to-landlord used to write "PAYOUT-{id}-{timestamp}" to this column as an optimistic
-- lock marker. These are NOT real bank UTRs and must be nullified so the UI shows "Pending"
-- until a real UTR arrives via cashfree-split-webhook or confirm-payout.

UPDATE payments
SET landlord_payout_utr = NULL
WHERE landlord_payout_utr LIKE 'PAYOUT-%';

-- Backfill: Cashfree payments marked "settled" but missing a real UTR.
-- Temporarily revert to "processing" so poll-settlement-status's reconcileVendorSettlements
-- picks them up on the next cron run and backfills gateway_payout_utr via vendor recon API.
-- After the cron runs, these will be back to "settled" with a real UTR.

UPDATE payments
SET landlord_payout_status = 'processing'
WHERE status = 'success'
  AND payment_gateway = 'cashfree'
  AND landlord_payout_status = 'settled'
  AND gateway_payout_utr IS NULL
  AND landlord_payout_utr IS NULL
  AND gateway_settlement_utr IS NULL
  AND settlement_utr IS NULL;
