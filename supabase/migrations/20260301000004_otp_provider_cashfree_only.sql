-- Migration: Restrict otp_requests provider to cashfree_m360 only
-- Supabase Auth now handles Twilio OTP internally; demo phones use Supabase test numbers.
-- Only Cashfree M360 OTP requests are tracked in otp_requests table.

-- Expire any existing twilio/demo records
UPDATE otp_requests SET status = 'expired'
WHERE provider IN ('twilio', 'demo') AND status = 'pending';

-- Update provider constraint to only allow cashfree_m360
ALTER TABLE otp_requests
  DROP CONSTRAINT IF EXISTS otp_requests_provider_check;

ALTER TABLE otp_requests
  ADD CONSTRAINT otp_requests_provider_check
  CHECK (provider IN ('cashfree_m360')) NOT VALID;
