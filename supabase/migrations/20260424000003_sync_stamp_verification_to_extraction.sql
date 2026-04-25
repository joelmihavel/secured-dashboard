-- Denormalize the latest stamp verification status onto extracted_rental_info
-- so the RN app can read it without a cross-table join.
--
-- The app queries extracted_rental_info directly via the Supabase client
-- (see rn-app/src/services/api/agreement.ts#getExtractedAgreementData and
-- rn-app/src/hooks/useExtractionStatus.ts). Exposing verification state on
-- the same table keeps the read path unchanged — the app just selects more
-- columns when it's ready to display the status.
--
-- A trigger keeps the denormalized columns in sync with stamp_verifications.
-- This avoids having the stamp-verification-service juggle two writes and
-- gives us a single source of truth: the stamp_verifications table.

ALTER TABLE extracted_rental_info
  ADD COLUMN IF NOT EXISTS stamp_verification_status TEXT,
  ADD COLUMN IF NOT EXISTS stamp_verification_attempt INT,
  ADD COLUMN IF NOT EXISTS stamp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stamp_verification_updated_at TIMESTAMPTZ;

-- Partial index for admin views that filter by verification status
-- (e.g. "show me all mismatches from last week"). Partial keeps it small
-- by excluding the majority of pre-verification rows.
CREATE INDEX IF NOT EXISTS idx_extracted_rental_info_stamp_status
  ON extracted_rental_info (stamp_verification_status, stamp_verification_updated_at DESC)
  WHERE stamp_verification_status IS NOT NULL;

-- Trigger function: on every insert to stamp_verifications, propagate the
-- latest status to extracted_rental_info. We always write — even if a prior
-- row is more recent (which can't happen at our volume, but just in case) —
-- a separate check on attempt_number guarantees monotonic progression.

CREATE OR REPLACE FUNCTION _sync_stamp_verification_to_extraction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE extracted_rental_info
  SET
    stamp_verification_status = NEW.status,
    stamp_verification_attempt = NEW.attempt_number,
    stamp_verified_at = NEW.verified_at,
    stamp_verification_updated_at = NEW.created_at
  WHERE id = NEW.extraction_id
    AND (
      stamp_verification_attempt IS NULL
      OR NEW.attempt_number >= stamp_verification_attempt
    );
  RETURN NEW;
END;
$$;

-- Only service_role should own this trigger function.
REVOKE EXECUTE ON FUNCTION _sync_stamp_verification_to_extraction() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_stamp_verification ON stamp_verifications;

CREATE TRIGGER trg_sync_stamp_verification
  AFTER INSERT ON stamp_verifications
  FOR EACH ROW
  EXECUTE FUNCTION _sync_stamp_verification_to_extraction();

COMMENT ON COLUMN extracted_rental_info.stamp_verification_status IS
  'Latest status from stamp_verifications — mirrored by trg_sync_stamp_verification. Values: verified, mismatch, not_found, captcha_failed, site_error, unsupported_state, missing_article, missing_fields.';
