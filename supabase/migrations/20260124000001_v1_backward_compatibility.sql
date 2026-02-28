-- Flent Secured v2 - Migration: V1 Backward Compatibility Layer
-- =============================================================
-- This migration adds backward compatibility with V1 iOS app without regressing V2 improvements.
--
-- STRATEGY:
-- 1. Add V1 columns to users table (additive, V2 columns preserved)
-- 2. Create sync triggers for phone/phone_number
-- 3. Create waitlist_entries VIEW mapping to extracted_rental_info
-- 4. Create enum types used by V1
-- 5. Update handle_new_user() to populate V1 columns
--
-- V2 IMPROVEMENTS PRESERVED:
-- - kyc_status state machine (V2) runs parallel to user_status (V1)
-- - extracted_rental_info direct binding (V2) exposed through waitlist VIEW (V1)
-- - Cashback ledger, idempotency, audit logging untouched
-- - V2's better trigger handles both column sets

-- ==============================================
-- ENUM TYPES (V1 compatibility)
-- ==============================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('tenant', 'landlord');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status_enum AS ENUM ('signed_up', 'waitlisted', 'approved', 'not_eligible');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE extraction_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_upload_status AS ENUM (
    'not_uploaded',
    'uploading',
    'upload_failed',
    'processing',
    'processing_failed',
    'user_review',
    'manual_review',
    'confirmed',
    'rejected_by_user',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================
-- ADD V1 COMPATIBILITY COLUMNS TO USERS TABLE
-- ==============================================

-- phone_number (V1 uses this, V2 uses phone)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(15);

-- Role tracking (V1 concept - V2 uses tenancies.party_type)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role user_role;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_role_locked BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_locked_at TIMESTAMPTZ;

-- User status (V1 concept - V2 uses kyc_status)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_status user_status_enum DEFAULT 'signed_up';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status_updated_by UUID REFERENCES public.users(id);

-- Onboarding flag alias (V1 calls it is_onboarded, V2 calls it onboarding_completed)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT false;

-- Profile image (V1 uses avatar_url)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- V1 metadata fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- V1 profile_image_url (some V1 code uses this instead of avatar_url)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- V1 verification flags (mapped to V2 fields)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ==============================================
-- SYNC EXISTING DATA
-- ==============================================

-- Sync phone to phone_number for existing users
DO $$ BEGIN
  UPDATE public.users SET phone_number = phone
  WHERE phone_number IS NULL AND phone IS NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Sync onboarding_completed to is_onboarded
DO $$ BEGIN
  UPDATE public.users SET is_onboarded = onboarding_completed
  WHERE is_onboarded = false AND onboarding_completed = true;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Sync kyc_status to user_status (approximate mapping)
-- Guarded: main may already have correct types from v1
DO $$ BEGIN
  UPDATE public.users SET user_status = CASE
    WHEN kyc_status = 'verified' THEN 'approved'::user_status_enum
    WHEN kyc_status = 'failed' THEN 'not_eligible'::user_status_enum
    ELSE 'signed_up'::user_status_enum
  END
  WHERE user_status = 'signed_up' AND kyc_status != 'pending';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==============================================
-- TRIGGER: Sync phone <-> phone_number bidirectionally
-- ==============================================

CREATE OR REPLACE FUNCTION sync_phone_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync phone -> phone_number
  IF NEW.phone IS DISTINCT FROM OLD.phone AND NEW.phone IS NOT NULL THEN
    -- Normalize: extract last 10 digits for Indian phone numbers
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

  -- Sync kyc_status -> user_status (one-way: V2 is source of truth)
  -- Use text values to avoid type mismatch between user_status and user_status_enum
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN
    NEW.user_status := CASE NEW.kyc_status
      WHEN 'verified' THEN 'approved'
      WHEN 'failed' THEN 'not_eligible'
      WHEN 'in_progress' THEN 'waitlisted'
      ELSE 'signed_up'
    END;
    NEW.status_updated_at := NOW();
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

DROP TRIGGER IF EXISTS sync_phone_columns_trigger ON public.users;
CREATE TRIGGER sync_phone_columns_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_phone_columns();

-- ==============================================
-- UPDATE handle_new_user() TO POPULATE V1 COLUMNS
-- ==============================================
-- This replaces the V2 trigger to handle BOTH V1 and V2 column sets

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_phone TEXT;
  v_normalized_phone TEXT;
BEGIN
  -- Get phone from auth.users (handle multiple formats)
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number', '');

  -- Normalize phone number: extract last 10 digits
  -- Handles +919876543210, 919876543210, or 9876543210
  IF v_phone IS NOT NULL AND LENGTH(v_phone) > 0 THEN
    v_normalized_phone := regexp_replace(v_phone, '[^0-9]', '', 'g');
    IF LENGTH(v_normalized_phone) > 10 THEN
      v_normalized_phone := RIGHT(v_normalized_phone, 10);
    END IF;
  ELSE
    v_normalized_phone := NULL;
  END IF;

  -- Insert user with BOTH V1 and V2 columns populated
  INSERT INTO public.users (
    id,
    -- V2 columns
    phone,
    -- V1 compatibility columns
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
    -- V2: store original phone
    v_phone,
    -- V1: store normalized 10-digit phone
    v_normalized_phone,
    'signed_up',
    false,  -- is_onboarded
    false,  -- is_role_locked
    true,   -- is_active
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.users.phone),
    phone_number = COALESCE(NULLIF(EXCLUDED.phone_number, ''), public.users.phone_number),
    updated_at = NOW()
  WHERE public.users.phone IS NULL OR public.users.phone = '';

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block auth signup
    RAISE WARNING 'handle_new_user failed for user %: % (SQLSTATE: %)',
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_new_user() TO postgres, service_role;

-- ==============================================
-- CREATE WAITLIST COMPATIBILITY VIEW
-- ==============================================
-- Maps V2's extracted_rental_info to V1's waitlist table format
-- iOS app queries this view instead of the old waitlist table

-- Drop existing waitlist table/view if it exists (v1 had it as a table, v2 replaces with view)
DROP TABLE IF EXISTS public.waitlist CASCADE;
DROP VIEW IF EXISTS public.waitlist CASCADE;

CREATE OR REPLACE VIEW public.waitlist AS
SELECT
  eri.id,
  eri.user_id,

  -- V1 status fields (mapped from V2)
  CASE
    WHEN eri.user_verified = true THEN 'approved'
    WHEN eri.extraction_status = 'manual_review' THEN 'pending_review'
    ELSE 'pending_review'
  END AS status,

  -- Extraction status (same enum values)
  eri.extraction_status::TEXT AS extraction_status,

  -- Contract status (mapped from extraction_status)
  CASE eri.extraction_status
    WHEN 'pending' THEN 'not_uploaded'
    WHEN 'processing' THEN 'processing'
    WHEN 'completed' THEN CASE WHEN eri.user_verified THEN 'confirmed' ELSE 'user_review' END
    WHEN 'failed' THEN 'processing_failed'
    WHEN 'manual_review' THEN 'manual_review'
    ELSE 'not_uploaded'
  END::TEXT AS contract_status,

  -- Review flags
  (eri.extraction_status = 'manual_review') AS requires_manual_review,
  eri.extraction_error AS manual_review_reason,

  -- Position (use row number as placeholder - V2 doesn't track waitlist position)
  ROW_NUMBER() OVER (ORDER BY eri.created_at) + 1000 AS waitlist_position,

  -- Field counts (V2 tracks differently, provide reasonable defaults)
  CASE WHEN eri.extraction_status = 'completed' THEN 14 ELSE 0 END AS extraction_fields_count,
  14 AS extraction_total_fields,

  -- Document info
  eri.document_storage_path AS document_url,

  -- Admin review status
  CASE
    WHEN eri.user_verified = true THEN 'approved'
    WHEN eri.extraction_status = 'manual_review' THEN 'in_progress'
    ELSE 'due'
  END AS admin_review,

  -- User confirmation timestamp (V1 field)
  eri.verified_at AS user_confirmed_at,

  -- Referral fields (V2 stores on users table, not waitlist)
  u.referral_code,
  u.referred_by,

  -- Timestamps
  eri.created_at,
  eri.updated_at

FROM extracted_rental_info eri
JOIN public.users u ON u.id = eri.user_id;

-- Grant access to the view
GRANT SELECT ON public.waitlist TO authenticated, service_role;

-- ==============================================
-- CREATE WAITLIST HELPER TABLE FOR iOS INSERTS
-- ==============================================
-- iOS app may try to INSERT into waitlist. This table catches those inserts
-- and creates the corresponding extracted_rental_info record.

CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_url TEXT,
  status TEXT DEFAULT 'pending_review',
  extraction_status TEXT DEFAULT 'pending',
  contract_status TEXT DEFAULT 'not_uploaded',
  requires_manual_review BOOLEAN DEFAULT false,
  manual_review_reason TEXT,
  waitlist_position INTEGER,
  extraction_fields_count INTEGER DEFAULT 0,
  extraction_total_fields INTEGER DEFAULT 14,
  admin_review TEXT DEFAULT 'due',
  referral_code VARCHAR(10),
  user_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT waitlist_entries_user_unique UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies (guarded for idempotency)
DO $$ BEGIN
  CREATE POLICY waitlist_entries_select_own ON public.waitlist_entries
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY waitlist_entries_insert_own ON public.waitlist_entries
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY waitlist_entries_update_own ON public.waitlist_entries
    FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'pending_review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY waitlist_entries_service_all ON public.waitlist_entries
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger to sync waitlist_entries -> extracted_rental_info
CREATE OR REPLACE FUNCTION sync_waitlist_to_extracted_rental_info()
RETURNS TRIGGER AS $$
BEGIN
  -- When iOS inserts to waitlist_entries, create corresponding extracted_rental_info
  INSERT INTO extracted_rental_info (
    user_id,
    document_storage_path,
    document_type,
    extraction_status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.user_id,
    COALESCE(NEW.document_url, ''),
    'lease_agreement',
    COALESCE(NEW.extraction_status, 'pending'),
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS waitlist_entries_sync_trigger ON public.waitlist_entries;
CREATE TRIGGER waitlist_entries_sync_trigger
  AFTER INSERT ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_waitlist_to_extracted_rental_info();

-- ==============================================
-- ADD RENTAL_PARTIES VIEW (V1 compatibility)
-- ==============================================
-- V1 stores party names in separate rental_parties table
-- V2 stores them directly in extracted_rental_info columns

-- Drop existing rental_parties table/view if it exists (v1 had it as a table, v2 replaces with view)
DROP TABLE IF EXISTS public.rental_parties CASCADE;
DROP VIEW IF EXISTS public.rental_parties CASCADE;

CREATE OR REPLACE VIEW public.rental_parties AS
SELECT
  gen_random_uuid() AS id,
  eri.id AS extracted_rental_info_id,
  'tenant'::TEXT AS party_type,
  eri.tenant_name AS name,
  eri.tenant_phone AS phone,
  eri.tenant_email AS email,
  eri.created_at
FROM extracted_rental_info eri
WHERE eri.tenant_name IS NOT NULL

UNION ALL

SELECT
  gen_random_uuid() AS id,
  eri.id AS extracted_rental_info_id,
  'landlord'::TEXT AS party_type,
  eri.landlord_name AS name,
  eri.landlord_phone AS phone,
  eri.landlord_email AS email,
  eri.created_at
FROM extracted_rental_info eri
WHERE eri.landlord_name IS NOT NULL;

GRANT SELECT ON public.rental_parties TO authenticated, service_role;

-- ==============================================
-- CREATE deleted_users_archive TABLE (V1 compatibility)
-- ==============================================
-- delete-account edge function expects this table

CREATE TABLE IF NOT EXISTS public.deleted_users_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_data JSONB NOT NULL DEFAULT '{}',
  waitlist_data JSONB NOT NULL DEFAULT '[]',
  extracted_rental_info_data JSONB NOT NULL DEFAULT '[]',
  rental_parties_data JSONB NOT NULL DEFAULT '[]',
  auth_metadata JSONB NOT NULL DEFAULT '{}',
  deletion_reason TEXT DEFAULT 'user_requested',
  deletion_initiated_by TEXT DEFAULT 'user',
  tenancies_data JSONB DEFAULT '[]',
  payments_data JSONB DEFAULT '[]',
  bank_accounts_data JSONB DEFAULT '[]'
);

-- Add unique constraint if not exists
DO $$ BEGIN
  ALTER TABLE public.deleted_users_archive
    ADD CONSTRAINT deleted_users_archive_original_user_id_key UNIQUE (original_user_id);
EXCEPTION WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- Add columns that may not exist on pre-existing table
ALTER TABLE public.deleted_users_archive ADD COLUMN IF NOT EXISTS tenancies_data JSONB DEFAULT '[]';
ALTER TABLE public.deleted_users_archive ADD COLUMN IF NOT EXISTS payments_data JSONB DEFAULT '[]';
ALTER TABLE public.deleted_users_archive ADD COLUMN IF NOT EXISTS bank_accounts_data JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_deleted_users_archive_user_id
  ON public.deleted_users_archive(original_user_id);

ALTER TABLE public.deleted_users_archive ENABLE ROW LEVEL SECURITY;

-- Only service role can access archive
DO $$ BEGIN
  CREATE POLICY deleted_users_archive_service_only ON public.deleted_users_archive
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================
-- INDEXES FOR V1 COLUMNS
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_users_phone_number ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_user_status ON public.users(user_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON COLUMN public.users.phone_number IS 'V1 compatibility: 10-digit normalized phone (synced with phone column)';
COMMENT ON COLUMN public.users.user_status IS 'V1 compatibility: User progression status (synced with kyc_status)';
COMMENT ON COLUMN public.users.role IS 'V1 compatibility: tenant/landlord role (V2 uses tenancies.party_type)';
COMMENT ON COLUMN public.users.is_onboarded IS 'V1 compatibility: Alias for onboarding_completed';
COMMENT ON VIEW public.waitlist IS 'V1 compatibility: Maps extracted_rental_info to V1 waitlist format';
COMMENT ON VIEW public.rental_parties IS 'V1 compatibility: Exposes party names from extracted_rental_info';
