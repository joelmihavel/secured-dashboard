-- Flent Secured v2 - Migration: Enable Supabase Realtime
-- ======================================================
-- Enables Realtime subscriptions for extraction status updates.
--
-- BACKWARD COMPATIBILITY:
-- - V1 iOS polling via get-waitlist-status continues to work unchanged
-- - V2 iOS can subscribe to Realtime channels for instant updates
--
-- TABLES ENABLED FOR REALTIME:
-- - extracted_rental_info: Document extraction status changes
-- - users: Profile updates (KYC status, onboarding)
-- - tenancies: Tenancy status changes
-- - payments: Payment status updates
-- - notifications: New notifications

-- ==============================================
-- ENABLE REALTIME PUBLICATION
-- ==============================================

-- Drop existing publication if it exists (idempotent)
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication for Realtime
-- This publishes INSERT, UPDATE, DELETE events
CREATE PUBLICATION supabase_realtime;

-- ==============================================
-- ADD TABLES TO REALTIME PUBLICATION
-- ==============================================

-- extracted_rental_info: iOS subscribes for extraction status updates
-- Replaces polling of get-waitlist-status
ALTER PUBLICATION supabase_realtime ADD TABLE extracted_rental_info;

-- users: Profile changes (KYC status, role lock, etc.)
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- tenancies: Tenancy lifecycle events
ALTER PUBLICATION supabase_realtime ADD TABLE tenancies;

-- payments: Payment status changes (initiated → success/failed)
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- notifications: New notification alerts
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- waitlist_entries: V1 compatibility table (if iOS queries this directly)
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist_entries;

-- ==============================================
-- REPLICA IDENTITY FOR REALTIME
-- ==============================================
-- Realtime needs REPLICA IDENTITY to track row changes
-- FULL means all columns are sent in change events

ALTER TABLE extracted_rental_info REPLICA IDENTITY FULL;
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE tenancies REPLICA IDENTITY FULL;
ALTER TABLE payments REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE waitlist_entries REPLICA IDENTITY FULL;

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON PUBLICATION supabase_realtime IS 'Realtime publication for iOS app subscriptions. V1 polling still works, V2 can use Realtime.';
