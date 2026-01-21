-- Flent Secured v2 - Migration: Create Tenancies Table
-- Represents a verified rental relationship between tenant and landlord

CREATE TABLE IF NOT EXISTS tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  extracted_rental_info_id UUID, -- FK added later after extracted_rental_info table exists

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'active', 'expired', 'terminated')),

  -- Copied from extraction for immutability (prevents changes after verification)
  monthly_rent_paise BIGINT NOT NULL CHECK (monthly_rent_paise > 0),
  rent_due_day INTEGER NOT NULL CHECK (rent_due_day >= 1 AND rent_due_day <= 28),
  lease_start_date DATE NOT NULL,
  lease_end_date DATE,

  -- Property details (copied for immutability)
  property_address TEXT NOT NULL,
  property_city TEXT,
  property_state TEXT,
  property_pincode VARCHAR(6),

  -- Landlord details (copied for immutability)
  landlord_name TEXT NOT NULL,
  landlord_phone VARCHAR(15),
  landlord_email TEXT,
  landlord_user_id UUID REFERENCES users(id), -- If landlord creates account

  -- Verification status flags
  bank_verified BOOLEAN NOT NULL DEFAULT FALSE,
  utility_verified BOOLEAN NOT NULL DEFAULT FALSE,
  landlord_approved BOOLEAN NOT NULL DEFAULT FALSE,
  landlord_approval_token UUID UNIQUE DEFAULT gen_random_uuid(),
  landlord_approved_at TIMESTAMPTZ,

  -- Vacancy cover
  vacancy_cover_active BOOLEAN NOT NULL DEFAULT FALSE,
  vacancy_cover_started_at TIMESTAMPTZ,

  -- Cashback tracking (per-tenancy)
  cashback_balance_paise BIGINT NOT NULL DEFAULT 0 CHECK (cashback_balance_paise >= 0),
  lifetime_cashback_earned_paise BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_cashback_earned_paise >= 0),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_lease_dates CHECK (lease_end_date IS NULL OR lease_end_date > lease_start_date),
  CONSTRAINT valid_rent_due_day CHECK (rent_due_day BETWEEN 1 AND 28)
);

-- Indexes for common queries
CREATE INDEX idx_tenancies_user_id ON tenancies(user_id);
CREATE INDEX idx_tenancies_status ON tenancies(status);
CREATE INDEX idx_tenancies_landlord_user_id ON tenancies(landlord_user_id) WHERE landlord_user_id IS NOT NULL;
CREATE INDEX idx_tenancies_approval_token ON tenancies(landlord_approval_token);
CREATE INDEX idx_tenancies_active ON tenancies(user_id) WHERE status = 'active';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_tenancies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenancies_updated_at
  BEFORE UPDATE ON tenancies
  FOR EACH ROW
  EXECUTE FUNCTION update_tenancies_updated_at();

COMMENT ON TABLE tenancies IS 'Verified rental relationships between tenants and landlords';
COMMENT ON COLUMN tenancies.monthly_rent_paise IS 'Monthly rent amount in paise (1 INR = 100 paise)';
COMMENT ON COLUMN tenancies.rent_due_day IS 'Day of month when rent is due (1-28 to avoid month-end issues)';
COMMENT ON COLUMN tenancies.landlord_approval_token IS 'Token sent to landlord for verification link';
