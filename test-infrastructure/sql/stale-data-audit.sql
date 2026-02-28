-- =============================================================================
-- stale-data-audit.sql
-- Find test data that should NOT be in production
-- Run before every production release to verify clean state
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Users with is_test_user flag (Apple review accounts only)
-- -----------------------------------------------------------------------------
SELECT 'apple_review_users (is_test_user flag)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(u.id) AS user_ids
FROM public.users u
WHERE u.is_test_user = true;

-- -----------------------------------------------------------------------------
-- 2. Users with test phone pattern +91999990XXXX
-- -----------------------------------------------------------------------------
SELECT 'test_phones (999990 pattern)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(json_build_object('id', id, 'phone', phone)) AS details
FROM auth.users
WHERE phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- 3. OTP requests for test phone numbers
-- -----------------------------------------------------------------------------
SELECT 'otp_requests (test phones)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(id) AS request_ids
FROM otp_requests
WHERE phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- 4. Payments from test users
-- -----------------------------------------------------------------------------
SELECT 'payments (test users)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(p.id) AS payment_ids
FROM payments p
JOIN tenancies t ON p.tenancy_id = t.id
JOIN auth.users u ON t.tenant_id = u.id
WHERE u.phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- 5. Waitlist entries from test users
-- -----------------------------------------------------------------------------
SELECT 'waitlist_entries (test users)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(we.id) AS entry_ids
FROM waitlist_entries we
JOIN auth.users u ON we.user_id = u.id
WHERE u.phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- 6. Tenancies from test users
-- -----------------------------------------------------------------------------
SELECT 'tenancies (test users)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(t.id) AS tenancy_ids
FROM tenancies t
JOIN auth.users u ON t.tenant_id = u.id
WHERE u.phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- 7. Bank accounts from test users
-- -----------------------------------------------------------------------------
SELECT 'bank_accounts (test users)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(ba.id) AS account_ids
FROM bank_accounts ba
JOIN auth.users u ON ba.user_id = u.id
WHERE u.phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- 8. Cashback ledger from test users
-- -----------------------------------------------------------------------------
SELECT 'cashback_ledger (test users)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(cl.id) AS ledger_ids
FROM cashback_ledger cl
JOIN auth.users u ON cl.user_id = u.id
WHERE u.phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- 9. Identity verifications from test users
-- -----------------------------------------------------------------------------
SELECT 'identity_verifications (test users)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(iv.id) AS verification_ids
FROM identity_verifications iv
JOIN auth.users u ON iv.user_id = u.id
WHERE u.phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- 10. Notifications for test users
-- -----------------------------------------------------------------------------
SELECT 'notifications (test users)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(n.id) AS notification_ids
FROM notifications n
JOIN auth.users u ON n.user_id = u.id
WHERE u.phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- 11. Device tokens for test users
-- -----------------------------------------------------------------------------
SELECT 'device_tokens (test users)' AS check_name,
       COUNT(*) AS found_count,
       ARRAY_AGG(dt.id) AS token_ids
FROM device_tokens dt
JOIN auth.users u ON dt.user_id = u.id
WHERE u.phone LIKE '%999990%';

-- -----------------------------------------------------------------------------
-- SUMMARY: Quick count of all test artifacts
-- -----------------------------------------------------------------------------
SELECT 'TOTAL TEST ARTIFACTS' AS summary,
       (SELECT COUNT(*) FROM auth.users WHERE phone LIKE '%999990%') AS test_users,
       (SELECT COUNT(*) FROM otp_requests WHERE phone LIKE '%999990%') AS test_otps,
       (
         SELECT COUNT(*) FROM payments p
         JOIN tenancies t ON p.tenancy_id = t.id
         JOIN auth.users u ON t.tenant_id = u.id
         WHERE u.phone LIKE '%999990%'
       ) AS test_payments,
       (
         SELECT COUNT(*) FROM waitlist_entries we
         JOIN auth.users u ON we.user_id = u.id
         WHERE u.phone LIKE '%999990%'
       ) AS test_waitlist;
