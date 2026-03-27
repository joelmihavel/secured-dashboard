-- Fix stray 'completed' values in contract_status (extraction_status value leaking)
UPDATE extracted_rental_info
SET contract_status = 'user_review'
WHERE contract_status = 'completed';

-- Add CHECK constraint for contract_status (was missing — any string could be stored)
ALTER TABLE public.extracted_rental_info
  ADD CONSTRAINT extracted_rental_info_contract_status_check
  CHECK (contract_status IN ('uploading', 'user_review', 'manual_review', 'confirmed', 'invalid_document', 'expired'));
