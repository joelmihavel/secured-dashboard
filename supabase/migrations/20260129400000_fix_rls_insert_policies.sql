-- Migration: Fix RLS INSERT policies
-- Date: 2026-01-29
-- Description: Allow authenticated users to insert their own records
--
-- Issue: After OTP verification, users couldn't create their profile or consent record
-- because RLS policies only allowed service_role to INSERT.

-- ==============================================
-- USERS TABLE: Allow authenticated users to INSERT their own record
-- ==============================================

-- Drop existing policy if it exists (to make migration idempotent)
DROP POLICY IF EXISTS users_insert_own ON public.users;

-- Users can insert their own profile (id must match auth.uid())
CREATE POLICY users_insert_own ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ==============================================
-- IDENTITY_VERIFICATIONS TABLE: Allow authenticated users to INSERT their own records
-- ==============================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS identity_verifications_user_insert ON identity_verifications;

-- Users can insert their own consent/verification records
CREATE POLICY identity_verifications_user_insert ON identity_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON POLICY users_insert_own ON public.users IS
  'Allows authenticated users to create their own profile record after signup';

COMMENT ON POLICY identity_verifications_user_insert ON identity_verifications IS
  'Allows authenticated users to record their consent for identity verification';
