-- Kill-switch wired into process_notification_queue() PL/pgSQL cron.
--
-- When `whatsapp_send` flag is OFF, any whatsapp row picked up by the cron
-- is immediately marked failed with retry_count=max_retries and skip reason
-- 'wa_kill_switch'. The `retry-failed-notifications` cron will not re-pick
-- these (its WHERE clause requires retry_count < max_retries).
--
-- This is the legacy async path; transactional and direct sends are gated
-- separately inside the edge functions.

CREATE OR REPLACE FUNCTION process_notification_queue()
RETURNS void AS $$
DECLARE
  v_notification    RECORD;
  v_function_url    TEXT;
  v_wa_send_enabled BOOLEAN;
BEGIN
  -- Read kill-switch once per cron run. Fail closed for WA *only* — if the
  -- flag table is missing or unreadable, push/sms still process; only WA
  -- rows are blocked. This keeps a flag-table outage from DoS-ing other
  -- channels.
  BEGIN
    SELECT enabled INTO v_wa_send_enabled
    FROM private.feature_flags
    WHERE key = 'whatsapp_send';
    v_wa_send_enabled := COALESCE(v_wa_send_enabled, false);
  EXCEPTION WHEN OTHERS THEN
    v_wa_send_enabled := false;
  END;

  FOR v_notification IN
    SELECT *
    FROM notification_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
      AND retry_count < max_retries
    ORDER BY scheduled_for
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Gate WhatsApp rows on the flag — fail closed (no retries) when off
    IF v_notification.notification_type = 'whatsapp' AND NOT v_wa_send_enabled THEN
      UPDATE notification_queue
      SET status = 'failed',
          retry_count = max_retries,
          error_message = 'wa_kill_switch'
      WHERE id = v_notification.id;
      CONTINUE;
    END IF;

    UPDATE notification_queue
    SET status = 'processing'
    WHERE id = v_notification.id;

    v_function_url := get_edge_function_url(
      CASE v_notification.notification_type
        WHEN 'whatsapp' THEN 'send-whatsapp'
        WHEN 'sms' THEN 'send-sms'
        WHEN 'push' THEN 'send-push-notification'
        ELSE 'send-sms'
      END
    );

    -- @http-out: send-whatsapp / send-sms / send-push-notification edge functions in this Supabase project (URL resolved by get_edge_function_url above)
    PERFORM net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'x-supabase-internal', 'true'
      ),
      body := v_notification.payload || jsonb_build_object(
        'notification_queue_id', v_notification.id,
        'user_id', v_notification.user_id
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- rollback: restore the prior process_notification_queue() definition from migration 20260121000012 (the version without the whatsapp_send flag check).
