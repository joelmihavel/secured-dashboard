-- Verification Data Analysis view for admin dashboard
-- One row per user with latest verification status from each check type.

CREATE OR REPLACE VIEW public.v_verification_analysis AS
SELECT
  -- ── User ──
  u.id                                        AS user_id,
  u.phone,
  COALESCE(u.full_name, u.first_name || ' ' || u.last_name) AS full_name,
  u.user_status::text,

  -- ── M360 Identity ──
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

  -- ── Tenant Name Match ──
  u.tenant_match_score,
  u.tenant_match_type,
  (u.tenant_match_score IS NOT NULL)          AS tenant_match_attempted,
  CASE
    WHEN u.tenant_match_score IS NULL THEN NULL
    WHEN u.tenant_match_score >= 70 THEN 'PASS'
    ELSE 'FAIL'
  END                                         AS tenant_match_result,

  -- ── Agreement Extraction ──
  eri.extraction_status                       AS agreement_status,
  (eri.id IS NOT NULL)                        AS agreement_attempted,
  (eri.extraction_status = 'completed')       AS agreement_completed,
  eri.extraction_error                        AS agreement_failure_reason,
  COALESCE(eri.confidence_score, eri.extraction_confidence * 100)
                                              AS agreement_confidence,

  -- ── Bank Verification (primary tenant account) ──
  ba_primary.penny_drop_status                AS bank_penny_drop_status,
  (ba_primary.id IS NOT NULL)                 AS bank_attempted,
  COALESCE(t.bank_verified, false)            AS bank_verified,
  CASE
    WHEN ba_primary.penny_drop_status = 'FAILED' THEN 'Penny drop failed'
    WHEN ba_primary.verified = false AND ba_primary.id IS NOT NULL THEN 'Not yet verified'
    ELSE NULL
  END                                         AS bank_failure_reason,
  ba_primary.agreement_name_matched           AS bank_agreement_name_match,

  -- ── PAN Verification ──
  COALESCE(t.pan_verified, false)             AS pan_verified,
  (ba_primary.pan_number_masked IS NOT NULL)  AS pan_attempted,
  CASE
    WHEN t.pan_verified = true THEN 'Verified'
    WHEN ba_primary.pan_number_masked IS NOT NULL AND COALESCE(t.pan_verified, false) = false THEN 'Attempted — not verified'
    ELSE 'Not attempted'
  END                                         AS pan_status,

  -- ── Utility Verification ──
  uv.status                                   AS utility_status,
  (uv.id IS NOT NULL)                         AS utility_attempted,
  COALESCE(t.utility_verified, false)         AS utility_verified,
  uv.name_verified                            AS utility_name_match,
  uv.address_verified                         AS utility_address_match,

  -- ── Landlord Approval ──
  t.landlord_status,
  COALESCE(t.landlord_approved, false)        AS landlord_approved,
  t.landlord_phone,
  t.landlord_approved_at                      AS landlord_response_at,

  -- ── Risk ──
  w.risk_level,
  w.risk_factors,
  w.admin_review,

  -- ── Overall (6 checks) ──
  (
    (CASE WHEN iv.status = 'SUCCESS' THEN 1 ELSE 0 END)
  + (CASE WHEN u.tenant_match_score >= 70 THEN 1 ELSE 0 END)
  + (CASE WHEN t.bank_verified = true THEN 1 ELSE 0 END)
  + (CASE WHEN t.pan_verified = true THEN 1 ELSE 0 END)
  + (CASE WHEN t.utility_verified = true THEN 1 ELSE 0 END)
  + (CASE WHEN t.landlord_approved = true THEN 1 ELSE 0 END)
  )                                           AS checks_passed,
  6                                           AS checks_total

FROM public.users u

-- Latest identity verification
LEFT JOIN LATERAL (
  SELECT id, status, created_at
  FROM identity_verifications
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) iv ON true

-- Latest agreement extraction
LEFT JOIN LATERAL (
  SELECT id, extraction_status, extraction_error, extraction_confidence, confidence_score
  FROM extracted_rental_info
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) eri ON true

-- Primary tenant bank account
LEFT JOIN LATERAL (
  SELECT id, penny_drop_status, verified, agreement_name_matched, pan_number_masked
  FROM bank_accounts
  WHERE user_id = u.id AND party_type = 'tenant' AND is_primary = true
  ORDER BY created_at DESC
  LIMIT 1
) ba_primary ON true

-- Latest utility verification
LEFT JOIN LATERAL (
  SELECT id, status, name_verified, address_verified
  FROM utility_verifications
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) uv ON true

-- Latest tenancy
LEFT JOIN LATERAL (
  SELECT bank_verified, utility_verified, landlord_approved, pan_verified,
         landlord_status, landlord_phone, landlord_approved_at
  FROM tenancies
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) t ON true

-- Waitlist entry
LEFT JOIN LATERAL (
  SELECT risk_level, risk_factors, admin_review
  FROM waitlist_entries
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) w ON true

ORDER BY u.created_at DESC;

-- Permissions
GRANT SELECT ON public.v_verification_analysis TO anon, authenticated, service_role;
