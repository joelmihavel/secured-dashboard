-- =============================================================================
-- Migration: Add UNIQUE constraint on identity_verifications.verification_id
--
-- BUG FIX: The verification_id column needs a unique constraint to prevent
-- duplicate records when the same Cashfree verification is processed multiple times.
-- This also enables efficient upsert operations.
--
-- BRANCH: v2-backend-dev
-- =============================================================================

-- First, remove any duplicate verification_ids (keep the most recent one)
-- This is necessary before adding the unique constraint
DELETE FROM identity_verifications
WHERE id NOT IN (
  SELECT DISTINCT ON (verification_id) id
  FROM identity_verifications
  ORDER BY verification_id, created_at DESC
);

-- Drop existing non-unique index
DROP INDEX IF EXISTS idx_identity_verifications_verification_id;

-- Create unique index (acts as unique constraint)
CREATE UNIQUE INDEX idx_identity_verifications_verification_id_unique
  ON identity_verifications(verification_id);

-- Add comment for documentation
COMMENT ON COLUMN identity_verifications.verification_id IS
  'Unique identifier from Cashfree for this verification. Must be unique to prevent duplicate processing.';
