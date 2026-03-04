-- Fix phone numbers missing '+' prefix in public.users
-- Root cause: handle_new_user() trigger copies auth.users.phone as-is.
-- Some early users were created with '91XXXXXXXXXX' instead of '+91XXXXXXXXXX'.
-- This one-time update normalizes all existing records.

-- 1. Fix existing data: prepend '+' where missing
UPDATE public.users
SET phone = '+' || phone, updated_at = NOW()
WHERE phone IS NOT NULL
  AND phone <> ''
  AND LEFT(phone, 1) <> '+';

-- 2. Fix the trigger to always ensure '+' prefix going forward
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

  -- Ensure '+' prefix for E.164 compliance
  IF v_phone IS NOT NULL AND LENGTH(v_phone) > 0 AND LEFT(v_phone, 1) <> '+' THEN
    v_phone := '+' || v_phone;
  END IF;

  -- Normalize phone number: extract last 10 digits (for V1 phone_number column)
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
    v_role::user_role,
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

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;
