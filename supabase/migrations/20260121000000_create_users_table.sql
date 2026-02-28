-- Flent Secured v2 - Migration: Create Users Table
-- Base users table linked to Supabase Auth
-- Made idempotent for v2→main merge (table may already exist with v1 schema)

-- ==============================================
-- USERS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  pan_number VARCHAR(10),
  pan_verified BOOLEAN NOT NULL DEFAULT false,
  aadhaar_last4 VARCHAR(4),
  aadhaar_verified BOOLEAN NOT NULL DEFAULT false,
  kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'in_progress', 'verified', 'failed')),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  cashback_balance_paise INTEGER NOT NULL DEFAULT 0 CHECK (cashback_balance_paise >= 0),
  referral_code VARCHAR(10) UNIQUE,
  referred_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns that may not exist on a pre-existing v1 table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS aadhaar_last4 VARCHAR(4);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cashback_balance_paise INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by UUID;

-- Add kyc_status with check constraint (needs exception handler)
DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ==============================================
-- INDEXES (safe: columns now guaranteed to exist)
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON public.users(kyc_status);

-- ==============================================
-- TRIGGER: Auto-update updated_at
-- ==============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- TRIGGER: Auto-create user profile on auth signup
-- ==============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone)
  VALUES (
    NEW.id,
    NEW.phone
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ==============================================
-- RLS POLICIES (idempotent: drop if exists, then create)
-- ==============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY users_select_own ON public.users
    FOR SELECT TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY users_update_own ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY users_service_all ON public.users
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE public.users IS 'Extended user profiles linked to Supabase Auth';
DO $$ BEGIN
  COMMENT ON COLUMN public.users.cashback_balance_paise IS 'Current cashback balance in paise (1/100 of INR)';
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  COMMENT ON COLUMN public.users.kyc_status IS 'KYC verification status: pending, in_progress, verified, failed';
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
