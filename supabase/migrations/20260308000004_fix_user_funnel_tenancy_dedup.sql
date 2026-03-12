-- Fix: v_user_funnel produces duplicate rows when a user has multiple tenancies.
-- All other JOINs use LATERAL ... LIMIT 1 but tenancies was a plain LEFT JOIN.
-- Also delete orphan duplicate tenancies that slipped past the unique constraint
-- (caused by NULL extracted_rental_info_id on one of the pair).

-- Step 1: Clean up duplicate tenancies — keep the one linked to the extraction
-- For each user with multiple tenancies for the same extraction, keep the newest one.
DELETE FROM tenancies t1
USING tenancies t2
WHERE t1.user_id = t2.user_id
  AND t1.id <> t2.id
  AND t1.created_at < t2.created_at
  AND (
    -- Same extraction_id (non-null)
    (t1.extracted_rental_info_id = t2.extracted_rental_info_id AND t1.extracted_rental_info_id IS NOT NULL)
    OR
    -- One has NULL extraction_id and same address (orphan duplicate)
    (t1.extracted_rental_info_id IS NULL AND t2.extracted_rental_info_id IS NOT NULL
     AND t1.property_address = t2.property_address)
  );

-- Step 2: Recreate view with LATERAL LIMIT 1 for tenancies
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

  -- Landlord bank account (primary)
  ba.account_number_masked AS ll_bank_account_masked,
  ba.ifsc_code AS ll_bank_ifsc,
  ba.verified AS ll_bank_verified,
  ba.verified_account_holder_name AS ll_bank_holder_name,
  ba.penny_drop_status AS ll_penny_drop_status,
  ba.penny_drop_name_match_score AS ll_bank_name_match_score,
  ba.agreement_name_matched AS ll_bank_name_matched,

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
LEFT JOIN LATERAL (
  SELECT * FROM tenancies t2
  WHERE t2.user_id = u.id
  ORDER BY t2.created_at DESC LIMIT 1
) t ON true
LEFT JOIN LATERAL (
  SELECT
    ba2.account_number_masked, ba2.ifsc_code, ba2.verified,
    ba2.verified_account_holder_name, ba2.penny_drop_status,
    ba2.penny_drop_name_match_score, ba2.agreement_name_matched
  FROM bank_accounts ba2
  WHERE ba2.user_id = u.id AND ba2.party_type = 'landlord' AND ba2.is_primary = true
  ORDER BY ba2.created_at DESC LIMIT 1
) ba ON true
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