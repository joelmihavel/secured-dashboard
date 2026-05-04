-- PR-1 introduced contract_status='missing_stamp_paper' but did not extend
-- the existing check constraint. Without this fix, both new extractions
-- and historic-row reclassification fail with constraint violation.
--
-- This migration extends the allowed value set on
-- extracted_rental_info.contract_status to include 'missing_stamp_paper'
-- alongside the prior values. Idempotent (DROP IF EXISTS + ADD).

-- @safe-destructive: dropping then recreating the contract_status check
-- constraint to add 'missing_stamp_paper' as a valid value. No data is
-- destroyed; constraint values are a strict superset of the prior set.
ALTER TABLE public.extracted_rental_info
  DROP CONSTRAINT IF EXISTS extracted_rental_info_contract_status_check;

ALTER TABLE public.extracted_rental_info
  ADD CONSTRAINT extracted_rental_info_contract_status_check
  CHECK (contract_status = ANY (ARRAY[
    'uploading'::text,
    'user_review'::text,
    'manual_review'::text,
    'confirmed'::text,
    'invalid_document'::text,
    'expired'::text,
    'missing_stamp_paper'::text
  ]));

-- rollback:
--   ALTER TABLE public.extracted_rental_info
--     DROP CONSTRAINT IF EXISTS extracted_rental_info_contract_status_check;
--   ALTER TABLE public.extracted_rental_info
--     ADD CONSTRAINT extracted_rental_info_contract_status_check
--     CHECK (contract_status = ANY (ARRAY[
--       'uploading'::text,'user_review'::text,'manual_review'::text,
--       'confirmed'::text,'invalid_document'::text,'expired'::text]));
--   Note: rollback would also require updating any rows where
--   contract_status='missing_stamp_paper' to a previously-allowed value.
