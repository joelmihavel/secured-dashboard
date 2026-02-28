-- Expand notification_type CHECK constraint to include all new types
-- used by the notify-user edge function templates.

-- Drop the existing inline CHECK constraint and replace with a named one.
-- The original constraint was defined inline on the column (unnamed),
-- so we find it by its auto-generated name.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the CHECK constraint on notifications.notification_type
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class r ON c.conrelid = r.oid
  JOIN pg_namespace n ON r.relnamespace = n.oid
  WHERE r.relname = 'notifications'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%notification_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Add new CHECK with all types (old + new)
ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check
  CHECK (notification_type IN (
    -- Original types
    'payment_reminder',
    'payment_success',
    'payment_failed',
    'cashback_earned',
    'cashback_expiring',
    'landlord_approved',
    'landlord_disputed',
    'verification_complete',
    'verification_required',
    'general',
    'promo',
    -- New types (notify-user templates)
    'waitlist_approved',
    'waitlist_rejected',
    'rent_due',
    'rent_due_tomorrow',
    'rent_overdue',
    'settlement_complete',
    'settlement_failed',
    'landlord_confirmed',
    'landlord_rejected',
    'app_update',
    'reminder_utility',
    'reminder_landlord_invite',
    'reminder_agreement'
  ));
