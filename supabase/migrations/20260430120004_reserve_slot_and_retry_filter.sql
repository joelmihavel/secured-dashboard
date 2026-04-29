-- Race-safe slot reservation for WhatsApp send caps + retry-cron exclusion of
-- kill-switch failures.
--
-- The reservation function:
--   1. Acquires a per-(user, channel) advisory transaction lock to serialize
--      concurrent reservations for the same recipient.
--   2. Counts existing 'sent' or 'pending' rows against the relevant cap.
--   3. If under cap, inserts a 'pending' row and returns its id.
--   4. The caller updates the row to 'sent' or 'failed' once Twilio returns.
--
-- This eliminates the TOCTOU race where two parallel notify-user calls could
-- both pass a check-then-send and both bill toward the cap.

-- ============================================================
-- 1. reserve_whatsapp_slot — atomic check-and-claim
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_whatsapp_slot(
  p_user_id            UUID,
  p_notification_type  TEXT,
  p_per_day_cap        INTEGER,
  p_per_window_cap     INTEGER,
  p_window_seconds     INTEGER,
  p_lifetime_cap       INTEGER,
  p_global_daily_cap   INTEGER,
  p_ist_day_start      TIMESTAMPTZ,
  p_context            JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(slot_id UUID, allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
-- @security-definer: takes pg_advisory_xact_lock + INSERTs to notification_send_log under one transaction. Caller (service_role via edge function) gets cap-check + slot claim atomically.
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count   INTEGER;
  v_slot_id UUID;
BEGIN
  -- Per-user-per-channel advisory lock (transaction scope) — releases on commit/rollback.
  -- Two parallel callers for the same user serialize through the count+insert path.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':whatsapp'));

  IF p_global_daily_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM notification_send_log
    WHERE user_id = p_user_id
      AND channel = 'whatsapp'
      AND outcome IN ('sent','pending')
      AND created_at >= p_ist_day_start;
    IF v_count >= p_global_daily_cap THEN
      RETURN QUERY SELECT NULL::UUID, false, 'daily_global_cap';
      RETURN;
    END IF;
  END IF;

  IF p_lifetime_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM notification_send_log
    WHERE user_id = p_user_id
      AND notification_type = p_notification_type
      AND channel = 'whatsapp'
      AND outcome IN ('sent','pending');
    IF v_count >= p_lifetime_cap THEN
      RETURN QUERY SELECT NULL::UUID, false, 'lifetime_cap';
      RETURN;
    END IF;
  END IF;

  IF p_per_day_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM notification_send_log
    WHERE user_id = p_user_id
      AND notification_type = p_notification_type
      AND channel = 'whatsapp'
      AND outcome IN ('sent','pending')
      AND created_at >= p_ist_day_start;
    IF v_count >= p_per_day_cap THEN
      RETURN QUERY SELECT NULL::UUID, false, 'per_day_cap';
      RETURN;
    END IF;
  END IF;

  IF p_per_window_cap IS NOT NULL
     AND p_window_seconds IS NOT NULL
     AND p_window_seconds > 0 THEN
    SELECT COUNT(*) INTO v_count
    FROM notification_send_log
    WHERE user_id = p_user_id
      AND notification_type = p_notification_type
      AND channel = 'whatsapp'
      AND outcome IN ('sent','pending')
      AND created_at >= NOW() - make_interval(secs => p_window_seconds);
    IF v_count >= p_per_window_cap THEN
      RETURN QUERY SELECT NULL::UUID, false, 'per_window_cap';
      RETURN;
    END IF;
  END IF;

  -- Caps OK — claim a slot
  v_slot_id := gen_random_uuid();
  INSERT INTO notification_send_log (
    id, user_id, notification_type, channel, outcome, context
  ) VALUES (
    v_slot_id, p_user_id, p_notification_type, 'whatsapp', 'pending', p_context
  );

  RETURN QUERY SELECT v_slot_id, true, NULL::TEXT;
