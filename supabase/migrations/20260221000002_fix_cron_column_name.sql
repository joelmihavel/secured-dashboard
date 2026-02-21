-- Flent Secured v2 - Migration: Fix send_payment_reminders column name
-- The original function references 'rent_month' but the payments column is 'payment_month'.
-- Also fixes status check: payments uses 'initiated' not 'pending'.

CREATE OR REPLACE FUNCTION send_payment_reminders()
RETURNS void AS $$
DECLARE
  v_tenancy RECORD;
  v_user RECORD;
  v_due_date DATE;
  v_days_until_due INTEGER;
BEGIN
  -- Get active tenancies with upcoming due dates (3 days before)
  FOR v_tenancy IN
    SELECT t.id, t.user_id, t.monthly_rent_paise, t.rent_due_day, t.landlord_name
    FROM tenancies t
    WHERE t.status = 'active'
      AND t.bank_verified = true
  LOOP
    -- Calculate due date for current month
    v_due_date := DATE_TRUNC('month', CURRENT_DATE) + (v_tenancy.rent_due_day - 1) * INTERVAL '1 day';

    -- If already past this month's due date, use next month
    IF v_due_date < CURRENT_DATE THEN
      v_due_date := v_due_date + INTERVAL '1 month';
    END IF;

    v_days_until_due := v_due_date - CURRENT_DATE;

    -- Send reminder 3 days before due date
    IF v_days_until_due = 3 THEN
      -- Check if payment already made for this month (fixed: payment_month, not rent_month; initiated, not pending)
      IF NOT EXISTS (
        SELECT 1 FROM payments
        WHERE tenancy_id = v_tenancy.id
          AND payment_month = DATE_TRUNC('month', v_due_date)
          AND status IN ('success', 'processing', 'initiated')
      ) THEN
        -- Get user details
        SELECT first_name, phone INTO v_user
        FROM users WHERE id = v_tenancy.user_id;

        -- Queue WhatsApp notification
        INSERT INTO notification_queue (
          user_id, notification_type, payload, scheduled_for
        ) VALUES (
          v_tenancy.user_id,
          'whatsapp',
          jsonb_build_object(
            'to', v_user.phone,
            'body', format(
              'Hi %s, your rent of Rs %s is due on %s. Pay now to earn 1%% cashback!',
              v_user.first_name,
              (v_tenancy.monthly_rent_paise / 100)::TEXT,
              TO_CHAR(v_due_date, 'DD Mon')
            )
          ),
          NOW()
        );

        -- Queue push notification
        INSERT INTO notification_queue (
          user_id, notification_type, payload, scheduled_for
        )
        SELECT
          v_tenancy.user_id,
          'push',
          jsonb_build_object(
            'device_token', dt.token,
            'title', 'Rent Due Soon',
            'body', format('Rs %s due on %s. Pay now for 1%% cashback!',
              (v_tenancy.monthly_rent_paise / 100)::TEXT,
              TO_CHAR(v_due_date, 'DD Mon')
            ),
            'data', jsonb_build_object(
              'type', 'payment_reminder',
              'tenancy_id', v_tenancy.id
            )
          ),
          NOW()
        FROM device_tokens dt
        WHERE dt.user_id = v_tenancy.user_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
