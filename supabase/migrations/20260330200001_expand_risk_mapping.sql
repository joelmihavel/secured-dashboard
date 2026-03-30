-- Expand risk mapping: add risk_phase column, update admin views with PAN/bank/risk fields.
-- Supports the 14-signal risk engine in risk-utils.ts.

-- ============================================================
-- 1. Add risk_phase column to waitlist_entries
-- ============================================================

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS risk_phase TEXT DEFAULT 'pre'
  CHECK (risk_phase IN ('pre', 'post'));

COMMENT ON COLUMN public.waitlist_entries.risk_phase
  IS 'Which risk computation phase last ran: pre (only pre-waitlist signals) or post (includes M360/utility/landlord)';

-- ============================================================
-- 2. Update v_risk_detail — add PAN, bank agreement match,
--    risk_phase, risk_computed_at, confidence_score, landlord_status
-- ============================================================

CREATE OR REPLACE VIEW public.v_risk_detail AS
SELECT
  u.id AS user_id,
  u.phone,
  COALESCE(u.full_name, TRIM(CONCAT(u.first_name, ' ', u.last_name))) AS name,
  u.user_status,
  w.admin_review,
  w.risk_level,
  w.risk_phase,
  w.risk_computed_at,

  -- 1. Tenant Name Match: M360 name vs Agreement tenant name
  iv.m360_full_name,
  COALESCE(e.tenant_name, (e.tenant_names)[1]) AS agreement_tenant_name,
  u.tenant_match_score,
  u.tenant_match_type,

  -- 2. Penny Drop: Bank holder name vs Agreement landlord name
  ba.verified_account_holder_name AS bank_holder_name,
  COALESCE(e.landlord_name, (e.landlord_names)[1]) AS agreement_landlord_name,
  ba.penny_drop_name_match_score AS bank_name_match_score,
  ba.penny_drop_status,
  COALESCE(ba.verified, false) AS bank_verified,

  -- 2b. Bank Agreement Name Match (Gemini AI match vs agreement landlord)
  ba.agreement_name_matched AS bank_agreement_name_matched,
  ba.agreement_name_match_score AS bank_agreement_match_score,

  -- 2c. PAN Verification
  ba.pan_verified,
  ba.pan_name_matched,
  ba.pan_status,
  ba.pan_type,
  ba.pan_registered_name,
  ba.pan_name_match_score AS pan_match_score,

  -- 3. Utility Bill: Consumer name + address match
  uv.consumer_name AS utility_consumer_name,
  uv.bill_address AS utility_bill_address,
  e.property_address AS agreement_address,
  uv.address_match_score AS utility_address_score,
  COALESCE(uv.address_verified, false) AS utility_address_verified,
  uv.name_match_score AS utility_name_score,
  COALESCE(uv.name_verified, false) AS utility_name_verified,
  uv.status AS utility_status,
  COALESCE(t.utility_verified, false) AS tenancy_utility_verified,

  -- 4. Landlord Verification
  t.landlord_status,
  COALESCE(t.landlord_approved, false) AS landlord_approved,

  -- 5. Agreement Quality
  e.extraction_status,
  e.extraction_confidence,
  e.confidence_score,
  e.needs_manual_review,
  e.contract_status,
  e.lease_start_date,
  e.lease_end_date,
  e.monthly_rent_paise,
  CASE
    WHEN e.id IS NULL THEN 'NO_AGREEMENT'
    WHEN e.extraction_status != 'completed' THEN 'INCOMPLETE'
    WHEN e.needs_manual_review = true THEN 'MANUAL_REVIEW'
    WHEN e.lease_end_date IS NOT NULL AND e.lease_end_date < CURRENT_DATE THEN 'EXPIRED'
    WHEN e.confidence_score IS NOT NULL AND e.confidence_score < 50 THEN 'LOW_CONFIDENCE'
    WHEN e.extraction_confidence IS NOT NULL AND e.extraction_confidence < 0.5 THEN 'LOW_CONFIDENCE'
    ELSE 'OK'
  END AS agreement_verdict,

  -- 6. Risk factors (JSONB for detailed breakdown)
  w.risk_factors

