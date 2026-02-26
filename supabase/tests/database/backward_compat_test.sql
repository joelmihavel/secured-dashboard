-- =============================================================================
-- Flent Secured v2 - V1/V2 Backward Compatibility Tests (pgTAP)
-- =============================================================================
-- The Flent Secured app shipped V1 (iOS) while V2 (React Native) was built.
-- Both app versions hit the same database. These tests verify:
--
--   1. phone <-> phone_number bidirectional sync
--   2. onboarding_completed <-> is_onboarded bidirectional sync
--   3. avatar_url <-> profile_image_url bidirectional sync
--   4. handle_new_user() trigger populates BOTH V1 and V2 columns
--   5. user_status enum includes all journey states
--   6. V1 compatibility views (waitlist, rental_parties) resolve
--   7. waitlist_entries link correctly to extracted_rental_info
--   8. sync_phone_columns trigger normalizes phone formats
-- =============================================================================

BEGIN;

SELECT plan(27);

-- =============================================================================
-- SETUP: Clear any previous test data
-- =============================================================================

-- We use ROLLBACK at the end so no permanent state, but delete any
-- leftover rows from crashed previous runs.
DELETE FROM public.users WHERE id = 'baadf00d-0001-0001-0001-000000000001';
DELETE FROM auth.users  WHERE id = 'baadf00d-0001-0001-0001-000000000001';
DELETE FROM public.users WHERE id = 'baadf00d-0001-0001-0001-000000000002';
DELETE FROM auth.users  WHERE id = 'baadf00d-0001-0001-0001-000000000002';

-- =============================================================================
-- TEST GROUP 1: handle_new_user() TRIGGER
-- Simulates what happens when Supabase Auth creates a new user row.
-- The trigger should populate public.users with both V1 and V2 columns.
-- =============================================================================

-- Simulate auth.users insert (this fires handle_new_user trigger)
INSERT INTO auth.users (
    id, instance_id, aud, role, email, phone,
    encrypted_password, email_confirmed_at, phone_confirmed_at,
    created_at, updated_at, confirmation_token, recovery_token,
    raw_user_meta_data
)
VALUES (
    'baadf00d-0001-0001-0001-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'compat_test1@test.flent',
    '+919876543210',  -- Indian mobile with country code
    '', NOW(), NOW(), NOW(), NOW(), '', '',
    '{"phone_number": "+919876543210"}'::jsonb
);

