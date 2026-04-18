-- Fix: v_user_funnel produces duplicate rows when a user has multiple tenancies.
--
-- Root cause: the tenancy join was `LEFT JOIN tenancies t ON t.user_id = u.id`
-- with no LIMIT. Users who re-uploaded agreements accumulated multiple tenancies
-- (one per extraction), so the view fanned out (one row per tenancy).
--
-- Fix: use LEFT JOIN LATERAL with ORDER BY created_at DESC LIMIT 1, matching
-- the pattern already used for extractions and identity verifications in the
-- same view. This always shows the tenancy tied to the latest extraction.

DROP VIEW IF EXISTS public.v_user_funnel;

CREATE VIEW public.v_user_funnel AS
SELECT
  -- User basics
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

  -- Waitlist (expanded with risk details)
  w.waitlist_position,
  w.admin_review,
  w.risk_level,
  w.risk_factors,
  w.risk_computed_at,
  w.risk_phase,
  w.created_at AS waitlist_joined_at,

  -- Agreement (latest extraction — completed or extraction_failed)
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
  e.rooms_in_agreement,
  e.property_bhk_type,
  e.latitude,
  e.longitude,
  e.geocode_formatted_address,
  e.extraction_confidence,
  e.created_at AS agreement_uploaded_at,

  -- Tenancy (latest)
  t.id AS tenancy_id,
  t.status AS tenancy_status,
  t.bank_verified,
  t.utility_verified,
  t.landlord_approved,

  -- Identity verification / M360 (latest)
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

  -- Payment summary (aggregated)
  ps.successful_payments,
  ps.total_paid_paise,
  ps.total_cashback_earned_paise,
  ps.last_payment_at

FROM users u

LEFT JOIN waitlist_entries w ON w.user_id = u.id

-- Latest extraction (completed or extraction_failed — show both for admin visibility)
LEFT JOIN LATERAL (
  SELECT *
  FROM extracted_rental_info ei
  WHERE ei.user_id = u.id
    AND ei.extraction_status IN ('completed', 'extraction_failed')
  ORDER BY ei.created_at DESC
  LIMIT 1
) e ON true

-- Latest tenancy (users who re-upload accumulate multiple tenancies; show
-- the most recent to avoid row-fanout duplicates in the admin dashboard)
LEFT JOIN LATERAL (
  SELECT
    t2.id,
    t2.status,
    t2.bank_verified,
    t2.utility_verified,
    t2.landlord_approved
  FROM tenancies t2
  WHERE t2.user_id = u.id
  ORDER BY t2.created_at DESC
  LIMIT 1
) t ON true

-- Latest identity verification (expanded M360 data)
LEFT JOIN LATERAL (
  SELECT
    iv2.status,
    iv2.m360_full_name,
    iv2.m360_gender,
    iv2.m360_date_of_birth,
    iv2.m360_age,
    iv2.m360_occupation,
    iv2.m360_total_income,
    iv2.m360_aadhaar_masked,
    iv2.m360_credit_score,
    (iv2.m360_risk_intelligence->>'risk_level') AS m360_risk_level,
    (iv2.m360_risk_intelligence->>'safe')::boolean AS m360_risk_safe,
    (iv2.m360_mobile_intelligence->>'provider') AS m360_mobile_provider,
    (iv2.m360_mobile_intelligence->>'connection_type') AS m360_connection_type,
    iv2.verified_at
  FROM identity_verifications iv2
  WHERE iv2.user_id = u.id
  ORDER BY iv2.created_at DESC
  LIMIT 1
) iv ON true

-- Payment aggregates
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE p.status = 'success') AS successful_payments,
    COALESCE(SUM(p.total_amount_paise) FILTER (WHERE p.status = 'success'), 0) AS total_paid_paise,
    COALESCE(SUM(p.cashback_earned_paise) FILTER (WHERE p.status = 'success'), 0) AS total_cashback_earned_paise,
    MAX(p.paid_at) AS last_payment_at
  FROM payments p
  WHERE p.user_id = u.id
) ps ON true

ORDER BY u.created_at DESC;

REVOKE ALL ON public.v_user_funnel FROM anon;
REVOKE ALL ON public.v_user_funnel FROM authenticated;
GRANT SELECT ON public.v_user_funnel TO service_role;
