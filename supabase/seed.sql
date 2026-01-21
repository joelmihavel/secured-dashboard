-- =============================================================================
-- Flent Secured v2 - Test Data Seed File
-- =============================================================================
-- Purpose: Provides consistent test data for local development and CI/CD
-- Usage: Run with `supabase db reset` or manually via Supabase Studio
--
-- IMPORTANT: This data is for TESTING ONLY. Never use real user data.
-- =============================================================================

-- =============================================================================
-- CLEANUP (Reset for fresh seed)
-- =============================================================================
-- Delete in reverse order of foreign key dependencies
DELETE FROM audit_logs WHERE entity_id::text LIKE 'aaaaaaaa%'
  OR entity_id::text LIKE 'bbbbbbbb%'
  OR entity_id::text LIKE 'pay11111%'
  OR entity_id::text LIKE 'pay22222%';
DELETE FROM cashback_ledger WHERE user_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
DELETE FROM payments WHERE tenancy_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM bank_accounts WHERE user_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
DELETE FROM identity_verifications WHERE user_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
DELETE FROM tenancies WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
-- Also cleanup auth.users entries
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

-- =============================================================================
-- TEST USERS (matches migration schema: full_name, not first_name/last_name)
-- =============================================================================
-- First create auth.users entries (required for FK)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'tenant@flent.test', '', NOW(), NOW() - INTERVAL '30 days', NOW(), '{}', '{}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'landlord@flent.test', '', NOW(), NOW() - INTERVAL '30 days', NOW(), '{}', '{}', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'pending@flent.test', '', NOW(), NOW() - INTERVAL '7 days', NOW(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, phone, full_name, email, kyc_status, created_at, updated_at)
VALUES
  -- Primary test tenant (fully verified)
  (
    '11111111-1111-1111-1111-111111111111',
    '+919999999901',
    'Test Tenant',
    'tenant@flent.test',
    'verified',
    NOW() - INTERVAL '30 days',
    NOW()
  ),
  -- Test landlord
  (
    '22222222-2222-2222-2222-222222222222',
    '+919999999902',
    'Test Landlord',
    'landlord@flent.test',
    'verified',
    NOW() - INTERVAL '30 days',
    NOW()
  ),
  -- Secondary tenant (pending verification)
  (
    '33333333-3333-3333-3333-333333333333',
    '+919999999903',
    'Pending Tenant',
    'pending@flent.test',
    'pending',
    NOW() - INTERVAL '7 days',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST IDENTITY VERIFICATIONS (Cashfree Mobile 360 Data - matches migration schema)
-- =============================================================================
INSERT INTO identity_verifications (
  id, user_id, verification_id, reference_id, status,
  m360_full_name, m360_pan_details, m360_credit_score,
  verified_at, created_at
)
VALUES
  (
    '11110001-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'VER_TEST_001',
    'REF_TEST_001',
    'SUCCESS',
    'Test Tenant',
    '[{"pan": "AAAAA1234A", "name": "Test Tenant", "type": "Individual", "aadhaar_linked": true}]'::jsonb,
    750,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
  ),
  (
    '22220001-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'VER_TEST_002',
    'REF_TEST_002',
    'SUCCESS',
    'Test Landlord',
    '[{"pan": "BBBBB5678B", "name": "Test Landlord", "type": "Individual", "aadhaar_linked": true}]'::jsonb,
    780,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST TENANCIES
-- =============================================================================
INSERT INTO tenancies (
  id, user_id,
  property_address, property_city, property_state, property_pincode,
  monthly_rent_paise, rent_due_day,
  lease_start_date, lease_end_date,
  landlord_name, landlord_phone, landlord_email,
  status, bank_verified, utility_verified, landlord_approved,
  cashback_balance_paise, lifetime_cashback_earned_paise,
  created_at, updated_at
)
VALUES
  -- Active tenancy (fully verified, has cashback)
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '123 Test Street, Apartment 4B',
    'Mumbai',
    'Maharashtra',
    '400001',
    5000000, -- ₹50,000
    5, -- Due on 5th of each month
    '2024-01-01',
    '2025-01-01',
    'Test Landlord',
    '+919999999902',
    'landlord@flent.test',
    'active',
    true, -- Bank verified
    true, -- Utility verified
    true, -- Landlord approved
    50000, -- ₹500 cashback available
    150000, -- ₹1,500 lifetime earned
    NOW() - INTERVAL '30 days',
    NOW()
  ),
  -- Pending verification tenancy
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    '456 Another Street, Floor 2',
    'Delhi',
    'Delhi',
    '110001',
    4500000, -- ₹45,000
    10, -- Due on 10th of each month
    '2024-06-01',
    '2025-06-01',
    'Another Landlord',
    '+919999999904',
    NULL,
    'pending_verification',
    false, -- Bank not verified
    false, -- Utility not verified
    false, -- Landlord not approved
    0, -- No cashback yet
    0, -- No lifetime earnings
    NOW() - INTERVAL '7 days',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST BANK ACCOUNTS (matches migration schema - no tenancy_id)
-- =============================================================================
INSERT INTO bank_accounts (
  id, user_id, party_type,
  account_holder_name, account_number_masked, account_number_encrypted,
  ifsc_code, bank_name, verified, penny_drop_status, verified_account_holder_name,
  is_primary, created_at, verified_at
)
VALUES
  -- Landlord's bank account (for active tenancy)
  (
    '11111111-0101-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'landlord',
    'Test Landlord',
    'XXXX1191',
    'encrypted_026291800001191', -- Test account number
    'YESB0000262',
    'Yes Bank',
    true,
    'SUCCESS',
    'TEST LANDLORD',
    true,
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST PAYMENTS
-- =============================================================================
INSERT INTO payments (
  id, tenancy_id,
  rent_amount_paise, pg_fee_paise, cashback_applied_paise, total_amount_paise,
  status, payment_method,
  payu_txn_id, payu_mihpayid, payu_bank_ref_num,
  due_date, payment_month, paid_at,
  idempotency_key,
  created_at, updated_at
)
VALUES
  -- Successful payment (last month)
  (
    '11111111-0001-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    5000000, -- ₹50,000
    0,
    50000, -- ₹500 cashback applied
    4950000, -- ₹49,500 paid
    'success',
    'upi',
    'TXN_TEST_SUCCESS_001',
    'MIHPAY_001',
    'BANKREF_001',
    '2024-01-05',
    '2024-01-01',
    NOW() - INTERVAL '25 days',
    'idem_test_001',
    NOW() - INTERVAL '26 days',
    NOW() - INTERVAL '25 days'
  ),
  -- Pending payment (current month)
  (
    '22222222-0001-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    5000000, -- ₹50,000
    0,
    50000, -- ₹500 cashback to apply
    4950000, -- ₹49,500 to pay
    'initiated',
    'upi',
    'TXN_TEST_PENDING_002',
    NULL,
    NULL,
    CURRENT_DATE + INTERVAL '5 days',
    DATE_TRUNC('month', CURRENT_DATE),
    NULL,
    'idem_test_002',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST CASHBACK LEDGER (matches migration schema - uses transaction_type, user_id, balance_after_paise)
-- =============================================================================
INSERT INTO cashback_ledger (
  id, user_id, tenancy_id, payment_id,
  transaction_type, amount_paise, balance_after_paise, description,
  created_at
)
VALUES
  -- Earned cashback from first payment
  (
    '11111111-0011-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-0001-1111-1111-111111111111',
    'earned',
    50000, -- ₹500 earned (1% of ₹50,000)
    50000, -- Balance after: ₹500
    'Cashback earned on January 2024 rent',
    NOW() - INTERVAL '55 days'
  ),
  -- Applied cashback (used in payment) - amount is always positive, type indicates direction
  (
    '22222222-0011-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-0001-1111-1111-111111111111',
    'applied',
    50000, -- ₹500 used (positive, type indicates deduction)
    0, -- Balance after: ₹0
    'Cashback applied to January 2024 rent',
    NOW() - INTERVAL '25 days'
  ),
  -- Current balance (earned from this month)
  (
    '33333333-0011-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    NULL,
    'earned',
    50000, -- ₹500 earned
    50000, -- Balance after: ₹500
    'Cashback earned on February 2024 rent',
    NOW() - INTERVAL '5 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST AUDIT LOGS (matches migration schema - uses user_id, action_category, status)
-- =============================================================================
INSERT INTO audit_logs (
  id, user_id, actor_type, action, action_category,
  entity_type, entity_id, old_values, new_values, details,
  status, created_at
)
VALUES
  (
    '11111111-0111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'service',
    'PAYMENT_SUCCESS',
    'payment',
    'payment',
    '11111111-0001-1111-1111-111111111111',
    '{"status": "initiated"}'::jsonb,
    '{"status": "success"}'::jsonb,
    '{"source": "payu_webhook", "ip": "127.0.0.1"}'::jsonb,
    'success',
    NOW() - INTERVAL '25 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Run these queries to verify seed data:
-- SELECT COUNT(*) FROM users;  -- Should be 3
-- SELECT COUNT(*) FROM tenancies;  -- Should be 2
-- SELECT COUNT(*) FROM payments;  -- Should be 2
-- SELECT COUNT(*) FROM cashback_ledger;  -- Should be 3
