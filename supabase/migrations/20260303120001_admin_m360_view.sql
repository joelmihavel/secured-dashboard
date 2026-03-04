-- Admin Dashboard: M360 Identity Verification Detail View
-- All Cashfree M360 verification records with user context

CREATE OR REPLACE VIEW public.v_m360_detail AS
SELECT
  iv.id AS verification_id,
  iv.status AS m360_status,
  iv.consent_phone,
  iv.consent_ip,
  iv.verification_id AS cashfree_verification_id,
  iv.reference_id AS cashfree_reference_id,

  -- User context
  u.id AS user_id,
  u.phone AS user_phone,
  COALESCE(u.full_name, TRIM(CONCAT(u.first_name, ' ', u.last_name))) AS user_name,
  u.user_status,

  -- M360 Identity
  iv.m360_full_name,
  iv.m360_gender,
  iv.m360_date_of_birth,
  iv.m360_age,
  iv.m360_occupation,
  iv.m360_total_income,
  iv.m360_aadhaar_masked,
  iv.m360_credit_score,

  -- M360 Risk Intelligence (flattened from JSONB)
  (iv.m360_risk_intelligence->>'risk_level') AS risk_level,
  (iv.m360_risk_intelligence->>'safe')::boolean AS risk_safe,
  (iv.m360_risk_intelligence->>'reason') AS risk_reason,

  -- M360 Mobile Intelligence (flattened from JSONB)
  (iv.m360_mobile_intelligence->>'provider') AS mobile_provider,
  (iv.m360_mobile_intelligence->>'connection_type') AS connection_type,
  (iv.m360_mobile_intelligence->>'phone_type') AS phone_type,

  -- M360 PAN (flattened from JSONB array)
  iv.m360_pan_details,

  -- M360 Bank Accounts
  iv.m360_bank_accounts,

  -- M360 Employment
  iv.m360_employment_details,

  -- M360 Addresses
  iv.m360_addresses,

  -- M360 Relatives
  iv.m360_relatives,

  -- OTP tracking
  iv.otp_sent_at,
  iv.otp_attempts,

  -- Timestamps
  iv.verified_at,
  iv.created_at,
  iv.updated_at

FROM identity_verifications iv
LEFT JOIN users u ON u.id = iv.user_id
ORDER BY iv.created_at DESC;

-- Permissions
REVOKE ALL ON public.v_m360_detail FROM anon;
GRANT SELECT ON public.v_m360_detail TO service_role;
