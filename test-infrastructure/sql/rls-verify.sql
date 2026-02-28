-- =============================================================================
-- rls-verify.sql
-- Row Level Security verification queries for Flent Secured
-- Tests cross-tenant isolation, service role bypass, and anonymous access
--
-- Usage:
--   Run in Supabase SQL Editor or psql.
--   Replace <TENANT_A_ID> and <TENANT_B_ID> with actual user UUIDs.
--   These queries use SET to simulate different auth contexts.
-- =============================================================================

-- =============================================================================
-- SETUP: Define test user IDs (replace with real UUIDs)
-- =============================================================================
-- \set tenant_a_id '''<TENANT_A_ID>'''
-- \set tenant_b_id '''<TENANT_B_ID>'''

-- =============================================================================
-- PART 1: Cross-tenant isolation
-- Tenant A should NOT see Tenant B's data
-- =============================================================================

-- Simulate Tenant A's JWT context
-- In Supabase SQL Editor, use: SET request.jwt.claim.sub = '<TENANT_A_ID>';
-- In psql connected via service role, use:
SET ROLE authenticated;
SET request.jwt.claim.sub = '<TENANT_A_ID>';
SET request.jwt.claim.role = 'authenticated';

-- 1a. Tenant A should only see their own payments
SELECT 'payments: tenant_a sees own' AS test,
       COUNT(*) AS row_count
FROM payments p
JOIN tenancies t ON p.tenancy_id = t.id
WHERE t.tenant_id = '<TENANT_A_ID>';

-- 1b. Tenant A should NOT see Tenant B's payments
SELECT 'payments: tenant_a cannot see tenant_b' AS test,
       COUNT(*) AS row_count
FROM payments p
JOIN tenancies t ON p.tenancy_id = t.id
WHERE t.tenant_id = '<TENANT_B_ID>';
-- EXPECTED: 0 rows

-- 1c. Tenant A should only see their own bank accounts
SELECT 'bank_accounts: tenant_a sees own' AS test,
       COUNT(*) AS row_count
FROM bank_accounts
WHERE user_id = '<TENANT_A_ID>';

-- 1d. Tenant A should NOT see Tenant B's bank accounts
SELECT 'bank_accounts: tenant_a cannot see tenant_b' AS test,
       COUNT(*) AS row_count
FROM bank_accounts
WHERE user_id = '<TENANT_B_ID>';
-- EXPECTED: 0 rows

-- 1e. Tenant A should only see their own tenancies
SELECT 'tenancies: tenant_a sees own' AS test,
       COUNT(*) AS row_count
FROM tenancies
WHERE tenant_id = '<TENANT_A_ID>';

-- 1f. Tenant A should NOT see Tenant B's tenancies
SELECT 'tenancies: tenant_a cannot see tenant_b' AS test,
       COUNT(*) AS row_count
FROM tenancies
WHERE tenant_id = '<TENANT_B_ID>';
-- EXPECTED: 0 rows

-- 1g. Tenant A should only see their own identity verifications
SELECT 'identity_verifications: tenant_a sees own' AS test,
       COUNT(*) AS row_count
FROM identity_verifications
WHERE user_id = '<TENANT_A_ID>';

-- 1h. Tenant A should NOT see Tenant B's identity verifications
SELECT 'identity_verifications: tenant_a cannot see tenant_b' AS test,
       COUNT(*) AS row_count
FROM identity_verifications
WHERE user_id = '<TENANT_B_ID>';
-- EXPECTED: 0 rows

-- 1i. Tenant A should only see their own cashback ledger
SELECT 'cashback_ledger: tenant_a sees own' AS test,
       COUNT(*) AS row_count
FROM cashback_ledger
WHERE user_id = '<TENANT_A_ID>';

-- 1j. Tenant A should NOT see Tenant B's cashback ledger
SELECT 'cashback_ledger: tenant_a cannot see tenant_b' AS test,
       COUNT(*) AS row_count
FROM cashback_ledger
WHERE user_id = '<TENANT_B_ID>';
-- EXPECTED: 0 rows

-- 1k. Tenant A should only see their own notifications
SELECT 'notifications: tenant_a sees own' AS test,
       COUNT(*) AS row_count
FROM notifications
WHERE user_id = '<TENANT_A_ID>';

-- 1l. Tenant A should NOT see Tenant B's notifications
SELECT 'notifications: tenant_a cannot see tenant_b' AS test,
       COUNT(*) AS row_count
FROM notifications
WHERE user_id = '<TENANT_B_ID>';
-- EXPECTED: 0 rows

-- Reset role
RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;


-- =============================================================================
-- PART 2: Service role bypass
-- Service role should see ALL data regardless of RLS
-- =============================================================================

-- Service role is the default when connected with service_role key
-- No SET ROLE needed — just run directly

SELECT 'service_role: payments (all)' AS test,
       COUNT(*) AS row_count
FROM payments;

SELECT 'service_role: bank_accounts (all)' AS test,
       COUNT(*) AS row_count
FROM bank_accounts;

SELECT 'service_role: tenancies (all)' AS test,
       COUNT(*) AS row_count
FROM tenancies;

SELECT 'service_role: identity_verifications (all)' AS test,
       COUNT(*) AS row_count
FROM identity_verifications;

SELECT 'service_role: cashback_ledger (all)' AS test,
       COUNT(*) AS row_count
FROM cashback_ledger;

SELECT 'service_role: notifications (all)' AS test,
       COUNT(*) AS row_count
FROM notifications;


-- =============================================================================
-- PART 3: Anonymous access denied
-- Anonymous role should NOT be able to read protected tables
-- =============================================================================

SET ROLE anon;

-- Each of these should return 0 rows or raise a permission error
SELECT 'anon: payments' AS test, COUNT(*) AS row_count FROM payments;
SELECT 'anon: bank_accounts' AS test, COUNT(*) AS row_count FROM bank_accounts;
SELECT 'anon: tenancies' AS test, COUNT(*) AS row_count FROM tenancies;
SELECT 'anon: identity_verifications' AS test, COUNT(*) AS row_count FROM identity_verifications;
SELECT 'anon: cashback_ledger' AS test, COUNT(*) AS row_count FROM cashback_ledger;
SELECT 'anon: notifications' AS test, COUNT(*) AS row_count FROM notifications;
SELECT 'anon: device_tokens' AS test, COUNT(*) AS row_count FROM device_tokens;
SELECT 'anon: utility_verifications' AS test, COUNT(*) AS row_count FROM utility_verifications;
SELECT 'anon: extracted_rental_info' AS test, COUNT(*) AS row_count FROM extracted_rental_info;
SELECT 'anon: payment_schedules' AS test, COUNT(*) AS row_count FROM payment_schedules;
SELECT 'anon: referral_redemptions' AS test, COUNT(*) AS row_count FROM referral_redemptions;
SELECT 'anon: processed_webhooks' AS test, COUNT(*) AS row_count FROM processed_webhooks;

RESET ROLE;


-- =============================================================================
-- PART 4: RLS policy inventory
-- List all RLS policies for auditing
-- =============================================================================

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =============================================================================
-- PART 5: Tables with RLS disabled (should be empty for protected tables)
-- =============================================================================

SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;
