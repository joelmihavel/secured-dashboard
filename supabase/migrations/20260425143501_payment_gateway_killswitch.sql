-- Payment gateway killswitch — Phase 3.5a of cleanup plan.
--
-- Background:
--   Today the RN client picks the payment gateway at BUILD time via
--   EXPO_PUBLIC_PAYMENT_GATEWAY (resolved in rn-app/src/config/env.ts).
--   That means a Cashfree outage requires either an OTA update (for the
--   env var change) or, if PayU has been pruned out of the build, a
--   full rebuild + app-store cycle.
--
-- This migration lays the foundation for SERVER-DRIVEN gateway resolution:
--   1. Adds a `payment_gateway` row to app_config with primary + emergency_fallback
--   2. Adds get_payment_gateway() SQL helper for edge functions to call
--   3. Default values match current behavior — no flag flip, no change in
--      what gets routed where
--
-- The actual integration in initiate-payment edge fn is Phase 3.5b
-- (separate commit, after Maestro coverage verifies the new code path
-- doesn't break existing flows). Until 3.5b ships, this migration is
-- inert — nothing reads the row.
--
-- @safe-destructive: not destructive — purely additive
-- @rls-review: app_config already has RLS via inherited policy; service
--   role reads + service role writes only. Confirmed via existing
--   migration 20260222000003_create_invite_codes_and_app_config.

-- 1. Insert the killswitch config row, idempotent
INSERT INTO public.app_config (key, value, updated_at)
VALUES (
  'payment_gateway',
  jsonb_build_object(
    'primary',            'cashfree',
    'emergency_fallback', 'payu',
    'reason',             null,
    'updated_by',         null,
    'updated_at',         null
  ),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 2. Helper function — primary lookup with safe defaults.
-- @security-definer: needs to bypass RLS so unauthenticated edge
--   function paths can read the active gateway. Returns only the
--   public 'primary' field, no secrets exposed.
CREATE OR REPLACE FUNCTION public.get_payment_gateway()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
DECLARE
  cfg JSONB;
  gw TEXT;
BEGIN
  SELECT value INTO cfg FROM app_config WHERE key = 'payment_gateway';
  IF cfg IS NULL THEN
    RETURN 'cashfree';  -- safe default if config row missing
  END IF;
  gw := cfg->>'primary';
  IF gw IS NULL OR gw = '' THEN
    RETURN 'cashfree';
  END IF;
  RETURN gw;
END;
$function$;

COMMENT ON FUNCTION public.get_payment_gateway() IS
  'Returns the currently-active payment gateway: cashfree (default) or payu (emergency). Read by initiate-payment edge fn (Phase 3.5b) to drive server-side gateway routing. Admin can flip the flag via UPDATE app_config SET value = jsonb_set(value, ''{primary}'', ''"payu"'') WHERE key = ''payment_gateway''.';

-- @grant-review: standard pattern — anon/authenticated must NOT call this directly;
--   only the service-role-backed edge function reads it on their behalf.
REVOKE EXECUTE ON FUNCTION public.get_payment_gateway() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_gateway() TO service_role;

-- rollback:
--   DROP FUNCTION IF EXISTS public.get_payment_gateway();
--   DELETE FROM public.app_config WHERE key = 'payment_gateway';
