-- Risk Detail view for the admin Risk Sheet.
-- One row per user with side-by-side verification match values and verdicts.

CREATE OR REPLACE VIEW public.v_risk_detail AS
SELECT
  u.id AS user_id,
  u.phone,
  COALESCE(u.full_name, TRIM(CONCAT(u.first_name, ' ', u.last_name))) AS name,
  u.user_status,
  w.admin_review,
  w.risk_level,

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

  -- 3. Utility Bill: Consumer name + address match
  uv.consumer_name AS utility_consumer_name,
  uv.bill_address AS utility_bill_address,
  e.property_address AS agreement_address,
  uv.address_match_score AS utility_address_score,
  COALESCE(uv.address_verified, false) AS utility_address_verified,
  uv.status AS utility_status,
  COALESCE(t.utility_verified, false) AS tenancy_utility_verified,

  -- 4. Landlord Verification
  t.landlord_status,
  COALESCE(t.landlord_approved, false) AS landlord_approved,

  -- 5. Agreement Quality
  e.extraction_status,
  e.extraction_confidence,
  e.needs_manual_review,
  e.contract_status,
  e.lease_start_date,
  e.lease_end_date,
  CASE
    WHEN e.id IS NULL THEN 'NO_AGREEMENT'
    WHEN e.extraction_status != 'completed' THEN 'INCOMPLETE'
    WHEN e.needs_manual_review = true THEN 'MANUAL_REVIEW'
    WHEN e.lease_end_date IS NOT NULL AND e.lease_end_date < CURRENT_DATE THEN 'EXPIRED'
    WHEN e.extraction_confidence IS NOT NULL AND e.extraction_confidence < 0.7 THEN 'LOW_CONFIDENCE'
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
         ba2.penny_drop_status, ba2.verified
  FROM bank_accounts ba2
  WHERE ba2.user_id = u.id AND ba2.party_type = 'landlord' AND ba2.is_primary = true
  ORDER BY ba2.created_at DESC LIMIT 1
) ba ON true
LEFT JOIN LATERAL (
  SELECT uv2.consumer_name, uv2.bill_address, uv2.address_match_score,
         uv2.address_verified, uv2.status
  FROM utility_verifications uv2
  WHERE uv2.user_id = u.id
  ORDER BY uv2.created_at DESC LIMIT 1
) uv ON true
ORDER BY u.created_at DESC;

REVOKE ALL ON public.v_risk_detail FROM anon;
GRANT SELECT ON public.v_risk_detail TO service_role;
