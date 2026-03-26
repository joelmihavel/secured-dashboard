-- Add 'extraction_failed' to extraction_status check constraint
-- Fixes: process-document uses this value when Gemini extracts 0 fields
-- The admin view (20260317000001) already references this value
ALTER TABLE extracted_rental_info 
  DROP CONSTRAINT IF EXISTS extracted_rental_info_extraction_status_check;

ALTER TABLE extracted_rental_info 
  ADD CONSTRAINT extracted_rental_info_extraction_status_check 
  CHECK (extraction_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'extraction_failed'::text, 'manual_review'::text]));
