-- =============================================================================
-- Flent Secured v2 - Row Level Security Policy Tests (pgTAP)
-- =============================================================================
-- Validates that RLS policies correctly isolate data between users.
-- For a fintech app, a single RLS misconfiguration can leak PII or
-- financial data. Every policy on every security-sensitive table is tested.
--
-- Approach:
--   - Create two test users (tenant1 and tenant2) plus a landlord.
--   - Insert data owned by each user.
--   - Use SET LOCAL ROLE + request.jwt.claims to simulate authenticated access.
--   - Verify user can see own data but NOT other users' data.
--   - Verify anonymous role is fully blocked.
--   - Verify service_role bypasses RLS.
-- =============================================================================

BEGIN;

SELECT plan(34);

-- =============================================================================
-- SETUP: Create test users via helper
-- =============================================================================

SELECT test_helpers.create_test_user(
    'deadbeef-0001-0001-0001-000000000001'::uuid,
    '+919100000001',
    'rls_tenant1@test.flent',
    'Tenant',
    'One'
);
SELECT test_helpers.create_test_user(
    'deadbeef-0001-0001-0001-000000000002'::uuid,
    '+919100000002',
    'rls_tenant2@test.flent',
    'Tenant',
    'Two'
);
SELECT test_helpers.create_test_user(
    'deadbeef-0001-0001-0001-000000000003'::uuid,
    '+919100000003',
    'rls_landlord@test.flent',
    'Landlord',
    'One'
);

-- =============================================================================
-- SETUP: Create tenancies
-- =============================================================================

INSERT INTO tenancies (
    id, user_id, property_address, property_city, property_state,
    property_pincode, monthly_rent_paise, rent_due_day,
    lease_start_date, lease_end_date, landlord_name, landlord_phone,
    landlord_user_id, status
)
VALUES
    -- Tenant 1's tenancy (landlord is user 3)
    ('deadbeef-0002-0002-0002-000000000001',
     'deadbeef-0001-0001-0001-000000000001',
     '100 RLS Test Lane', 'Mumbai', 'Maharashtra', '400001',
     5000000, 5, '2024-01-01', '2025-01-01',
     'Landlord One', '+919100000003',
     'deadbeef-0001-0001-0001-000000000003', 'active'),
    -- Tenant 2's tenancy (no landlord user linked)
    ('deadbeef-0002-0002-0002-000000000002',
     'deadbeef-0001-0001-0001-000000000002',
     '200 RLS Test Ave', 'Delhi', 'Delhi', '110001',
     6000000, 10, '2024-01-01', '2025-01-01',
     'Some Other Landlord', '+919100000099',
     NULL, 'active');

-- =============================================================================
-- SETUP: Create payments
-- =============================================================================

INSERT INTO payments (
    id, tenancy_id, rent_amount_paise, pg_fee_paise,
    cashback_applied_paise, total_amount_paise, status,
    payment_method, due_date, payment_month, idempotency_key
)
VALUES
    ('deadbeef-0003-0003-0003-000000000001',
     'deadbeef-0002-0002-0002-000000000001',
     5000000, 0, 0, 5000000, 'success', 'upi',
     '2024-02-05', '2024-02-01', 'rls_idem_001'),
    ('deadbeef-0003-0003-0003-000000000002',
     'deadbeef-0002-0002-0002-000000000002',
     6000000, 0, 0, 6000000, 'success', 'upi',
     '2024-02-10', '2024-02-01', 'rls_idem_002');

-- =============================================================================
-- SETUP: Create bank accounts
-- =============================================================================

INSERT INTO bank_accounts (
    id, user_id, party_type, account_holder_name,
    account_number_masked, account_number_encrypted,
    ifsc_code, bank_name, verified
)
VALUES
    ('deadbeef-0004-0004-0004-000000000001',
     'deadbeef-0001-0001-0001-000000000001',
     'landlord', 'Landlord Via T1',
     'XXXX9001', 'enc_rls_001', 'HDFC0000001', 'HDFC Bank', true),
    ('deadbeef-0004-0004-0004-000000000002',
     'deadbeef-0001-0001-0001-000000000002',
     'landlord', 'Landlord Via T2',
     'XXXX9002', 'enc_rls_002', 'ICIC0000001', 'ICICI Bank', true);

