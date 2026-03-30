-- Fix stray values in contract_status before adding CHECK constraint
UPDATE extracted_rental_info SET contract_status = 'user_review' WHERE contract_status = 'completed';
UPDATE extracted_rental_info SET contract_status = 'expired' WHERE contract_status = 'processing_timeout';

-- Add CHECK constraint for contract_status (was missing — any string could be stored)
-- NULL is allowed by Postgres CHECK (NULL IN (...) evaluates to NULL, not FALSE)
ALTER TABLE public.extracted_rental_info
  ADD CONSTRAINT extracted_rental_info_contract_status_check
  CHECK (contract_status IN ('uploading', 'user_review', 'manual_review', 'confirmed', 'invalid_document', 'expired'));