-- Verify public.users row was created by trigger
SELECT is(
    (SELECT count(*)::int FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    1,
    'handle_new_user: Public users row created by trigger'
);

-- V2 column: phone should be populated
SELECT is(
    (SELECT phone FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    '+919876543210',
    'handle_new_user: V2 phone column populated with original format'
);

-- V1 column: phone_number should be normalized to 10 digits
SELECT is(
    (SELECT phone_number FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    '9876543210',
    'handle_new_user: V1 phone_number normalized to 10 digits'
);

-- V1 column: user_status should default to signed_up
SELECT is(
    (SELECT user_status::text FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    'signed_up',
    'handle_new_user: V1 user_status defaults to signed_up'
);

-- V1 column: is_onboarded should default to false
SELECT is(
    (SELECT is_onboarded FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    false,
    'handle_new_user: V1 is_onboarded defaults to false'
);

-- V2 column: onboarding_completed should default to false
SELECT is(
    (SELECT onboarding_completed FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    false,
    'handle_new_user: V2 onboarding_completed defaults to false'
);

-- V1 column: is_active should default to true
SELECT is(
    (SELECT is_active FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    true,
    'handle_new_user: V1 is_active defaults to true'
);

-- V1 column: is_role_locked should default to false
SELECT is(
    (SELECT is_role_locked FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    false,
    'handle_new_user: V1 is_role_locked defaults to false'
);

-- =============================================================================
-- TEST GROUP 2: PHONE <-> PHONE_NUMBER BIDIRECTIONAL SYNC
-- sync_phone_columns trigger fires on UPDATE of public.users
-- =============================================================================

-- Update V2 phone -> should sync to V1 phone_number
UPDATE public.users
SET phone = '+919988776655'
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT phone_number FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    '9988776655',
    'Phone sync (V2->V1): Updating phone syncs phone_number (normalized 10 digits)'
);

-- Update V1 phone_number -> should sync to V2 phone
UPDATE public.users
SET phone_number = '9112233445'
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT phone FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    '9112233445',
    'Phone sync (V1->V2): Updating phone_number syncs phone'
);

-- =============================================================================
-- TEST GROUP 3: ONBOARDING_COMPLETED <-> IS_ONBOARDED BIDIRECTIONAL SYNC
-- =============================================================================

-- Update V2 onboarding_completed -> should sync to V1 is_onboarded
UPDATE public.users
SET onboarding_completed = true
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT is_onboarded FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    true,
    'Onboarding sync (V2->V1): Setting onboarding_completed=true syncs is_onboarded=true'
);

-- Reset
UPDATE public.users
SET onboarding_completed = false
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

-- Update V1 is_onboarded -> should sync to V2 onboarding_completed
UPDATE public.users
SET is_onboarded = true
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT onboarding_completed FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    true,
    'Onboarding sync (V1->V2): Setting is_onboarded=true syncs onboarding_completed=true'
);

-- =============================================================================
-- TEST GROUP 4: AVATAR_URL <-> PROFILE_IMAGE_URL BIDIRECTIONAL SYNC
-- =============================================================================

-- Update avatar_url -> should sync to profile_image_url
UPDATE public.users
SET avatar_url = 'https://storage.test/avatars/user1.jpg'
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT profile_image_url FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    'https://storage.test/avatars/user1.jpg',
    'Avatar sync: Setting avatar_url syncs profile_image_url'
);

-- Update profile_image_url -> should sync to avatar_url
UPDATE public.users
SET profile_image_url = 'https://storage.test/avatars/user1_v2.jpg'
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT avatar_url FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    'https://storage.test/avatars/user1_v2.jpg',
    'Avatar sync: Setting profile_image_url syncs avatar_url'
);

-- =============================================================================
-- TEST GROUP 5: USER_STATUS ENUM VALUES
-- The user_status_enum should include all journey states:
-- signed_up, agreement_confirmed, waitlisted, approved, active, not_eligible
-- =============================================================================

-- Test each status value can be set
UPDATE public.users
SET user_status = 'signed_up'::user_status_enum
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT user_status::text FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    'signed_up',
    'user_status enum: signed_up is valid'
);

UPDATE public.users
SET user_status = 'agreement_confirmed'::user_status_enum
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT user_status::text FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    'agreement_confirmed',
    'user_status enum: agreement_confirmed is valid'
);

UPDATE public.users
SET user_status = 'waitlisted'::user_status_enum
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT user_status::text FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    'waitlisted',
    'user_status enum: waitlisted is valid'
);

UPDATE public.users
SET user_status = 'approved'::user_status_enum
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT user_status::text FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    'approved',
    'user_status enum: approved is valid'
);

UPDATE public.users
SET user_status = 'active'::user_status_enum
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT user_status::text FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    'active',
    'user_status enum: active is valid'
);

UPDATE public.users
SET user_status = 'not_eligible'::user_status_enum
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT user_status::text FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    'not_eligible',
    'user_status enum: not_eligible is valid'
);

-- =============================================================================
-- TEST GROUP 6: V1 COMPATIBILITY VIEWS
-- =============================================================================

-- Create an extracted_rental_info row for the test user so waitlist view has data
INSERT INTO extracted_rental_info (
    id, user_id, document_storage_path, document_type,
    extraction_status, user_verified, landlord_name, tenant_name
)
VALUES (
    'baadf00d-0005-0005-0005-000000000001',
    'baadf00d-0001-0001-0001-000000000001',
    '/test/compat_doc.pdf', 'lease_agreement',
    'completed', true,
    'Compat Landlord', 'Compat Tenant'
);