-- =============================================================================
-- SETUP: Create extracted_rental_info
-- =============================================================================

INSERT INTO extracted_rental_info (
    id, user_id, document_storage_path, document_type,
    extraction_status, landlord_name, tenant_name
)
VALUES
    ('deadbeef-0005-0005-0005-000000000001',
     'deadbeef-0001-0001-0001-000000000001',
     '/test/doc1.pdf', 'lease_agreement', 'completed',
     'Landlord One', 'Tenant One'),
    ('deadbeef-0005-0005-0005-000000000002',
     'deadbeef-0001-0001-0001-000000000002',
     '/test/doc2.pdf', 'lease_agreement', 'completed',
     'Landlord Two', 'Tenant Two');

-- =============================================================================
-- SETUP: Create cashback ledger entries
-- =============================================================================

INSERT INTO cashback_ledger (
    id, user_id, tenancy_id, payment_id,
    transaction_type, amount_paise, balance_after_paise, description
)
VALUES
    ('deadbeef-0006-0006-0006-000000000001',
     'deadbeef-0001-0001-0001-000000000001',
     'deadbeef-0002-0002-0002-000000000001',
     'deadbeef-0003-0003-0003-000000000001',
     'earned', 50000, 50000, 'RLS test cashback T1'),
    ('deadbeef-0006-0006-0006-000000000002',
     'deadbeef-0001-0001-0001-000000000002',
     'deadbeef-0002-0002-0002-000000000002',
     'deadbeef-0003-0003-0003-000000000002',
     'earned', 60000, 60000, 'RLS test cashback T2');

-- =============================================================================
-- SETUP: Create identity verifications
-- =============================================================================

INSERT INTO identity_verifications (
    id, user_id, verification_id, status, m360_full_name
)
VALUES
    ('deadbeef-0007-0007-0007-000000000001',
     'deadbeef-0001-0001-0001-000000000001',
     'VER_RLS_001', 'SUCCESS', 'Tenant One'),
    ('deadbeef-0007-0007-0007-000000000002',
     'deadbeef-0001-0001-0001-000000000002',
     'VER_RLS_002', 'SUCCESS', 'Tenant Two');

-- =============================================================================
-- TEST GROUP 1: USERS TABLE RLS
-- =============================================================================

-- Tenant 1 can read own row
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM users WHERE id = ''deadbeef-0001-0001-0001-000000000001''',
    ARRAY[1],
    'users RLS: Tenant 1 can read own user row'
);

-- Tenant 1 cannot read Tenant 2
SELECT results_eq(
    'SELECT count(*)::int FROM users WHERE id = ''deadbeef-0001-0001-0001-000000000002''',
    ARRAY[0],
    'users RLS: Tenant 1 cannot read Tenant 2 user row'
);

-- Tenant 1 cannot see landlord row
SELECT results_eq(
    'SELECT count(*)::int FROM users WHERE id = ''deadbeef-0001-0001-0001-000000000003''',
    ARRAY[0],
    'users RLS: Tenant 1 cannot read landlord user row'
);

RESET ROLE;

-- Anonymous cannot read any user rows
SET LOCAL ROLE anon;

SELECT results_eq(
    'SELECT count(*)::int FROM users WHERE id = ''deadbeef-0001-0001-0001-000000000001''',
    ARRAY[0],
    'users RLS: Anonymous cannot read any user rows'
);

RESET ROLE;

-- Service role can see all
SET LOCAL ROLE service_role;

