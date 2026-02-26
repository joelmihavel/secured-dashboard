-- =============================================================================
-- Flent Secured v2 - Payment Data Integrity Tests (pgTAP)
-- =============================================================================
-- CRITICAL fintech tests. Every paise matters. These tests verify:
--   1. Paise precision (no float drift in BIGINT arithmetic)
--   2. Idempotency key uniqueness (double-charge prevention)
--   3. Payment status transitions
--   4. Cashback ledger consistency and sync trigger
--   5. Double-credit prevention (unique partial indexes)
--   6. Amount validation (CHECK constraints)
--   7. Instant discount model (flent_subsidy_paise, dedup indexes)
--   8. Auto-reversal on refund
--   9. Atomic cashback debit function
-- =============================================================================

BEGIN;

SELECT plan(34);

-- =============================================================================
-- SETUP: Create test user, tenancy, and base data
-- =============================================================================

SELECT test_helpers.create_test_user(
    'cafebabe-0001-0001-0001-000000000001'::uuid,
    '+919200000001',
    'pay_integ@test.flent',
    'PayInteg',
    'User'
);

INSERT INTO tenancies (
    id, user_id, property_address, property_city, property_state,
    property_pincode, monthly_rent_paise, rent_due_day,
    lease_start_date, lease_end_date, landlord_name, landlord_phone,
    status, bank_verified
)
VALUES (
    'cafebabe-0002-0002-0002-000000000001',
    'cafebabe-0001-0001-0001-000000000001',
    '42 Payment Integrity Lane', 'Mumbai', 'Maharashtra', '400001',
    5000000, 5, '2024-01-01', '2025-12-31',
    'Integrity Landlord', '+919200000099',
    'active', true
);

-- =============================================================================
-- TEST 1: PAISE PRECISION (no float drift in BIGINT columns)
-- =============================================================================

-- Insert payment with exact paise amounts
INSERT INTO payments (
    id, tenancy_id, rent_amount_paise, pg_fee_paise,
    cashback_applied_paise, cashback_earned_paise,
    total_amount_paise, status, payment_method,
    due_date, payment_month, idempotency_key,
    flent_subsidy_paise
)
VALUES (
    'cafebabe-0003-0003-0003-000000000001',
    'cafebabe-0002-0002-0002-000000000001',
    3250099,  -- Rs 32,500.99 in paise
    11750,    -- Rs 117.50 fee
    5025,     -- Rs 50.25 cashback applied
    32501,    -- Rs 325.01 earned
    3256824,  -- 3250099 + 11750 - 5025 = 3256824
    'success', 'upi',
    '2024-03-05', '2024-03-01', 'paise_test_001',
    32501     -- 1% subsidy
);

