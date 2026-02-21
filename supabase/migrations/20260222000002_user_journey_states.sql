-- Flent Secured v2 - Migration: Gated User Journey States
-- ========================================================
-- Introduces user_status as the master journey state with gated transitions:
--   signed_up → agreement_confirmed → waitlisted → approved → active
--                                          ↘ not_eligible
--
-- KEY CHANGES:
-- 1. Add 'agreement_confirmed' and 'active' enum values
-- 2. Drop auto-join-waitlist trigger (users must confirm agreement first)
-- 3. Remove kyc_status → user_status auto-sync (user_status is now independently managed)
-- 4. Create check_and_advance_to_active() helper (bank verification gates active status)

-- ==============================================
-- A. ADD NEW ENUM VALUES
-- ==============================================

ALTER TYPE user_status_enum ADD VALUE IF NOT EXISTS 'agreement_confirmed' AFTER 'signed_up';
ALTER TYPE user_status_enum ADD VALUE IF NOT EXISTS 'active' AFTER 'approved';

-- ==============================================
-- B. DROP AUTO-JOIN WAITLIST TRIGGER
-- ==============================================
-- Previously, every new user was auto-added to waitlist on signup.
-- Now, users must confirm their agreement before joining waitlist.

DROP TRIGGER IF EXISTS on_user_created_join_waitlist ON public.users;

-- ==============================================
-- C. FIX sync_phone_columns TRIGGER
-- ==============================================
-- Remove the kyc_status → user_status auto-sync block.
-- Previously, when confirm-extraction set kyc_status = 'in_progress',
-- the trigger would override user_status to 'waitlisted', bypassing the gate.
-- Now user_status is independently managed by edge functions.

CREATE OR REPLACE FUNCTION sync_phone_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync phone -> phone_number
  IF NEW.phone IS DISTINCT FROM OLD.phone AND NEW.phone IS NOT NULL THEN
    NEW.phone_number := RIGHT(regexp_replace(NEW.phone, '[^0-9]', '', 'g'), 10);
  END IF;

  -- Sync phone_number -> phone
  IF NEW.phone_number IS DISTINCT FROM OLD.phone_number AND NEW.phone_number IS NOT NULL THEN
    NEW.phone := NEW.phone_number;
  END IF;

  -- Sync onboarding_completed <-> is_onboarded
  IF NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed THEN
    NEW.is_onboarded := NEW.onboarding_completed;
  ELSIF NEW.is_onboarded IS DISTINCT FROM OLD.is_onboarded THEN
    NEW.onboarding_completed := NEW.is_onboarded;
  END IF;

  -- REMOVED: kyc_status -> user_status sync
  -- user_status is now independently managed by edge functions
  -- (agreement_confirmed, waitlisted, approved, active, not_eligible)

  -- Sync avatar_url <-> profile_image_url
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url AND NEW.avatar_url IS NOT NULL THEN
    NEW.profile_image_url := NEW.avatar_url;
  ELSIF NEW.profile_image_url IS DISTINCT FROM OLD.profile_image_url AND NEW.profile_image_url IS NOT NULL THEN
    NEW.avatar_url := NEW.profile_image_url;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- D. CREATE check_and_advance_to_active HELPER
-- ==============================================
-- Bank verification is the mandatory gate to 'active'.
-- Utility and landlord verification are optional (tracked on tenancies table).
-- Cashback eligibility is separately determined by tenancy.landlord_approved.

CREATE OR REPLACE FUNCTION check_and_advance_to_active(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET user_status = 'active'::user_status_enum,
      status_updated_at = NOW()
  WHERE id = p_user_id
    AND user_status = 'approved'::user_status_enum
    AND EXISTS (
      SELECT 1 FROM tenancies t
      WHERE t.user_id = p_user_id
        AND t.bank_verified = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role (edge functions use this)
GRANT EXECUTE ON FUNCTION check_and_advance_to_active(UUID) TO service_role;

-- ==============================================
-- E. UPDATE COLUMN COMMENT
-- ==============================================

COMMENT ON COLUMN public.users.user_status IS 'Master journey state: signed_up → agreement_confirmed → waitlisted → approved → active | not_eligible';
