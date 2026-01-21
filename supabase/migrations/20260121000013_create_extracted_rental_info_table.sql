-- Flent Secured v2 - Migration: Extracted Rental Info Table
-- Stores rental information extracted from uploaded documents (lease agreements)

-- ==============================================
-- TABLE: extracted_rental_info
-- ==============================================

CREATE TABLE extracted_rental_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,
  document_storage_path TEXT NOT NULL, -- Supabase Storage path

  -- Document metadata
  document_type TEXT NOT NULL CHECK (document_type IN ('lease_agreement', 'rent_receipt', 'utility_bill', 'bank_statement')),
  original_filename TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,

  -- Extraction status
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed', 'manual_review')),
  extraction_provider TEXT, -- e.g., 'openai_vision', 'google_document_ai'
  extraction_confidence DECIMAL(5,4), -- 0.0000 to 1.0000
  extraction_error TEXT,

  -- Extracted fields (nullable as they may not all be present)
  landlord_name TEXT,
  landlord_phone TEXT,
  landlord_email TEXT,
  landlord_address TEXT,

  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_email TEXT,

  property_address TEXT,
  property_city TEXT,
  property_state TEXT,
  property_pincode TEXT,
  property_type TEXT, -- 'apartment', 'house', 'commercial'

  monthly_rent_paise BIGINT,
  security_deposit_paise BIGINT,
  maintenance_paise BIGINT,

  rent_due_day INTEGER CHECK (rent_due_day >= 1 AND rent_due_day <= 28),
  lease_start_date DATE,
  lease_end_date DATE,

  -- Raw extraction data for debugging
  raw_extraction_response JSONB,

  -- Verification flags
  user_verified BOOLEAN NOT NULL DEFAULT false, -- User confirmed extracted data is correct
  verified_at TIMESTAMPTZ,
  corrections_made JSONB, -- Track any manual corrections

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================
-- INDEXES
-- ==============================================

CREATE INDEX idx_extracted_rental_info_user ON extracted_rental_info(user_id);
CREATE INDEX idx_extracted_rental_info_tenancy ON extracted_rental_info(tenancy_id) WHERE tenancy_id IS NOT NULL;
CREATE INDEX idx_extracted_rental_info_status ON extracted_rental_info(extraction_status);
CREATE INDEX idx_extracted_rental_info_pending ON extracted_rental_info(created_at)
  WHERE extraction_status = 'pending';

-- ==============================================
-- TRIGGER: Update updated_at timestamp
-- ==============================================

CREATE OR REPLACE FUNCTION update_extracted_rental_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_extracted_rental_info_timestamp
  BEFORE UPDATE ON extracted_rental_info
  FOR EACH ROW
  EXECUTE FUNCTION update_extracted_rental_info_updated_at();

-- ==============================================
-- RLS POLICIES
-- ==============================================

ALTER TABLE extracted_rental_info ENABLE ROW LEVEL SECURITY;

-- Users can view their own extracted info
CREATE POLICY extracted_rental_info_select ON extracted_rental_info
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own extracted info
CREATE POLICY extracted_rental_info_insert ON extracted_rental_info
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own extracted info (for verification)
CREATE POLICY extracted_rental_info_update ON extracted_rental_info
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY extracted_rental_info_service_all ON extracted_rental_info
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE extracted_rental_info IS 'Stores rental information extracted from uploaded documents via AI/OCR';
COMMENT ON COLUMN extracted_rental_info.extraction_confidence IS 'AI confidence score for the extraction (0.0 to 1.0)';
COMMENT ON COLUMN extracted_rental_info.raw_extraction_response IS 'Full JSON response from extraction service for debugging';
COMMENT ON COLUMN extracted_rental_info.corrections_made IS 'JSON tracking any manual corrections made by user';

-- ==============================================
-- ADD FK CONSTRAINT TO TENANCIES TABLE
-- ==============================================
-- This was deferred from migration 000003 to avoid circular dependency

ALTER TABLE tenancies
  ADD CONSTRAINT fk_tenancies_extracted_rental_info
  FOREIGN KEY (extracted_rental_info_id)
  REFERENCES extracted_rental_info(id)
  ON DELETE SET NULL;
