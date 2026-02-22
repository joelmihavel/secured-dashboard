-- Add missing columns for robust extraction status tracking
-- contract_status: tracks document validity (user_review, manual_review, expired, invalid_document, confirmed)
-- needs_manual_review: flag set by process-document when AI confidence is low or city unsupported

ALTER TABLE public.extracted_rental_info
  ADD COLUMN IF NOT EXISTS contract_status text DEFAULT 'uploading',
  ADD COLUMN IF NOT EXISTS needs_manual_review boolean DEFAULT false;

-- Add index on extraction_status + user_verified for the mount-discovery query
-- (finds user's latest active extraction on app open)
CREATE INDEX IF NOT EXISTS idx_extracted_rental_info_status_user
  ON public.extracted_rental_info (user_id, extraction_status, user_verified)
  WHERE extraction_status IN ('processing', 'completed') AND user_verified = false;

-- Realtime already enabled on extracted_rental_info (verified 2026-02-22)