FROM users u
LEFT JOIN waitlist_entries w ON w.user_id = u.id
-- Prefer extraction linked via waitlist_entries.extraction_id
LEFT JOIN LATERAL (
  SELECT * FROM extracted_rental_info ei
  WHERE ei.user_id = u.id AND ei.extraction_status = 'completed'
  ORDER BY
    CASE WHEN w.extraction_id IS NOT NULL AND ei.id = w.extraction_id THEN 0 ELSE 1 END,
    ei.created_at DESC
  LIMIT 1
) e ON true
LEFT JOIN LATERAL (
  SELECT * FROM tenancies t2
  WHERE t2.user_id = u.id
  ORDER BY t2.created_at DESC LIMIT 1
) t ON true
LEFT JOIN LATERAL (
  SELECT iv2.m360_full_name
  FROM identity_verifications iv2
  WHERE iv2.user_id = u.id
  ORDER BY iv2.created_at DESC LIMIT 1
) iv ON true
LEFT JOIN LATERAL (
  SELECT ba2.verified_account_holder_name, ba2.penny_drop_name_match_score,
         ba2.penny_drop_status, ba2.verified,
         ba2.agreement_name_matched, ba2.agreement_name_match_score,
         ba2.pan_verified, ba2.pan_name_matched, ba2.pan_status,
         ba2.pan_type, ba2.pan_registered_name, ba2.pan_name_match_score
  FROM bank_accounts ba2
  WHERE ba2.user_id = u.id AND ba2.party_type = 'landlord' AND ba2.is_primary = true
  ORDER BY ba2.created_at DESC LIMIT 1
) ba ON true
LEFT JOIN LATERAL (
  SELECT uv2.consumer_name, uv2.bill_address, uv2.address_match_score,
         uv2.address_verified, uv2.name_match_score, uv2.name_verified, uv2.status
  FROM utility_verifications uv2
  WHERE uv2.user_id = u.id
  ORDER BY uv2.created_at DESC LIMIT 1
) uv ON true
ORDER BY u.created_at DESC;

REVOKE ALL ON public.v_risk_detail FROM anon;
GRANT SELECT ON public.v_risk_detail TO service_role;

-- ============================================================
-- 3. Update v_user_funnel — add risk_factors, risk_computed_at, risk_phase
-- ============================================================

CREATE OR REPLACE VIEW public.v_user_funnel AS
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

  -- Tenancy
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

LEFT JOIN tenancies t ON t.user_id = u.id

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

-- ============================================================
-- 4. Update v_verification_analysis — add PAN details, risk_phase,
--    risk_computed_at, and include PAN in checks_passed count (7 total)
-- ============================================================

