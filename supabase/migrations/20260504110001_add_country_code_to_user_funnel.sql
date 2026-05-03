-- Expose tenancies.country_code on v_user_funnel so admin readers (admin-app
-- and Apps Script) can render the landlord phone with its real country code.
--
-- Background: tenancies stores the landlord phone as two columns —
--   country_code   ('+91', '+1', '+61', ...)
--   landlord_phone (local subscriber digits only, no '+', no country code)
-- See 20260504100000_landlord_phone_e164_lookup.sql for the canonical
-- (country_code || landlord_phone) E.164 contract.
--
-- The previous view exposed landlord_phone but not country_code. Display
-- code therefore had to assume +91 and rendered NRI landlords with the wrong
-- country code (e.g. a US landlord shown as +91 9XX XX YYYY). This adds
-- country_code as a sibling column so display code can use the real value
-- and show NULL honestly when it's unknown.
--
-- View must be recreated (Postgres can't ALTER VIEW ADD COLUMN). Existing
-- readers select * (Apps Script) or named columns (admin-app); the only
-- addition is one new column, so this is non-breaking.

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

  -- Waitlist
  w.waitlist_position,
  w.admin_review,
  w.risk_level,
  w.risk_factors,
  w.risk_computed_at,
  w.risk_phase,
  w.created_at AS waitlist_joined_at,

  -- Agreement
  e.id AS extraction_id,
  e.extraction_status,
  e.user_verified AS agreement_verified,
  e.property_address,
  e.property_city,
  e.property_state,
  e.property_pincode,
  e.monthly_rent_paise,
  e.maintenance_paise,
  e.security_deposit_paise,
  e.landlord_name,
  COALESCE(e.landlord_name, (e.landlord_names)[1]) AS landlord_display_name,
  COALESCE(t.landlord_phone, e.landlord_phone) AS landlord_phone,
  t.country_code AS landlord_country_code,
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

  -- Stamp verification (denormalized status columns from extracted_rental_info)
  e.stamp_verification_status,
  e.stamp_verified_at,
  e.stamp_verification_attempt,

  -- Stamp verification — landlord-name signals (from stamp_verifications row)
  sv.shcil_first_party AS shcil_landlord_name,
  CASE
    WHEN sv.status = 'verified' THEN TRUE
    WHEN sv.status = 'mismatch' THEN NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(sv.field_mismatches, '[]'::jsonb)) AS fm
      WHERE fm->>'field' = 'first_party'
    )
    ELSE NULL
  END AS shcil_landlord_name_matched,

  -- Tenancy
  t.id AS tenancy_id,
  t.status AS tenancy_status,
  t.bank_verified,
  t.utility_verified,
  t.landlord_approved,

  -- Landlord identity (M360 — only for landlords who registered & verified)
  lv.m360_full_name AS landlord_m360_full_name,

  -- Landlord bank match (penny-drop holder name vs agreement landlord name)
  lba.agreement_name_matched AS landlord_bank_agreement_name_matched,
  lba.agreement_name_match_score AS landlord_bank_agreement_match_score,

  -- Identity verification / M360 (TENANT, kept as before)
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

  -- Payment summary
  ps.successful_payments,
  ps.total_paid_paise,
  ps.total_cashback_earned_paise,
  ps.last_payment_at

FROM users u

LEFT JOIN waitlist_entries w ON w.user_id = u.id

LEFT JOIN LATERAL (
  SELECT *
  FROM extracted_rental_info ei
  WHERE ei.user_id = u.id
    AND ei.extraction_status IN ('completed', 'extraction_failed')
  ORDER BY ei.created_at DESC
  LIMIT 1
) e ON true

LEFT JOIN LATERAL (
  SELECT
    t2.id,
    t2.status,
    t2.bank_verified,
    t2.utility_verified,
    t2.landlord_approved,
    t2.landlord_phone,
    t2.country_code,
    t2.landlord_user_id
  FROM tenancies t2
  WHERE t2.user_id = u.id
  ORDER BY t2.created_at DESC
  LIMIT 1
) t ON true

-- Latest stamp verification row for the agreement (for landlord-name match)
LEFT JOIN LATERAL (
  SELECT sv2.shcil_first_party, sv2.status, sv2.field_mismatches
  FROM stamp_verifications sv2
  WHERE sv2.extraction_id = e.id
  ORDER BY sv2.created_at DESC
  LIMIT 1
) sv ON true

-- Landlord bank account (penny-drop) — tenant-keyed by design
LEFT JOIN LATERAL (
  SELECT ba.agreement_name_matched, ba.agreement_name_match_score
  FROM bank_accounts ba
  WHERE ba.user_id = u.id
    AND ba.party_type = 'landlord'
  ORDER BY ba.created_at DESC
  LIMIT 1
) lba ON true

-- Landlord's own identity verification (when the landlord registered)
LEFT JOIN LATERAL (
  SELECT iv2.m360_full_name
  FROM identity_verifications iv2
  WHERE iv2.user_id = t.landlord_user_id
  ORDER BY iv2.created_at DESC
  LIMIT 1
) lv ON t.landlord_user_id IS NOT NULL

-- Tenant identity verification (unchanged)
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

-- rollback:
--   DROP VIEW IF EXISTS public.v_user_funnel;
--   -- Then re-run 20260503110000 to restore the previous shape (no
--   -- landlord_country_code column).