SELECT results_eq(
    $$SELECT count(*)::int FROM users WHERE id IN (
        'deadbeef-0001-0001-0001-000000000001',
        'deadbeef-0001-0001-0001-000000000002',
        'deadbeef-0001-0001-0001-000000000003'
    )$$,
    ARRAY[3],
    'users RLS: Service role can see all test users'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 2: TENANCIES TABLE RLS
-- =============================================================================

-- Tenant 1 sees own tenancy
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM tenancies WHERE id = ''deadbeef-0002-0002-0002-000000000001''',
    ARRAY[1],
    'tenancies RLS: Tenant 1 can read own tenancy'
);

-- Tenant 1 cannot see Tenant 2's tenancy
SELECT results_eq(
    'SELECT count(*)::int FROM tenancies WHERE id = ''deadbeef-0002-0002-0002-000000000002''',
    ARRAY[0],
    'tenancies RLS: Tenant 1 cannot read Tenant 2 tenancy'
);

RESET ROLE;

-- Landlord (user 3) can see Tenant 1's tenancy via landlord_user_id policy
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000003", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM tenancies WHERE id = ''deadbeef-0002-0002-0002-000000000001''',
    ARRAY[1],
    'tenancies RLS: Landlord can read tenancy where landlord_user_id matches'
);

-- Landlord cannot see Tenant 2's tenancy (not their landlord)
SELECT results_eq(
    'SELECT count(*)::int FROM tenancies WHERE id = ''deadbeef-0002-0002-0002-000000000002''',
    ARRAY[0],
    'tenancies RLS: Landlord cannot read unrelated tenancy'
);

RESET ROLE;

-- Anonymous blocked
SET LOCAL ROLE anon;

SELECT results_eq(
    'SELECT count(*)::int FROM tenancies WHERE id = ''deadbeef-0002-0002-0002-000000000001''',
    ARRAY[0],
    'tenancies RLS: Anonymous blocked from tenancies'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 3: PAYMENTS TABLE RLS
-- =============================================================================

-- Tenant 1 can see own payments (via tenancy join)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM payments WHERE id = ''deadbeef-0003-0003-0003-000000000001''',
    ARRAY[1],
    'payments RLS: Tenant 1 can read own payment via tenancy'
);

-- Tenant 1 cannot see Tenant 2's payment
SELECT results_eq(
    'SELECT count(*)::int FROM payments WHERE id = ''deadbeef-0003-0003-0003-000000000002''',
    ARRAY[0],
    'payments RLS: Tenant 1 cannot read Tenant 2 payment'
);

RESET ROLE;

-- Landlord (user 3) can see Tenant 1's payment via landlord policy
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000003", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM payments WHERE id = ''deadbeef-0003-0003-0003-000000000001''',
    ARRAY[1],
    'payments RLS: Landlord can read Tenant 1 payment (landlord_user_id match)'
);

-- Landlord cannot see Tenant 2's payment
SELECT results_eq(
    'SELECT count(*)::int FROM payments WHERE id = ''deadbeef-0003-0003-0003-000000000002''',
    ARRAY[0],
    'payments RLS: Landlord cannot read Tenant 2 payment'
);

RESET ROLE;

-- Anonymous blocked
SET LOCAL ROLE anon;

SELECT results_eq(
    'SELECT count(*)::int FROM payments WHERE id = ''deadbeef-0003-0003-0003-000000000001''',
    ARRAY[0],
    'payments RLS: Anonymous cannot read any payments'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 4: BANK ACCOUNTS TABLE RLS
-- =============================================================================

-- Tenant 1 can see own bank accounts
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM bank_accounts WHERE id = ''deadbeef-0004-0004-0004-000000000001''',
    ARRAY[1],
    'bank_accounts RLS: Tenant 1 can read own bank account'
);

-- Tenant 1 cannot see Tenant 2's bank accounts
SELECT results_eq(
    'SELECT count(*)::int FROM bank_accounts WHERE id = ''deadbeef-0004-0004-0004-000000000002''',
    ARRAY[0],
    'bank_accounts RLS: Tenant 1 cannot read Tenant 2 bank account'
);

