-- Flent Secured v2 - Migration: Notifications Table
-- Stores in-app notifications for users

-- ==============================================
-- TABLE: notifications
-- ==============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
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
    'promo'
  )),

  -- Action/Deep link
  action_type TEXT, -- 'navigate', 'open_url', etc.
  action_data JSONB, -- { "screen": "payment", "params": {} } or { "url": "..." }

  -- Read status
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiry

  -- Metadata
  related_entity_type TEXT, -- 'payment', 'tenancy', 'cashback', etc.
  related_entity_id UUID,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- INDEXES
-- ==============================================

-- Fast lookup for user's notifications (unread first, then by date)
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- Scheduled notifications (full index, queries filter by time)
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for);

-- Find notifications for a specific entity
CREATE INDEX idx_notifications_entity ON notifications(related_entity_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

-- Clean up expired notifications
CREATE INDEX idx_notifications_expired ON notifications(expires_at)
  WHERE expires_at IS NOT NULL;

-- ==============================================
-- FUNCTION: Create notification
-- ==============================================

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_notification_type TEXT,
  p_action_type TEXT DEFAULT NULL,
  p_action_data JSONB DEFAULT NULL,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, title, body, notification_type,
    action_type, action_data,
    related_entity_type, related_entity_id,
    priority, scheduled_for, expires_at
  ) VALUES (
    p_user_id, p_title, p_body, p_notification_type,
    p_action_type, p_action_data,
    p_related_entity_type, p_related_entity_id,
    p_priority, p_scheduled_for, p_expires_at
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNCTION: Mark notifications as read
-- ==============================================

CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL -- NULL = mark all as read
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all unread notifications as read
    UPDATE notifications
    SET is_read = true, read_at = NOW()
    WHERE user_id = p_user_id AND is_read = false;
  ELSE
    -- Mark specific notifications as read
    UPDATE notifications
    SET is_read = true, read_at = NOW()
    WHERE user_id = p_user_id
      AND id = ANY(p_notification_ids)
      AND is_read = false;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNCTION: Get unread notification count
-- ==============================================

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = p_user_id
      AND is_read = false
      AND scheduled_for <= NOW()
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- RLS POLICIES
-- ==============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY notifications_service_all ON notifications
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON COLUMN notifications.action_data IS 'JSON with navigation or action details';
COMMENT ON COLUMN notifications.expires_at IS 'Notifications past this date should not be shown';
COMMENT ON FUNCTION create_notification IS 'Creates a new notification for a user';
COMMENT ON FUNCTION mark_notifications_read IS 'Marks notifications as read, either all or specific IDs';
