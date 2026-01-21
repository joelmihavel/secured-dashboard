-- =============================================================================
-- Flent Secured v2 - pgTAP Test Setup
-- =============================================================================
-- This file initializes the test environment for database testing.
-- Run with: supabase test db
-- =============================================================================

BEGIN;

-- Enable pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Set the search path to include our schemas
SET search_path TO public, extensions;

-- Create a test helper schema
CREATE SCHEMA IF NOT EXISTS test_helpers;

-- =============================================================================
-- Test Helper Functions
-- =============================================================================

-- Function to create a test user and return their ID
CREATE OR REPLACE FUNCTION test_helpers.create_test_user(
    p_phone TEXT DEFAULT '+919999999999',
    p_first_name TEXT DEFAULT 'Test',
    p_last_name TEXT DEFAULT 'User'
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    INSERT INTO users (phone, first_name, last_name, email)
    VALUES (p_phone, p_first_name, p_last_name, p_first_name || '@test.flent')
    RETURNING id INTO v_user_id;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a test tenancy and return its ID
CREATE OR REPLACE FUNCTION test_helpers.create_test_tenancy(
    p_user_id UUID,
    p_monthly_rent_paise BIGINT DEFAULT 5000000
)
RETURNS UUID AS $$
DECLARE
    v_tenancy_id UUID;
BEGIN
    INSERT INTO tenancies (
        user_id,
        property_address, property_city, property_state, property_pincode,
        monthly_rent_paise, rent_due_day,
        lease_start_date, lease_end_date,
        landlord_name, landlord_phone,
        status
    )
    VALUES (
        p_user_id,
        '123 Test Street', 'Mumbai', 'Maharashtra', '400001',
        p_monthly_rent_paise, 5,
        CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year',
        'Test Landlord', '+919999999998',
        'active'
    )
    RETURNING id INTO v_tenancy_id;

    RETURN v_tenancy_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a test payment and return its ID
CREATE OR REPLACE FUNCTION test_helpers.create_test_payment(
    p_tenancy_id UUID,
    p_status TEXT DEFAULT 'initiated',
    p_amount_paise BIGINT DEFAULT 5000000
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    INSERT INTO payments (
        tenancy_id,
        rent_amount_paise, pg_fee_paise, cashback_applied_paise, total_amount_paise,
        status, payment_method,
        due_date, payment_month,
        idempotency_key
    )
    VALUES (
        p_tenancy_id,
        p_amount_paise, 0, 0, p_amount_paise,
        p_status, 'upi',
        CURRENT_DATE + INTERVAL '5 days', DATE_TRUNC('month', CURRENT_DATE),
        'test_' || gen_random_uuid()::text
    )
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up test data
CREATE OR REPLACE FUNCTION test_helpers.cleanup()
RETURNS VOID AS $$
BEGIN
    -- Delete test data in reverse order of foreign key dependencies
    DELETE FROM audit_logs WHERE entity_id::text LIKE 'test_%' OR actor_id::text LIKE 'test_%';
    DELETE FROM cashback_ledger WHERE tenancy_id IN (SELECT id FROM tenancies WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.flent'));
    DELETE FROM payments WHERE tenancy_id IN (SELECT id FROM tenancies WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.flent'));
    DELETE FROM bank_accounts WHERE tenancy_id IN (SELECT id FROM tenancies WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.flent'));
    DELETE FROM identity_verifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.flent');
    DELETE FROM tenancies WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.flent');
    DELETE FROM users WHERE email LIKE '%@test.flent';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Announce Test Setup
-- =============================================================================
SELECT diag('pgTAP test environment initialized');
SELECT diag('Test helper functions created in test_helpers schema');

COMMIT;