RESET ROLE;

-- Anonymous blocked
SET LOCAL ROLE anon;

SELECT results_eq(
    'SELECT count(*)::int FROM bank_accounts WHERE id = ''deadbeef-0004-0004-0004-000000000001''',
    ARRAY[0],
    'bank_accounts RLS: Anonymous cannot read any bank accounts'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 5: EXTRACTED RENTAL INFO TABLE RLS
-- =============================================================================

-- Tenant 1 can see own extracted info
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM extracted_rental_info WHERE id = ''deadbeef-0005-0005-0005-000000000001''',
    ARRAY[1],
    'extracted_rental_info RLS: Tenant 1 can read own extraction'
);

-- Tenant 1 cannot see Tenant 2's extracted info
SELECT results_eq(
    'SELECT count(*)::int FROM extracted_rental_info WHERE id = ''deadbeef-0005-0005-0005-000000000002''',
    ARRAY[0],
    'extracted_rental_info RLS: Tenant 1 cannot read Tenant 2 extraction'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 6: CASHBACK LEDGER TABLE RLS
-- =============================================================================

-- Tenant 1 can see own cashback entries
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM cashback_ledger WHERE id = ''deadbeef-0006-0006-0006-000000000001''',
    ARRAY[1],
    'cashback_ledger RLS: Tenant 1 can read own cashback entry'
);

-- Tenant 1 cannot see Tenant 2's cashback entries
SELECT results_eq(
    'SELECT count(*)::int FROM cashback_ledger WHERE id = ''deadbeef-0006-0006-0006-000000000002''',
    ARRAY[0],
    'cashback_ledger RLS: Tenant 1 cannot read Tenant 2 cashback entry'
);

RESET ROLE;

-- Anonymous blocked
SET LOCAL ROLE anon;

SELECT results_eq(
    'SELECT count(*)::int FROM cashback_ledger WHERE id = ''deadbeef-0006-0006-0006-000000000001''',
    ARRAY[0],
    'cashback_ledger RLS: Anonymous cannot read any cashback entries'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 7: IDENTITY VERIFICATIONS TABLE RLS
-- =============================================================================

-- Tenant 1 can see own identity verification
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM identity_verifications WHERE id = ''deadbeef-0007-0007-0007-000000000001''',
    ARRAY[1],
    'identity_verifications RLS: Tenant 1 can read own verification'
);

-- Tenant 1 cannot see Tenant 2's identity verification
SELECT results_eq(
    'SELECT count(*)::int FROM identity_verifications WHERE id = ''deadbeef-0007-0007-0007-000000000002''',
    ARRAY[0],
    'identity_verifications RLS: Tenant 1 cannot read Tenant 2 verification'
);

RESET ROLE;

-- Anonymous blocked
SET LOCAL ROLE anon;

