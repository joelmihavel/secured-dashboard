-- Drop the redundant payment_webhook_events dedup table.
--
-- Background: migration 20260425131920_payment_webhook_events_dedup.sql added
-- this table intending to be the canonical webhook replay-defense store. But
-- the actual webhook handlers (cashfree-split-webhook, cashfree-vendor-webhook,
-- payment-webhook) all use the pre-existing `processed_webhooks` table for
-- the same purpose. payment_webhook_events sat unused, with two side effects:
--   1. Dead schema noise — confused readers ("which dedup table is canonical?")
--   2. Unused cleanup function `cleanup_payment_webhook_events()` taking up
--      schema namespace
--
-- This migration removes the unused artifacts. processed_webhooks remains
-- the single source of truth for webhook replay defense.
--
-- @safe-destructive: payment_webhook_events has zero callers in supabase/
--   functions/, cloud-run/, rn-app/, admin-app/. Verified via grep at
--   commit time. Dropping is functionally a no-op.
-- @rls-review: dropping policy alongside the table (cleaner than orphan policy)
-- @grant-review: revoking EXECUTE on the cleanup function before drop is
--   redundant since the function itself is being dropped. Dropping in order:
--   policy → function → table.

DROP POLICY IF EXISTS payment_webhook_events_service_role ON public.payment_webhook_events;
DROP FUNCTION IF EXISTS public.cleanup_payment_webhook_events();
DROP TABLE IF EXISTS public.payment_webhook_events;

-- rollback:
--   CREATE TABLE IF NOT EXISTS payment_webhook_events (
--     event_id     TEXT NOT NULL,
--     source       TEXT NOT NULL,
--     received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     payload_size INTEGER,
--     PRIMARY KEY (source, event_id)
--   );
--   COMMENT ON TABLE payment_webhook_events IS 'Dedup log for inbound webhooks...';
--   CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_received_at ON payment_webhook_events (received_at);
--   ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY payment_webhook_events_service_role ON payment_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);
--   CREATE OR REPLACE FUNCTION public.cleanup_payment_webhook_events() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $function$
--   DECLARE deleted INTEGER;
--   BEGIN
--     DELETE FROM payment_webhook_events WHERE received_at < NOW() - INTERVAL '30 days';
--     GET DIAGNOSTICS deleted = ROW_COUNT;
--     RETURN deleted;
--   END;
--   $function$;
--   REVOKE EXECUTE ON FUNCTION public.cleanup_payment_webhook_events() FROM anon, authenticated;