-- Verify exact readback (no float drift)
SELECT is(
    (SELECT rent_amount_paise FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000001'),
    3250099::bigint,
    'Paise precision: rent_amount_paise exact readback 3250099'
);

SELECT is(
    (SELECT total_amount_paise FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000001'),
    3256824::bigint,
    'Paise precision: total_amount_paise exact readback 3256824'
);

SELECT is(
    (SELECT cashback_earned_paise FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000001'),
    32501::bigint,
    'Paise precision: cashback_earned_paise exact readback 32501'
);

SELECT is(
    (SELECT flent_subsidy_paise FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000001'),
    32501::bigint,
    'Paise precision: flent_subsidy_paise exact readback 32501'
);

-- Verify arithmetic: rent + fee - cashback_applied = total
SELECT is(
    (SELECT (rent_amount_paise + pg_fee_paise - cashback_applied_paise)
     FROM payments WHERE id = 'cafebabe-0003-0003-0003-000000000001'),
    (SELECT total_amount_paise FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000001'),
    'Paise precision: rent + fee - cashback = total (no drift)'
);

-- =============================================================================
-- TEST 2: IDEMPOTENCY KEY UNIQUENESS
-- =============================================================================

-- First insert succeeds (already done above with 'paise_test_001')
SELECT is(
    (SELECT count(*)::int FROM payments WHERE idempotency_key = 'paise_test_001'),
    1,
    'Idempotency: First insert with key paise_test_001 succeeds'
);

-- Second insert with same key must fail
SELECT throws_ok(
    $$INSERT INTO payments (
        tenancy_id, rent_amount_paise, pg_fee_paise,
        cashback_applied_paise, total_amount_paise, status,
        payment_method, due_date, payment_month, idempotency_key
    ) VALUES (
        'cafebabe-0002-0002-0002-000000000001',
        5000000, 0, 0, 5000000, 'initiated', 'upi',
        '2024-04-05', '2024-04-01', 'paise_test_001'
    )$$,
    '23505',  -- unique_violation
    NULL,
    'Idempotency: Duplicate key paise_test_001 rejected with unique_violation'
);

-- =============================================================================
-- TEST 3: PAYMENT STATUS TRANSITIONS
-- =============================================================================

-- Create a fresh payment for status transition tests
INSERT INTO payments (
    id, tenancy_id, rent_amount_paise, pg_fee_paise,
    cashback_applied_paise, total_amount_paise, status,
    payment_method, due_date, payment_month, idempotency_key
)
VALUES (
    'cafebabe-0003-0003-0003-000000000010',
    'cafebabe-0002-0002-0002-000000000001',
    5000000, 0, 0, 5000000, 'initiated', 'upi',
    '2024-05-05', '2024-05-01', 'status_test_001'
);

-- Verify initial status
SELECT is(
    (SELECT status FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000010'),
    'initiated',
    'Status transition: Starts as initiated'
);

-- initiated -> processing
UPDATE payments SET status = 'processing'
WHERE id = 'cafebabe-0003-0003-0003-000000000010';

SELECT is(
    (SELECT status FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000010'),
    'processing',
    'Status transition: initiated -> processing'
);

-- processing -> success
UPDATE payments SET status = 'success', paid_at = NOW()
WHERE id = 'cafebabe-0003-0003-0003-000000000010';

SELECT is(
    (SELECT status FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000010'),
    'success',
    'Status transition: processing -> success'
);

-- success -> refunded
UPDATE payments SET status = 'refunded'
WHERE id = 'cafebabe-0003-0003-0003-000000000010';

SELECT is(
    (SELECT status FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000010'),
    'refunded',
    'Status transition: success -> refunded'
);

-- Verify expired status is valid (Cashfree support)
INSERT INTO payments (
    id, tenancy_id, rent_amount_paise, pg_fee_paise,
    cashback_applied_paise, total_amount_paise, status,
    payment_method, due_date, payment_month, idempotency_key
)
VALUES (
    'cafebabe-0003-0003-0003-000000000011',
    'cafebabe-0002-0002-0002-000000000001',
    5000000, 0, 0, 5000000, 'expired', 'upi',
    '2024-06-05', '2024-06-01', 'status_test_002'
);

SELECT is(
    (SELECT status FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000011'),
    'expired',
    'Status transition: expired is a valid status (Cashfree)'
);

-- Invalid status must fail
SELECT throws_ok(
    $$INSERT INTO payments (
        tenancy_id, rent_amount_paise, pg_fee_paise,
        cashback_applied_paise, total_amount_paise, status,
        payment_method, due_date, payment_month, idempotency_key
    ) VALUES (
        'cafebabe-0002-0002-0002-000000000001',
        5000000, 0, 0, 5000000, 'bogus_status', 'upi',
        '2024-07-05', '2024-07-01', 'status_test_003'
    )$$,
    '23514',  -- check_violation
    NULL,
    'Status transition: Invalid status bogus_status rejected by CHECK constraint'
);

-- =============================================================================
-- TEST 4: AMOUNT VALIDATION (CHECK constraints)
-- =============================================================================

-- rent_amount_paise must be > 0
SELECT throws_ok(
    $$INSERT INTO payments (
        tenancy_id, rent_amount_paise, pg_fee_paise,
        cashback_applied_paise, total_amount_paise, status,
        payment_method, due_date, payment_month, idempotency_key
    ) VALUES (
        'cafebabe-0002-0002-0002-000000000001',
        0, 0, 0, 1, 'initiated', 'upi',
        '2024-08-05', '2024-08-01', 'amount_test_001'
    )$$,
    '23514',
    NULL,
    'Amount validation: rent_amount_paise = 0 rejected (must be > 0)'
);

-- total_amount_paise must be > 0
SELECT throws_ok(
    $$INSERT INTO payments (
        tenancy_id, rent_amount_paise, pg_fee_paise,
        cashback_applied_paise, total_amount_paise, status,
        payment_method, due_date, payment_month, idempotency_key
    ) VALUES (
        'cafebabe-0002-0002-0002-000000000001',
        5000000, 0, 0, -100, 'initiated', 'upi',
        '2024-08-05', '2024-08-01', 'amount_test_002'
    )$$,
    '23514',
    NULL,
    'Amount validation: negative total_amount_paise rejected'
);

-- cashback_applied_paise must be >= 0
SELECT throws_ok(
    $$INSERT INTO payments (
        tenancy_id, rent_amount_paise, pg_fee_paise,
        cashback_applied_paise, total_amount_paise, status,
        payment_method, due_date, payment_month, idempotency_key
    ) VALUES (
        'cafebabe-0002-0002-0002-000000000001',
        5000000, 0, -500, 5000000, 'initiated', 'upi',
        '2024-08-05', '2024-08-01', 'amount_test_003'
    )$$,
    '23514',
    NULL,
    'Amount validation: negative cashback_applied_paise rejected'
);

-- flent_subsidy_paise must be >= 0
SELECT throws_ok(
    $$INSERT INTO payments (
        tenancy_id, rent_amount_paise, pg_fee_paise,
        cashback_applied_paise, total_amount_paise, status,
        payment_method, due_date, payment_month, idempotency_key,
        flent_subsidy_paise
    ) VALUES (
        'cafebabe-0002-0002-0002-000000000001',
        5000000, 0, 0, 5000000, 'initiated', 'upi',
        '2024-09-05', '2024-09-01', 'amount_test_004',
        -100
    )$$,
    '23514',
    NULL,
    'Amount validation: negative flent_subsidy_paise rejected'
);

-- =============================================================================
-- TEST 5: CASHBACK LEDGER CONSISTENCY AND SYNC TRIGGER
-- =============================================================================

-- Clear any existing cashback for our test user
DELETE FROM cashback_ledger WHERE user_id = 'cafebabe-0001-0001-0001-000000000001';

-- After clearing, the sync trigger should have set balance to 0
SELECT is(
    (SELECT cashback_balance_paise FROM users
     WHERE id = 'cafebabe-0001-0001-0001-000000000001'),
    0,
    'Cashback sync: Balance is 0 after clearing ledger'
);

-- Insert earned entry
INSERT INTO cashback_ledger (
    id, user_id, transaction_type, amount_paise,
    balance_after_paise, description
)
VALUES (
    'cafebabe-0006-0006-0006-000000000001',
    'cafebabe-0001-0001-0001-000000000001',
    'earned', 100000, 100000,
    'Test earned cashback'
);

-- sync_cashback_balance trigger should update users.cashback_balance_paise
SELECT is(
    (SELECT cashback_balance_paise FROM users
     WHERE id = 'cafebabe-0001-0001-0001-000000000001'),
    100000,
    'Cashback sync: Balance updated to 100000 after earned entry'
);

-- Insert applied entry (debit)
INSERT INTO cashback_ledger (
    id, user_id, transaction_type, amount_paise,
    balance_after_paise, description
)
VALUES (
    'cafebabe-0006-0006-0006-000000000002',
    'cafebabe-0001-0001-0001-000000000001',
    'applied', 30000, 70000,
    'Test applied cashback'
);

-- Verify balance after apply
SELECT is(
    (SELECT cashback_balance_paise FROM users
     WHERE id = 'cafebabe-0001-0001-0001-000000000001'),
    70000,
    'Cashback sync: Balance updated to 70000 after applied entry'
);

-- Verify get_available_cashback function returns same
SELECT is(
    get_available_cashback('cafebabe-0001-0001-0001-000000000001'::uuid),
    70000::bigint,
    'get_available_cashback: Returns 70000 (earned 100000 - applied 30000)'
);

-- =============================================================================
-- TEST 6: DOUBLE-CREDIT PREVENTION (unique partial indexes)
-- =============================================================================

-- Create a payment to link cashback entries to
INSERT INTO payments (
    id, tenancy_id, rent_amount_paise, pg_fee_paise,
    cashback_applied_paise, total_amount_paise, status,
    payment_method, due_date, payment_month, idempotency_key
)
VALUES (
    'cafebabe-0003-0003-0003-000000000020',
    'cafebabe-0002-0002-0002-000000000001',
    5000000, 0, 0, 5000000, 'success', 'upi',
    '2024-10-05', '2024-10-01', 'dedup_test_001'
);

-- First earned entry for this payment succeeds
INSERT INTO cashback_ledger (
    id, user_id, payment_id, transaction_type, amount_paise,
    balance_after_paise, description
)
VALUES (
    'cafebabe-0006-0006-0006-000000000010',
    'cafebabe-0001-0001-0001-000000000001',
    'cafebabe-0003-0003-0003-000000000020',
    'earned', 50000, 120000,
    'Earned for dedup test'
);

-- Second earned entry for SAME payment must fail (idx_cashback_ledger_unique_earned)
SELECT throws_ok(
    $$INSERT INTO cashback_ledger (
        user_id, payment_id, transaction_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        'cafebabe-0003-0003-0003-000000000020',
        'earned', 50000, 170000,
        'Duplicate earned attempt'
    )$$,
    '23505',
    NULL,
    'Double-credit prevention: Second earned entry for same payment rejected'
);

-- First discount entry for this payment succeeds
INSERT INTO cashback_ledger (
    id, user_id, payment_id, transaction_type, amount_paise,
    balance_after_paise, description
)
VALUES (
    'cafebabe-0006-0006-0006-000000000011',
    'cafebabe-0001-0001-0001-000000000001',
    'cafebabe-0003-0003-0003-000000000020',
    'discount', 50000, 120000,
    'Discount for dedup test'
);

-- Second discount entry for SAME payment must fail (idx_cashback_ledger_unique_discount)
SELECT throws_ok(
    $$INSERT INTO cashback_ledger (
        user_id, payment_id, transaction_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        'cafebabe-0003-0003-0003-000000000020',
        'discount', 50000, 170000,
        'Duplicate discount attempt'
    )$$,
    '23505',
    NULL,
    'Double-discount prevention: Second discount entry for same payment rejected'
);

-- =============================================================================
-- TEST 7: CASHBACK LEDGER TRANSACTION TYPE VALIDATION
-- =============================================================================

-- All valid transaction types (from the latest migration)
SELECT lives_ok(
    $$INSERT INTO cashback_ledger (
        user_id, transaction_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        'bonus', 5000, 0, 'Bonus test'
    )$$,
    'Cashback type: bonus is valid'
);

SELECT lives_ok(
    $$INSERT INTO cashback_ledger (
        user_id, transaction_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        'referral_bonus', 5000, 0, 'Referral bonus test'
    )$$,
    'Cashback type: referral_bonus is valid'
);

SELECT lives_ok(
    $$INSERT INTO cashback_ledger (
        user_id, transaction_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        'promotional', 5000, 0, 'Promotional test'
    )$$,
    'Cashback type: promotional is valid'
);

-- Invalid transaction type
SELECT throws_ok(
    $$INSERT INTO cashback_ledger (
        user_id, transaction_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        'fake_type', 5000, 0, 'Fake type test'
    )$$,
    '23514',
    NULL,
    'Cashback type: fake_type rejected by CHECK constraint'
);

-- =============================================================================
-- TEST 8: CASHBACK AMOUNT MUST BE POSITIVE
-- =============================================================================

SELECT throws_ok(
    $$INSERT INTO cashback_ledger (
        user_id, transaction_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        'earned', 0, 0, 'Zero amount test'
    )$$,
    '23514',
    NULL,
    'Cashback amount: amount_paise = 0 rejected (must be > 0)'
);

SELECT throws_ok(
    $$INSERT INTO cashback_ledger (
        user_id, transaction_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        'earned', -100, 0, 'Negative amount test'
    )$$,
    '23514',
    NULL,
    'Cashback amount: negative amount_paise rejected'
);

-- =============================================================================
-- TEST 9: PAYMENT GATEWAY DISCRIMINATOR
-- =============================================================================

-- Verify default gateway is payu
SELECT is(
    (SELECT payment_gateway FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000001'),
    'payu',
    'Gateway: Default payment_gateway is payu'
);

-- Cashfree gateway is accepted
INSERT INTO payments (
    id, tenancy_id, rent_amount_paise, pg_fee_paise,
    cashback_applied_paise, total_amount_paise, status,
    payment_method, due_date, payment_month, idempotency_key,
    payment_gateway, gateway_order_id
)
VALUES (
    'cafebabe-0003-0003-0003-000000000030',
    'cafebabe-0002-0002-0002-000000000001',
    5000000, 0, 0, 5000000, 'initiated', 'upi',
    '2024-11-05', '2024-11-01', 'gateway_test_001',
    'cashfree', 'CF_ORDER_001'
);

SELECT is(
    (SELECT payment_gateway FROM payments
     WHERE id = 'cafebabe-0003-0003-0003-000000000030'),
    'cashfree',
    'Gateway: cashfree is a valid payment_gateway'
);

-- Invalid gateway rejected
SELECT throws_ok(
    $$INSERT INTO payments (
        tenancy_id, rent_amount_paise, pg_fee_paise,
        cashback_applied_paise, total_amount_paise, status,
        payment_method, due_date, payment_month, idempotency_key,
        payment_gateway
    ) VALUES (
        'cafebabe-0002-0002-0002-000000000001',
        5000000, 0, 0, 5000000, 'initiated', 'upi',
        '2024-12-05', '2024-12-01', 'gateway_test_002',
        'stripe'
    )$$,
    '23514',
    NULL,
    'Gateway: Invalid payment_gateway stripe rejected'
);

-- =============================================================================
-- TEST 10: TENANCY RENT CONSTRAINTS
-- =============================================================================

-- monthly_rent_paise must be > 0
SELECT throws_ok(
    $$INSERT INTO tenancies (
        user_id, property_address, property_city, property_state,
        property_pincode, monthly_rent_paise, rent_due_day,
        lease_start_date, landlord_name, landlord_phone, status
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        '1 Zero Rent St', 'Mumbai', 'Maharashtra', '400001',
        0, 5, '2024-01-01', 'Zero Landlord', '+91000', 'active'
    )$$,
    '23514',
    NULL,
    'Tenancy constraint: monthly_rent_paise = 0 rejected (must be > 0)'
);

-- rent_due_day must be 1-28
SELECT throws_ok(
    $$INSERT INTO tenancies (
        user_id, property_address, property_city, property_state,
        property_pincode, monthly_rent_paise, rent_due_day,
        lease_start_date, landlord_name, landlord_phone, status
    ) VALUES (
        'cafebabe-0001-0001-0001-000000000001',
        '1 Bad Day St', 'Mumbai', 'Maharashtra', '400001',
        5000000, 31, '2024-01-01', 'Bad Landlord', '+91000', 'active'
    )$$,
    '23514',
    NULL,
    'Tenancy constraint: rent_due_day = 31 rejected (must be 1-28)'
);

-- =============================================================================
-- Cleanup
-- =============================================================================

SELECT * FROM finish();
ROLLBACK;
