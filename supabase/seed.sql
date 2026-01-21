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
DELETE FROM audit_logs WHERE id IN (
  SELECT id FROM audit_logs WHERE entity_id::text LIKE 'aaaaaaaa%' OR entity_id::text LIKE 'bbbbbbbb%'
);
DELETE FROM cashback_ledger WHERE tenancy_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM payments WHERE tenancy_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM bank_accounts WHERE tenancy_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM identity_verifications WHERE user_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
DELETE FROM tenancies WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

-- =============================================================================
-- TEST USERS
-- =============================================================================
INSERT INTO users (id, phone, first_name, last_name, email, created_at, updated_at)
VALUES
  -- Primary test tenant (fully verified)
  (
    '11111111-1111-1111-1111-111111111111',
    '+919999999901',
    'Test',
    'Tenant',
    'tenant@flent.test',
    NOW() - INTERVAL '30 days',
    NOW()
  ),
  -- Test landlord
  (
    '22222222-2222-2222-2222-222222222222',
    '+919999999902',
    'Test',
    'Landlord',
    'landlord@flent.test',
    NOW() - INTERVAL '30 days',
    NOW()
  ),
  -- Secondary tenant (pending verification)
  (
    '33333333-3333-3333-3333-333333333333',
    '+919999999903',
    'Pending',
    'Tenant',
    'pending@flent.test',
    NOW() - INTERVAL '7 days',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST IDENTITY VERIFICATIONS (Mobile 360 Data)
-- =============================================================================
INSERT INTO identity_verifications (
  id, user_id, phone, full_name, pan_status, aadhaar_linked,
  verification_source, verified_at, created_at
)
VALUES
  (
    'id111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '+919999999901',
    'Test Tenant',
    'VALID',
    true,
    'mobile_360',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
  ),
  (
    'id222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    '+919999999902',
    'Test Landlord',
    'VALID',
    true,
    'mobile_360',
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
-- TEST BANK ACCOUNTS
-- =============================================================================
INSERT INTO bank_accounts (
  id, user_id, tenancy_id, party_type,
  account_holder_name, account_number_last4, account_number_encrypted,
  ifsc_code, bank_name, verified, verification_method, name_at_bank,
  created_at, verified_at
)
VALUES
  -- Landlord's bank account (for active tenancy)
  (
    'ba111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'landlord',
    'Test Landlord',
    '0123',
    'encrypted_026291800001191', -- Test account number
    'YESB0000262',
    'Yes Bank',
    true,
    'penny_drop',
    'TEST LANDLORD',
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
    'pay11111-1111-1111-1111-111111111111',
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
    'pay22222-2222-2222-2222-222222222222',
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
-- TEST CASHBACK LEDGER
-- =============================================================================
INSERT INTO cashback_ledger (
  id, tenancy_id, payment_id,
  type, amount_paise, description,
  created_at
)
VALUES
  -- Earned cashback from first payment
  (
    'cb111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'pay11111-1111-1111-1111-111111111111',
    'earned',
    50000, -- ₹500 earned (1% of ₹50,000)
    'Cashback earned on January 2024 rent',
    NOW() - INTERVAL '25 days'
  ),
  -- Applied cashback (used in payment)
  (
    'cb222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'pay11111-1111-1111-1111-111111111111',
    'applied',
    -50000, -- ₹500 used
    'Cashback applied to January 2024 rent',
    NOW() - INTERVAL '25 days'
  ),
  -- Current balance (earned from previous month)
  (
    'cb333333-3333-3333-3333-333333333333',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    NULL,
    'earned',
    50000, -- ₹500 earned
    'Cashback earned on December 2023 rent',
    NOW() - INTERVAL '55 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST AUDIT LOGS
-- =============================================================================
INSERT INTO audit_logs (
  id, entity_type, entity_id, action, actor_id, actor_type,
  old_values, new_values, metadata,
  created_at
)
VALUES
  (
    'audit1111-1111-1111-1111-111111111111',
    'payment',
    'pay11111-1111-1111-1111-111111111111',
    'PAYMENT_STATUS_CHANGED',
    '11111111-1111-1111-1111-111111111111',
    'user',
    '{"status": "initiated"}'::jsonb,
    '{"status": "success"}'::jsonb,
    '{"source": "payu_webhook", "ip": "127.0.0.1"}'::jsonb,
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
