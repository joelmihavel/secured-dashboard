-- Expand notifications type CHECK constraint for WhatsApp notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check CHECK (
  notification_type IN (
    -- Existing types
    'payment_reminder','payment_success','payment_failed','cashback_earned',
    'cashback_expiring','landlord_approved','landlord_disputed',
    'verification_complete','verification_required','general','promo',
    'waitlist_approved','waitlist_rejected','rent_due','rent_due_tomorrow',
    'rent_overdue','settlement_complete','settlement_failed',
    'landlord_confirmed','landlord_rejected','app_update',
    'reminder_utility','reminder_landlord_invite','reminder_agreement',
    -- New WhatsApp-triggered types
    'onboarding_dropoff',
    'agreement_upload_failed',
    'under_review',
    'setup_incomplete',
    'landlord_pending',
    'payment_refunded',
    'milestone_streak'
  )
);