END;
$$;

-- @grant-review: revoke from PUBLIC, expose only to service_role. Edge functions are the sole caller; no anonymous or authenticated invocation should be possible (would let any user bypass cap accounting).
REVOKE ALL ON FUNCTION public.reserve_whatsapp_slot(UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_whatsapp_slot(UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, JSONB) TO service_role;

-- ============================================================
-- 2. release_whatsapp_slot — finalize a reserved slot
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_whatsapp_slot(
  p_slot_id        UUID,
  p_outcome        TEXT,
  p_external_id    TEXT DEFAULT NULL,
  p_error_message  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
-- @security-definer: idempotent UPDATE on notification_send_log; only finalizes rows currently 'pending'. Same rationale as reserve_whatsapp_slot.
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_outcome NOT IN ('sent','failed','skipped') THEN
    RAISE EXCEPTION 'invalid outcome: %', p_outcome;
  END IF;

  UPDATE notification_send_log
  SET outcome       = p_outcome,
      external_id   = COALESCE(p_external_id, external_id),
      error_message = p_error_message,
      updated_at    = NOW()
  WHERE id = p_slot_id
    AND outcome = 'pending';
END;
$$;

-- @grant-review: same rationale as reserve_whatsapp_slot — service_role only.
REVOKE ALL ON FUNCTION public.release_whatsapp_slot(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_whatsapp_slot(UUID, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================
-- 3. retry-failed-notifications cron — exclude kill-switch errors
-- ============================================================
-- Replaces the WHERE clause from migration 20260121000012 so that rows
-- failed by the WhatsApp kill switch don't get re-picked while the flag
-- is off. Self-documenting: the error_message values are the reasons.

DO $$ BEGIN
  PERFORM cron.unschedule('retry-failed-notifications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'retry-failed-notifications',
  '*/15 * * * *',
  $cron$
    UPDATE notification_queue
    SET status = 'pending', retry_count = retry_count + 1
    WHERE status = 'failed'
      AND retry_count < max_retries
      AND created_at > NOW() - INTERVAL '24 hours'
      AND COALESCE(error_message, '') NOT IN (
        'wa_kill_switch',
        'wa_broadcast_kill_switch',
        'manual_cleanup'
      )
  $cron$
);

-- ============================================================
-- 4. whatsapp_broadcast_log — total_skipped column
-- ============================================================

ALTER TABLE whatsapp_broadcast_log
  ADD COLUMN IF NOT EXISTS total_skipped INT NOT NULL DEFAULT 0;

-- ============================================================
-- 5. Touch trigger for notification_send_log.updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION tg_send_log_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS send_log_touch_updated_at ON notification_send_log;
CREATE TRIGGER send_log_touch_updated_at
  BEFORE UPDATE ON notification_send_log
  FOR EACH ROW EXECUTE FUNCTION tg_send_log_touch_updated_at();

-- rollback:
--   DROP TRIGGER IF EXISTS send_log_touch_updated_at ON notification_send_log;
--   DROP FUNCTION IF EXISTS tg_send_log_touch_updated_at();
--   ALTER TABLE whatsapp_broadcast_log DROP COLUMN IF EXISTS total_skipped;
--   -- Restore previous retry-failed-notifications cron (without error_message exclusion):
--   --   SELECT cron.unschedule('retry-failed-notifications');
--   --   SELECT cron.schedule('retry-failed-notifications', '*/15 * * * *',
--   --     $cron$UPDATE notification_queue SET status='pending', retry_count=retry_count+1
--   --       WHERE status='failed' AND retry_count<max_retries
--   --       AND created_at > NOW() - INTERVAL '24 hours'$cron$);
--   DROP FUNCTION IF EXISTS public.release_whatsapp_slot(UUID, TEXT, TEXT, TEXT);
--   DROP FUNCTION IF EXISTS public.reserve_whatsapp_slot(UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, JSONB);
