-- Fix handle_new_user trigger
-- ============================
-- The trigger was silently failing due to EXCEPTION WHEN OTHERS swallowing errors.
-- This migration:
-- 1. Replaces the function with a robust version (no silent failure)
-- 2. Sets search_path to prevent schema resolution issues
-- 3. Explicitly drops and recreates the trigger on auth.users
-- 4. Uses SECURITY DEFINER to bypass RLS on public.users

-- Drop existing trigger first (requires auth schema owner in local dev)
DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Replace the function with explicit search_path and no EXCEPTION swallowing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_normalized_phone TEXT;
BEGIN
  -- Get phone from auth.users (handle multiple formats)
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number', '');

  -- Normalize phone number: extract last 10 digits
  IF v_phone IS NOT NULL AND LENGTH(v_phone) > 0 THEN
    v_normalized_phone := regexp_replace(v_phone, '[^0-9]', '', 'g');
    IF LENGTH(v_normalized_phone) > 10 THEN
      v_normalized_phone := RIGHT(v_normalized_phone, 10);
    END IF;
  ELSE
    v_normalized_phone := NULL;
  END IF;

  -- Insert user row. ON CONFLICT handles the case where a user
  -- re-registers with the same auth ID (shouldn't happen normally).
  INSERT INTO public.users (
    id,
    phone,
    phone_number,
    user_status,
    is_onboarded,
    is_role_locked,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_phone,
    v_normalized_phone,
    'signed_up'::public.user_status_enum,
    false,
    false,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.users.phone),
    phone_number = COALESCE(NULLIF(EXCLUDED.phone_number, ''), public.users.phone_number),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Recreate trigger on auth.users (may fail in local dev due to ownership)
DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN NULL;
END $$;

-- Grant execute to roles that need it
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
