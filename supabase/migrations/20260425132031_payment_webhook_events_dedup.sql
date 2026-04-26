-- Webhook replay defense — dedup table.
--
-- Cashfree (and any other webhook source) can deliver the same event multiple
-- times: legitimately (their retry logic on 5xx) or maliciously (replay attack
-- after capturing a real signed payload).
--
-- Pattern: each webhook handler INSERTs the event_id at the top of processing
-- with `ON CONFLICT DO NOTHING`. The RETURNING clause tells the handler whether
-- this is a fresh event (process it) or a replay (silently ignore).
--
-- Example usage (Deno edge function pseudo-code):
--
--   const { data: dedup } = await supabase
--     .from('payment_webhook_events')
--     .insert({ event_id: payload.event_id, source: 'cashfree-split' })
--     .select('event_id')
--     .maybeSingle();
--   if (!dedup) {
--     // Insert was deduplicated by ON CONFLICT — this is a replay
--     return jsonResponse({ ok: true, deduplicated: true });
--   }
--   // ... continue processing the event ...
--
-- Field choices:
--   event_id    — primary dedup key. For Cashfree, the `event_id` field on the
--                 webhook payload (UUID-ish). For PayU, `txnid + paymentId`.
--                 If the source doesn't provide a stable id, hash the payload
--                 + timestamp + signature.
--   source      — `cashfree-pg`, `cashfree-split`, `cashfree-vendor`, `payu`,
--                 etc. Lets us scope audits and cleanup per source.
--   received_at — when our edge function logged the receipt. Used for the
--                 retention sweep below.
--   payload_size — informational, helps spot abuse (giant replays).
--
-- Retention: kept for 30 days then swept. Webhook replay attacks beyond 30
-- days against a stale signature are not realistic; older entries waste space.

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id     TEXT NOT NULL,
  source       TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_size INTEGER,
  -- Composite PK lets two different sources share an event_id without colliding
  -- (unlikely in practice, but cheap insurance).
  PRIMARY KEY (source, event_id)
);

COMMENT ON TABLE payment_webhook_events IS
  'Dedup log for inbound webhooks. Each handler INSERTs ON CONFLICT DO NOTHING; if no row is returned the event is a replay. See migration 20260425131920 for usage.';

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_received_at
  ON payment_webhook_events (received_at);

-- RLS: service-role only. Webhook handlers run with service role; nobody else
-- has any reason to query this table.
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- @rls-review: this table is only ever written/read by webhook handlers
-- running with service_role. anon/authenticated have zero legitimate need.
-- USING(true) + WITH CHECK(true) is the standard "service-role only" form
-- for an internal log table. No paired policy test needed because no other
-- role can reach this table.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'payment_webhook_events_service_role'
  ) THEN
    CREATE POLICY payment_webhook_events_service_role
      ON payment_webhook_events
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 30-day retention sweep — cleanup function (cron-able). NOT scheduled here;
-- whoever wires the cron should add a `cron.schedule(...)` in a follow-up
-- migration, gated on `EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')`
-- so it's a no-op locally.
--
-- @security-definer: needs to bypass RLS to delete on behalf of the cron job
-- (no user context). Only callable by service_role per REVOKE below.
CREATE OR REPLACE FUNCTION public.cleanup_payment_webhook_events()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM payment_webhook_events
  WHERE received_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$function$;

-- @grant-review: standard pattern — revoke EXECUTE from anon + authenticated
-- so only service_role (cron, edge functions) can invoke this cleanup.
REVOKE EXECUTE ON FUNCTION public.cleanup_payment_webhook_events() FROM anon, authenticated;

-- rollback:
--   DROP FUNCTION IF EXISTS public.cleanup_payment_webhook_events();
--   DROP POLICY IF EXISTS payment_webhook_events_service_role ON payment_webhook_events;
--   DROP TABLE IF EXISTS payment_webhook_events;
