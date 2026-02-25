-- ==============================================
-- Migration: Rent Receipt & Payment Stamps
-- Date: 2026-02-27
-- Purpose: Add landlord PAN, agreement cert ID to tenancies,
--          and index for payment timeliness queries.
-- Risk: None -- purely additive columns and indexes.
-- ==============================================

-- ============================================
-- 1a. Landlord PAN on tenancies
-- ============================================
-- Landlord PAN is tied to the rental relationship (not tenant's bank_accounts.pan_*).
-- landlord_pan_masked: "ABCDE1234F" format for display
-- landlord_pan_encrypted: encrypted full PAN for backend-only use

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS landlord_pan_masked VARCHAR(10),
  ADD COLUMN IF NOT EXISTS landlord_pan_encrypted TEXT;

COMMENT ON COLUMN tenancies.landlord_pan_masked IS 'Landlord PAN in masked format (e.g. ABCDE1234F) for receipt display';
COMMENT ON COLUMN tenancies.landlord_pan_encrypted IS 'Landlord PAN encrypted for backend-only verification';

-- ============================================
-- 1b. Agreement Certificate ID
-- ============================================
-- Auto-generated unique cert ID for receipts. Format: FS-AGR-YYYYMM-XXXXXXXX

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS agreement_cert_id TEXT UNIQUE;

COMMENT ON COLUMN tenancies.agreement_cert_id IS 'Unique agreement certificate ID for receipts (e.g. FS-AGR-202601-A1B2C3D4)';

-- Auto-generate agreement_cert_id when tenancy is activated
CREATE OR REPLACE FUNCTION generate_agreement_cert_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate when status changes to 'active' and cert_id is not already set
  IF NEW.status = 'active' AND NEW.agreement_cert_id IS NULL THEN
    NEW.agreement_cert_id := 'FS-AGR-'
      || TO_CHAR(NEW.lease_start_date, 'YYYYMM')
      || '-'
      || UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists (idempotent)
DROP TRIGGER IF EXISTS trigger_generate_agreement_cert_id ON tenancies;

CREATE TRIGGER trigger_generate_agreement_cert_id
  BEFORE INSERT OR UPDATE ON tenancies
  FOR EACH ROW
  EXECUTE FUNCTION generate_agreement_cert_id();

-- Backfill existing active tenancies that don't have a cert_id
UPDATE tenancies
SET agreement_cert_id = 'FS-AGR-'
  || TO_CHAR(lease_start_date, 'YYYYMM')
  || '-'
  || UPPER(SUBSTRING(MD5(id::text || created_at::text) FROM 1 FOR 8))
WHERE status = 'active'
  AND agreement_cert_id IS NULL;

-- ============================================
-- 1c. Index for payment timeliness queries
-- ============================================
-- Supports the get-payment-stamps endpoint's query pattern:
-- SELECT ... FROM payments WHERE tenancy_id=X AND status IN (...) ORDER BY payment_month

CREATE INDEX IF NOT EXISTS idx_payments_tenancy_month_status
  ON payments(tenancy_id, payment_month, status);
