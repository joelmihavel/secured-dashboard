-- Flent Secured v2 - Migration: Add 'otp_confirmed' to landlord_status enum
-- Required for the new M360 identity verification gate on credit card payments.
-- landlord_status flow: none → invited → otp_confirmed → verified (or declined)

ALTER TABLE tenancies DROP CONSTRAINT IF EXISTS tenancies_landlord_status_check;
ALTER TABLE tenancies ADD CONSTRAINT tenancies_landlord_status_check
  CHECK (landlord_status IN ('none', 'invited', 'otp_confirmed', 'verified', 'declined'));
