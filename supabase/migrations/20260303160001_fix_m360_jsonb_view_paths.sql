-- Fix JSONB field paths to handle both Cashfree's actual response format
-- and legacy field names using COALESCE fallbacks.
-- Cashfree M360 uses: is_safe (not safe), risk_reason (not reason),
-- current_service_provider (not provider), mobile_number_intelligence (not mobile_intelligence).

-- v_m360_detail: Must DROP + CREATE (column names unchanged, but extraction paths change)
DROP VIEW IF EXISTS public.v_m360_detail;
CREATE VIEW public.v_m360_detail AS
SELECT
  iv.id AS verification_id,
  iv.status AS m360_status,
  iv.consent_phone,
  iv.consent_ip,
  iv.verification_id AS cashfree_verification_id,
  iv.reference_id AS cashfree_reference_id,
  u.id AS user_id,
  u.phone AS user_phone,
  COALESCE(u.full_name, TRIM(CONCAT(u.first_name, ' ', u.last_name))) AS user_name,
  u.user_status,
  iv.m360_full_name,
  iv.m360_gender,
  iv.m360_date_of_birth,
  iv.m360_age,
  iv.m360_occupation,
  iv.m360_total_income,
  iv.m360_aadhaar_masked,
  iv.m360_credit_score,
  (iv.m360_risk_intelligence->>'risk_level') AS risk_level,
  COALESCE(iv.m360_risk_intelligence->>'is_safe', iv.m360_risk_intelligence->>'safe')::boolean AS risk_safe,
  COALESCE(iv.m360_risk_intelligence->>'risk_reason', iv.m360_risk_intelligence->>'reason') AS risk_reason,
  COALESCE(iv.m360_mobile_intelligence->>'current_service_provider', iv.m360_mobile_intelligence->>'provider') AS mobile_provider,
  (iv.m360_mobile_intelligence->>'connection_type') AS connection_type,
  COALESCE(iv.m360_mobile_intelligence->>'is_valid_number', iv.m360_mobile_intelligence->>'valid') AS phone_valid,
  iv.m360_pan_details,
  iv.m360_bank_accounts,
  iv.m360_employment_details,
  iv.m360_addresses,
  iv.m360_relatives,
  iv.otp_sent_at,
  iv.otp_attempts,
  iv.verified_at,
  iv.created_at,
  iv.updated_at
FROM identity_verifications iv
LEFT JOIN users u ON u.id = iv.user_id
ORDER BY iv.created_at DESC;

REVOKE ALL ON public.v_m360_detail FROM anon;
GRANT SELECT ON public.v_m360_detail TO service_role;

-- v_user_funnel: Must DROP + CREATE (LATERAL subquery JSONB paths change)
DROP VIEW IF EXISTS public.v_user_funnel;
CREATE VIEW public.v_user_funnel AS
SELECT
  u.id AS user_id,
  u.phone,
  COALESCE(u.full_name, TRIM(CONCAT(u.first_name, ' ', u.last_name))) AS name,
  u.user_status,
  u.role,
  u.kyc_status,
  u.created_at AS signed_up_at,
  u.status_updated_at,
  u.cashback_balance_paise,
  u.referral_code,
  u.name_source,
  w.waitlist_position,
  w.admin_review,
  w.risk_level,
  w.created_at AS waitlist_joined_at,
  e.id AS extraction_id,
  e.extraction_status,
  e.user_verified AS agreement_verified,
  e.property_address,
  e.property_city,
  e.property_state,
  e.property_pincode,
  e.monthly_rent_paise,
  e.maintenance_paise,
  e.landlord_name,
  COALESCE(e.landlord_name, (e.landlord_names)[1]) AS landlord_display_name,
  e.landlord_phone,
  e.lease_start_date,
  e.lease_end_date,
  e.rent_due_day,
  e.latitude,
  e.longitude,
  e.geocode_formatted_address,
  e.extraction_confidence,
  e.created_at AS agreement_uploaded_at,
  t.id AS tenancy_id,
  t.status AS tenancy_status,
  t.bank_verified,
  t.utility_verified,
  t.landlord_approved,
  iv.status AS m360_status,
  iv.m360_full_name,
  iv.m360_gender,
  iv.m360_date_of_birth,
  iv.m360_age,
  iv.m360_occupation,
  iv.m360_total_income,
  iv.m360_aadhaar_masked,
  iv.m360_credit_score,
  iv.m360_risk_level,
  iv.m360_risk_safe,
  iv.m360_mobile_provider,
  iv.m360_connection_type,
  iv.verified_at AS m360_verified_at,
  ps.successful_payments,
  ps.total_paid_paise,
  ps.total_cashback_earned_paise,
  ps.last_payment_at
FROM users u
LEFT JOIN waitlist_entries w ON w.user_id = u.id
LEFT JOIN LATERAL (
  SELECT * FROM extracted_rental_info ei
  WHERE ei.user_id = u.id AND ei.extraction_status = 'completed'
  ORDER BY ei.created_at DESC LIMIT 1
) e ON true
LEFT JOIN tenancies t ON t.user_id = u.id
LEFT JOIN LATERAL (
  SELECT
    iv2.status, iv2.m360_full_name, iv2.m360_gender, iv2.m360_date_of_birth,
    iv2.m360_age, iv2.m360_occupation, iv2.m360_total_income, iv2.m360_aadhaar_masked,
    iv2.m360_credit_score,
    (iv2.m360_risk_intelligence->>'risk_level') AS m360_risk_level,
    COALESCE(iv2.m360_risk_intelligence->>'is_safe', iv2.m360_risk_intelligence->>'safe')::boolean AS m360_risk_safe,
    COALESCE(iv2.m360_mobile_intelligence->>'current_service_provider', iv2.m360_mobile_intelligence->>'provider') AS m360_mobile_provider,
    (iv2.m360_mobile_intelligence->>'connection_type') AS m360_connection_type,
    iv2.verified_at
  FROM identity_verifications iv2
  WHERE iv2.user_id = u.id
  ORDER BY iv2.created_at DESC LIMIT 1
) iv ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE p.status = 'success') AS successful_payments,
    COALESCE(SUM(p.total_amount_paise) FILTER (WHERE p.status = 'success'), 0) AS total_paid_paise,
    COALESCE(SUM(p.cashback_earned_paise) FILTER (WHERE p.status = 'success'), 0) AS total_cashback_earned_paise,
    MAX(p.paid_at) AS last_payment_at
  FROM payments p WHERE p.user_id = u.id
) ps ON true
ORDER BY u.created_at DESC;

REVOKE ALL ON public.v_user_funnel FROM anon;
GRANT SELECT ON public.v_user_funnel TO service_role;
