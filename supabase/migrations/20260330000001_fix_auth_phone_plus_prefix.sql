-- Fix phone format consistency across auth.users and public.users
--
-- GoTrue stores auth.users.phone WITHOUT '+' prefix (e.g. '919099926845')
-- Our app uses public.users.phone WITH '+' prefix (e.g. '+919099926845')
-- These are two separate formats by design:
--   auth.users.phone  → GoTrue internal (no '+')
--   public.users.phone → App-facing E.164 (with '+')

-- ============================================================
-- A. Normalize auth.users.phone — strip '+' if present (GoTrue format)
-- ============================================================
-- GoTrue's /otp endpoint strips '+' before lookup. If auth.users.phone
-- has '+', GoTrue can't find the user → tries INSERT → duplicate key error.
UPDATE auth.users
SET phone = LTRIM(phone, '+'), updated_at = NOW()
WHERE phone LIKE '+%';

-- ============================================================
-- B. Normalize public.users.phone — add '+' if missing (E.164 format)
-- ============================================================
UPDATE public.users
SET phone = '+' || phone
WHERE phone IS NOT NULL AND phone <> '' AND LEFT(phone, 1) <> '+';

-- ============================================================
-- C. sync_phone_columns TRIGGER
-- ============================================================
-- This trigger runs on public.users (BEFORE UPDATE).
-- phone_number → phone sync must NOT add '+' (GoTrue writes to auth.users
-- via handle_new_user, which copies public.users.phone to auth.users.phone).
-- Wait — actually this trigger is on public.users, not auth.users.
-- public.users.phone should have '+'. The handle_new_user trigger that
-- creates public.users from auth.users copies auth.users.phone (no '+').
-- So we need this trigger to ADD '+' when syncing from phone_number.

CREATE OR REPLACE FUNCTION sync_phone_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync phone -> phone_number (strip to last 10 digits)
  IF NEW.phone IS DISTINCT FROM OLD.phone AND NEW.phone IS NOT NULL THEN
    NEW.phone_number := RIGHT(regexp_replace(NEW.phone, '[^0-9]', '', 'g'), 10);
  END IF;

  -- Sync phone_number -> phone (digits only, no '+' — matches GoTrue format)
  IF NEW.phone_number IS DISTINCT FROM OLD.phone_number AND NEW.phone_number IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone_number, '[^0-9]', '', 'g');
    IF length(NEW.phone) = 10 THEN
      NEW.phone := '91' || NEW.phone;
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
