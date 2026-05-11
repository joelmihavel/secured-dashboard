-- Fix handle_new_user trigger to preserve landlord role
-- =====================================================
-- When a user signs up with user_type in raw_user_meta_data (e.g. from
-- the landlord web sign-up page), the trigger now sets users.role accordingly.
-- For the v2 mobile app (which doesn't pass user_type), role stays NULL.
-- Existing users are untouched — this only affects the INSERT trigger.

DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Replace the function with role-aware logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_normalized_phone TEXT;
  v_role TEXT;
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

  -- Read user_type from signup metadata (landlord web page passes this)
  v_role := NEW.raw_user_meta_data->>'user_type';

  -- Only set role if it's a recognized value
  IF v_role IS NOT NULL AND v_role NOT IN ('tenant', 'landlord') THEN
    v_role := NULL;
  END IF;

  -- Insert user row. ON CONFLICT handles re-registration edge case.
  INSERT INTO public.users (
    id,
    phone,
    phone_number,
    role,
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
    v_role,
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

DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
