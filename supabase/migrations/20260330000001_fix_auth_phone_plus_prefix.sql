-- Fix phone numbers missing '+' prefix in auth.users
-- Migration 20260304100001 fixed public.users but not auth.users.
-- Some auth.users rows have phone WITHOUT '+' prefix (e.g. '919999900003')
-- while others have it (e.g. '+919999900001').
-- This normalizes all auth.users phone values to E.164 with '+' prefix.

-- ============================================================
-- A. FIX auth.users PHONE PREFIX
-- ============================================================
-- auth.users is in the auth schema owned by supabase_auth_admin.
-- We use SET ROLE to elevate privileges for this one-time fix.

DO $$
BEGIN
  -- Temporarily assume supabase_auth_admin role to update auth.users
  PERFORM set_config('role', 'supabase_auth_admin', true);

  UPDATE auth.users
  SET phone = '+' || phone,
      updated_at = NOW()
  WHERE phone IS NOT NULL
    AND phone <> ''
    AND LEFT(phone, 1) <> '+';

  -- Reset role back to default
  PERFORM set_config('role', 'postgres', true);
END;
$$;

-- ============================================================
-- B. FIX sync_phone_columns TRIGGER (phone_number -> phone)
-- ============================================================
-- The existing trigger copies V1 phone_number (bare 10 digits) directly
-- into phone without normalization, breaking E.164 format.
-- This replacement ensures '+' prefix when syncing phone_number -> phone.

CREATE OR REPLACE FUNCTION sync_phone_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync phone -> phone_number (strip to last 10 digits)
  IF NEW.phone IS DISTINCT FROM OLD.phone AND NEW.phone IS NOT NULL THEN
    NEW.phone_number := RIGHT(regexp_replace(NEW.phone, '[^0-9]', '', 'g'), 10);
  END IF;

  -- Sync phone_number -> phone (ensure + prefix for E.164)
  IF NEW.phone_number IS DISTINCT FROM OLD.phone_number AND NEW.phone_number IS NOT NULL THEN
    IF LEFT(NEW.phone_number, 1) <> '+' THEN
      NEW.phone := '+' || NEW.phone_number;
    ELSE
      NEW.phone := NEW.phone_number;
    END IF;
  END IF;

  -- Sync onboarding_completed <-> is_onboarded
  IF NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed THEN
    NEW.is_onboarded := NEW.onboarding_completed;
  ELSIF NEW.is_onboarded IS DISTINCT FROM OLD.is_onboarded THEN
    NEW.onboarding_completed := NEW.is_onboarded;
  END IF;

  -- Sync avatar_url <-> profile_image_url
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url AND NEW.avatar_url IS NOT NULL THEN
    NEW.profile_image_url := NEW.avatar_url;
  ELSIF NEW.profile_image_url IS DISTINCT FROM OLD.profile_image_url AND NEW.profile_image_url IS NOT NULL THEN
    NEW.avatar_url := NEW.profile_image_url;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
