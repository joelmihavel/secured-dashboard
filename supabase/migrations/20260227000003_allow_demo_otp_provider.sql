-- Allow 'demo' as an OTP provider for test phone numbers (Apple Review + dev Quick Login)
ALTER TABLE otp_requests DROP CONSTRAINT otp_requests_provider_check;
ALTER TABLE otp_requests ADD CONSTRAINT otp_requests_provider_check
  CHECK (provider IN ('twilio', 'cashfree_m360', 'demo'));
