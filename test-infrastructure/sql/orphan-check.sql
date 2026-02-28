-- =============================================================================
-- orphan-check.sql
-- FK integrity checks across all Flent Secured tables
-- Finds orphaned records where foreign key targets no longer exist
-- Run against Supabase SQL Editor or psql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Payments with no matching tenancy
-- -----------------------------------------------------------------------------
SELECT 'payments -> tenancies' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(p.id) AS orphan_ids
FROM payments p
LEFT JOIN tenancies t ON p.tenancy_id = t.id
WHERE t.id IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Payments with no matching user (via tenancy -> tenant_id)
-- -----------------------------------------------------------------------------
SELECT 'payments -> users (via tenancy)' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(p.id) AS orphan_ids
FROM payments p
LEFT JOIN tenancies t ON p.tenancy_id = t.id
LEFT JOIN auth.users u ON t.tenant_id = u.id
WHERE t.id IS NOT NULL AND u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Bank accounts with no matching user
-- -----------------------------------------------------------------------------
SELECT 'bank_accounts -> users' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(ba.id) AS orphan_ids
FROM bank_accounts ba
LEFT JOIN auth.users u ON ba.user_id = u.id
WHERE u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 4. Cashback ledger with no matching user
-- -----------------------------------------------------------------------------
SELECT 'cashback_ledger -> users' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(cl.id) AS orphan_ids
FROM cashback_ledger cl
LEFT JOIN auth.users u ON cl.user_id = u.id
WHERE u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Cashback ledger with no matching payment
-- -----------------------------------------------------------------------------
SELECT 'cashback_ledger -> payments' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(cl.id) AS orphan_ids
FROM cashback_ledger cl
LEFT JOIN payments p ON cl.payment_id = p.id
WHERE cl.payment_id IS NOT NULL AND p.id IS NULL;

-- -----------------------------------------------------------------------------
-- 6. Device tokens with no matching user
-- -----------------------------------------------------------------------------
SELECT 'device_tokens -> users' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(dt.id) AS orphan_ids
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
WHERE u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 7. Identity verifications with no matching user
-- -----------------------------------------------------------------------------
SELECT 'identity_verifications -> users' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(iv.id) AS orphan_ids
FROM identity_verifications iv
LEFT JOIN auth.users u ON iv.user_id = u.id
WHERE u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 8. Tenancies with no matching user (tenant_id)
-- -----------------------------------------------------------------------------
SELECT 'tenancies -> users (tenant_id)' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(t.id) AS orphan_ids
FROM tenancies t
LEFT JOIN auth.users u ON t.tenant_id = u.id
WHERE u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 9. Utility verifications with no matching tenancy
-- -----------------------------------------------------------------------------
SELECT 'utility_verifications -> tenancies' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(uv.id) AS orphan_ids
FROM utility_verifications uv
LEFT JOIN tenancies t ON uv.tenancy_id = t.id
WHERE t.id IS NULL;

-- -----------------------------------------------------------------------------
-- 10. Extracted rental info with no matching user
-- -----------------------------------------------------------------------------
SELECT 'extracted_rental_info -> users' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(eri.id) AS orphan_ids
FROM extracted_rental_info eri
LEFT JOIN auth.users u ON eri.user_id = u.id
WHERE u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 11. Waitlist entries with no matching user
-- -----------------------------------------------------------------------------
SELECT 'waitlist_entries -> users' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(we.id) AS orphan_ids
FROM waitlist_entries we
LEFT JOIN auth.users u ON we.user_id = u.id
WHERE we.user_id IS NOT NULL AND u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 12. OTP requests with no matching phone in users
-- -----------------------------------------------------------------------------
SELECT 'otp_requests -> users (phone)' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(otp.id) AS orphan_ids
FROM otp_requests otp
LEFT JOIN auth.users u ON otp.phone = u.phone
WHERE u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 13. Payment schedules with no matching tenancy
-- -----------------------------------------------------------------------------
SELECT 'payment_schedules -> tenancies' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(ps.id) AS orphan_ids
FROM payment_schedules ps
LEFT JOIN tenancies t ON ps.tenancy_id = t.id
WHERE t.id IS NULL;

-- -----------------------------------------------------------------------------
-- 14. Referral redemptions with no matching user
-- -----------------------------------------------------------------------------
SELECT 'referral_redemptions -> users' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(rr.id) AS orphan_ids
FROM referral_redemptions rr
LEFT JOIN auth.users u ON rr.user_id = u.id
WHERE u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 15. Notifications with no matching user
-- -----------------------------------------------------------------------------
SELECT 'notifications -> users' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(n.id) AS orphan_ids
FROM notifications n
LEFT JOIN auth.users u ON n.user_id = u.id
WHERE u.id IS NULL;

-- -----------------------------------------------------------------------------
-- 16. Processed webhooks with no matching payment
-- -----------------------------------------------------------------------------
SELECT 'processed_webhooks -> payments' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(pw.id) AS orphan_ids
FROM processed_webhooks pw
LEFT JOIN payments p ON pw.payment_id = p.id
WHERE pw.payment_id IS NOT NULL AND p.id IS NULL;

-- -----------------------------------------------------------------------------
-- 17. Idempotency keys with no matching user
-- -----------------------------------------------------------------------------
SELECT 'idempotency_keys -> users' AS check_name,
       COUNT(*) AS orphan_count,
       ARRAY_AGG(ik.id) AS orphan_ids
FROM idempotency_keys ik
LEFT JOIN auth.users u ON ik.user_id = u.id
WHERE ik.user_id IS NOT NULL AND u.id IS NULL;