CREATE OR REPLACE VIEW public.v_verification_analysis AS
SELECT
  -- User
  u.id                                        AS user_id,
  u.phone,
  COALESCE(u.full_name, u.first_name || ' ' || u.last_name) AS full_name,
  u.user_status::text,

  -- M360 Identity
  iv.status                                   AS m360_status,
  (iv.id IS NOT NULL)                         AS m360_attempted,
  (iv.status = 'SUCCESS')                     AS m360_completed,
  CASE
    WHEN iv.status = 'FAILED' THEN 'Verification failed'
    WHEN iv.status = 'OTP_EXPIRED' THEN 'OTP expired'
    WHEN iv.status = 'OTP_INVALID' THEN 'Invalid OTP'
    WHEN iv.status = 'DETAILS_NOT_FOUND' THEN 'Details not found'
    ELSE NULL
  END                                         AS m360_failure_reason,
  iv.created_at                               AS m360_created_at,

  -- Tenant Name Match
  u.tenant_match_score,
  u.tenant_match_type,
  (u.tenant_match_score IS NOT NULL)          AS tenant_match_attempted,
  CASE
    WHEN u.tenant_match_score IS NULL THEN NULL
    WHEN u.tenant_match_score >= 70 THEN 'PASS'
    ELSE 'FAIL'
  END                                         AS tenant_match_result,

  -- Agreement Extraction
  eri.extraction_status                       AS agreement_status,
  (eri.id IS NOT NULL)                        AS agreement_attempted,
  (eri.extraction_status = 'completed')       AS agreement_completed,
  eri.extraction_error                        AS agreement_failure_reason,
  COALESCE(eri.confidence_score, eri.extraction_confidence * 100)
                                              AS agreement_confidence,

  -- Bank Verification (primary landlord account)
  ba_primary.penny_drop_status                AS bank_penny_drop_status,
  (ba_primary.id IS NOT NULL)                 AS bank_attempted,
  COALESCE(t.bank_verified, false)            AS bank_verified,
  CASE
    WHEN ba_primary.penny_drop_status = 'FAILED' THEN 'Penny drop failed'
    WHEN ba_primary.verified = false AND ba_primary.id IS NOT NULL THEN 'Not yet verified'
    ELSE NULL
  END                                         AS bank_failure_reason,
  ba_primary.agreement_name_matched           AS bank_agreement_name_match,
  ba_primary.agreement_name_match_score       AS bank_agreement_match_score,

  -- PAN Verification (expanded)
  COALESCE(ba_primary.pan_verified, false)    AS pan_verified,
  (ba_primary.pan_number_masked IS NOT NULL)  AS pan_attempted,
  ba_primary.pan_name_matched                 AS pan_name_matched,
  ba_primary.pan_status                       AS pan_status_detail,
  ba_primary.pan_type,
  ba_primary.pan_registered_name,
  ba_primary.pan_name_match_score             AS pan_match_score,
  CASE
    WHEN ba_primary.pan_verified = true AND ba_primary.pan_name_matched = true THEN 'Verified + Name Matched'
    WHEN ba_primary.pan_verified = true THEN 'Verified — name not matched'
    WHEN ba_primary.pan_number_masked IS NOT NULL THEN 'Attempted — not verified'
    ELSE 'Not attempted'
  END                                         AS pan_verification_status,

  -- Utility Verification
  uv.status                                   AS utility_status,
  (uv.id IS NOT NULL)                         AS utility_attempted,
  COALESCE(t.utility_verified, false)         AS utility_verified,
  uv.name_verified                            AS utility_name_match,
  uv.address_verified                         AS utility_address_match,

  -- Landlord Approval
  t.landlord_status,
  COALESCE(t.landlord_approved, false)        AS landlord_approved,
  t.landlord_phone,
  t.landlord_approved_at                      AS landlord_response_at,

  -- Risk
  w.risk_level,
  w.risk_factors,
  w.risk_phase,
  w.risk_computed_at,
  w.admin_review,

  -- Overall (7 checks now — added PAN)
  (
    (CASE WHEN iv.status = 'SUCCESS' THEN 1 ELSE 0 END)
  + (CASE WHEN u.tenant_match_score >= 70 THEN 1 ELSE 0 END)
  + (CASE WHEN t.bank_verified = true THEN 1 ELSE 0 END)
  + (CASE WHEN ba_primary.pan_verified = true AND ba_primary.pan_name_matched = true THEN 1 ELSE 0 END)
  + (CASE WHEN t.utility_verified = true THEN 1 ELSE 0 END)
  + (CASE WHEN t.landlord_approved = true THEN 1 ELSE 0 END)
  + (CASE WHEN eri.extraction_status = 'completed' AND COALESCE(eri.confidence_score, eri.extraction_confidence * 100) >= 70 THEN 1 ELSE 0 END)
  )                                           AS checks_passed,
  7                                           AS checks_total

FROM public.users u

LEFT JOIN LATERAL (
  SELECT id, status, created_at
  FROM identity_verifications
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) iv ON true

LEFT JOIN LATERAL (
  SELECT id, extraction_status, extraction_error, extraction_confidence, confidence_score
  FROM extracted_rental_info
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) eri ON true

LEFT JOIN LATERAL (
  SELECT id, penny_drop_status, verified, agreement_name_matched, agreement_name_match_score,
         pan_number_masked, pan_verified, pan_name_matched, pan_status, pan_type,
         pan_registered_name, pan_name_match_score
  FROM bank_accounts
  WHERE user_id = u.id AND party_type = 'landlord' AND is_primary = true
  ORDER BY created_at DESC
  LIMIT 1
) ba_primary ON true

LEFT JOIN LATERAL (
  SELECT id, status, name_verified, address_verified
  FROM utility_verifications
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) uv ON true

LEFT JOIN LATERAL (
  SELECT bank_verified, utility_verified, landlord_approved, pan_verified,
         landlord_status, landlord_phone, landlord_approved_at
  FROM tenancies
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) t ON true

LEFT JOIN LATERAL (
  SELECT risk_level, risk_factors, risk_phase, risk_computed_at, admin_review
  FROM waitlist_entries
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) w ON true

ORDER BY u.created_at DESC;

GRANT SELECT ON public.v_verification_analysis TO anon, authenticated, service_role;