SELECT results_eq(
    'SELECT count(*)::int FROM identity_verifications WHERE id = ''deadbeef-0007-0007-0007-000000000001''',
    ARRAY[0],
    'identity_verifications RLS: Anonymous cannot read any verifications'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 8: WAITLIST ENTRIES TABLE RLS
-- =============================================================================

-- Insert waitlist entries via service_role (normal users cannot INSERT)
SET LOCAL ROLE service_role;
INSERT INTO waitlist_entries (id, user_id, position)
VALUES
    ('deadbeef-0008-0008-0008-000000000001',
     'deadbeef-0001-0001-0001-000000000001', 1),
    ('deadbeef-0008-0008-0008-000000000002',
     'deadbeef-0001-0001-0001-000000000002', 2)
ON CONFLICT (user_id) DO NOTHING;
RESET ROLE;

-- Tenant 1 can see own waitlist entry
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM waitlist_entries WHERE user_id = ''deadbeef-0001-0001-0001-000000000001''',
    ARRAY[1],
    'waitlist_entries RLS: Tenant 1 can read own waitlist entry'
);

-- Tenant 1 cannot see Tenant 2's waitlist entry
SELECT results_eq(
    'SELECT count(*)::int FROM waitlist_entries WHERE user_id = ''deadbeef-0001-0001-0001-000000000002''',
    ARRAY[0],
    'waitlist_entries RLS: Tenant 1 cannot read Tenant 2 waitlist entry'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 9: NOTIFICATION PREFERENCES TABLE RLS
-- =============================================================================

-- Insert notification preferences (may already exist from trigger)
SET LOCAL ROLE service_role;
INSERT INTO notification_preferences (user_id)
VALUES
    ('deadbeef-0001-0001-0001-000000000001'),
    ('deadbeef-0001-0001-0001-000000000002')
ON CONFLICT (user_id) DO NOTHING;
RESET ROLE;

-- Tenant 1 can see own notification preferences
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    'SELECT count(*)::int FROM notification_preferences WHERE user_id = ''deadbeef-0001-0001-0001-000000000001''',
    ARRAY[1],
    'notification_preferences RLS: Tenant 1 can read own preferences'
);

-- Tenant 1 cannot see Tenant 2's notification preferences
SELECT results_eq(
    'SELECT count(*)::int FROM notification_preferences WHERE user_id = ''deadbeef-0001-0001-0001-000000000002''',
    ARRAY[0],
    'notification_preferences RLS: Tenant 1 cannot read Tenant 2 preferences'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 10: AUDIT LOGS TABLE RLS -- system/security categories hidden
-- =============================================================================

-- Insert test audit logs via service_role
SET LOCAL ROLE service_role;
INSERT INTO audit_logs (id, user_id, actor_type, action, action_category, status)
VALUES
    -- Normal payment category (should be visible to user)
    ('deadbeef-0009-0009-0009-000000000001',
     'deadbeef-0001-0001-0001-000000000001',
     'user', 'PAYMENT_CREATED', 'payment', 'success'),
    -- Security category (should be HIDDEN from user)
    ('deadbeef-0009-0009-0009-000000000002',
     'deadbeef-0001-0001-0001-000000000001',
     'system', 'SUSPICIOUS_LOGIN', 'security', 'success'),
    -- System category (should be HIDDEN from user)
    ('deadbeef-0009-0009-0009-000000000003',
     'deadbeef-0001-0001-0001-000000000001',
     'system', 'CRON_RAN', 'system', 'success');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

-- User can see own payment audit log
SELECT results_eq(
    'SELECT count(*)::int FROM audit_logs WHERE id = ''deadbeef-0009-0009-0009-000000000001''',
    ARRAY[1],
    'audit_logs RLS: User can read own payment audit log'
);

-- User CANNOT see own security audit log (category filter)
SELECT results_eq(
    'SELECT count(*)::int FROM audit_logs WHERE id = ''deadbeef-0009-0009-0009-000000000002''',
    ARRAY[0],
    'audit_logs RLS: User cannot see security-category audit logs'
);

-- User CANNOT see own system audit log (category filter)
SELECT results_eq(
    'SELECT count(*)::int FROM audit_logs WHERE id = ''deadbeef-0009-0009-0009-000000000003''',
    ARRAY[0],
    'audit_logs RLS: User cannot see system-category audit logs'
);

RESET ROLE;

-- =============================================================================
-- TEST GROUP 11: APP CONFIG -- public read
-- =============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "deadbeef-0001-0001-0001-000000000001", "role": "authenticated"}';

SELECT results_eq(
    $$SELECT count(*)::int FROM app_config WHERE key = 'review_timeline'$$,
    ARRAY[1],
    'app_config RLS: Authenticated user can read app config'
);

RESET ROLE;

-- =============================================================================
-- Cleanup (inside ROLLBACK so automatic, but be explicit for clarity)
-- =============================================================================

SELECT * FROM finish();
ROLLBACK;