-- waitlist view should expose extracted_rental_info in V1 format
SELECT is(
    (SELECT count(*)::int FROM waitlist
     WHERE user_id = 'baadf00d-0001-0001-0001-000000000001'),
    1,
    'V1 waitlist view: Resolves extraction for test user'
);

-- waitlist view should map user_verified=true to status=approved
SELECT is(
    (SELECT status FROM waitlist
     WHERE user_id = 'baadf00d-0001-0001-0001-000000000001'),
    'approved',
    'V1 waitlist view: user_verified=true maps to status=approved'
);

-- rental_parties view should expose landlord and tenant
SELECT is(
    (SELECT count(*)::int FROM rental_parties
     WHERE extracted_rental_info_id = 'baadf00d-0005-0005-0005-000000000001'),
    2,  -- one landlord + one tenant
    'V1 rental_parties view: Exposes both landlord and tenant rows'
);

-- =============================================================================
-- TEST GROUP 7: WAITLIST_ENTRIES LINK TO EXTRACTED_RENTAL_INFO
-- =============================================================================

-- The link_extraction_to_waitlist trigger should have linked extraction
-- to any existing waitlist entry. Let us create a waitlist entry manually
-- and test the link.

-- Create a waitlist entry for a new user
INSERT INTO auth.users (
    id, instance_id, aud, role, email, phone,
    encrypted_password, email_confirmed_at, phone_confirmed_at,
    created_at, updated_at, confirmation_token, recovery_token
)
VALUES (
    'baadf00d-0001-0001-0001-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'compat_test2@test.flent',
    '+919000111222',
    '', NOW(), NOW(), NOW(), NOW(), '', ''
);

-- Wait for handle_new_user to create public.users row
-- Then manually create a waitlist entry
INSERT INTO waitlist_entries (id, user_id, position)
VALUES (
    'baadf00d-0008-0008-0008-000000000001',
    'baadf00d-0001-0001-0001-000000000002',
    999
)
ON CONFLICT (user_id) DO NOTHING;

-- Verify waitlist entry exists
SELECT is(
    (SELECT count(*)::int FROM waitlist_entries
     WHERE user_id = 'baadf00d-0001-0001-0001-000000000002'),
    1,
    'Waitlist link: Waitlist entry created for user 2'
);

-- Insert an extraction -- the link_extraction_to_waitlist trigger should fire
INSERT INTO extracted_rental_info (
    id, user_id, document_storage_path, document_type, extraction_status
)
VALUES (
    'baadf00d-0005-0005-0005-000000000002',
    'baadf00d-0001-0001-0001-000000000002',
    '/test/link_test.pdf', 'lease_agreement', 'pending'
);

-- Verify the trigger linked extraction_id to waitlist_entries
SELECT is(
    (SELECT extraction_id FROM waitlist_entries
     WHERE user_id = 'baadf00d-0001-0001-0001-000000000002'),
    'baadf00d-0005-0005-0005-000000000002'::uuid,
    'Waitlist link: extraction_id automatically linked by trigger'
);

-- =============================================================================
-- TEST GROUP 8: PHONE FORMAT NORMALIZATION
-- Tests that sync_phone_columns correctly normalizes various phone formats.
-- =============================================================================

-- Phone with +91 prefix
UPDATE public.users
SET phone = '+919500123456'
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT phone_number FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    '9500123456',
    'Phone normalization: +919500123456 -> 9500123456 (last 10 digits)'
);

-- Phone with 91 prefix (no +)
UPDATE public.users
SET phone = '919500123456'
WHERE id = 'baadf00d-0001-0001-0001-000000000001';

SELECT is(
    (SELECT phone_number FROM public.users
     WHERE id = 'baadf00d-0001-0001-0001-000000000001'),
    '9500123456',
    'Phone normalization: 919500123456 -> 9500123456 (last 10 digits)'
);

-- =============================================================================
-- Cleanup
-- =============================================================================

SELECT * FROM finish();
ROLLBACK;
