-- Index for lookups by extraction_id alone (extraction-recovery idempotent tenancy check)
-- The existing unique_user_extraction index is (user_id, extracted_rental_info_id)
-- which doesn't help when querying by extracted_rental_info_id alone.
CREATE INDEX IF NOT EXISTS idx_tenancies_extraction_id
  ON public.tenancies (extracted_rental_info_id)
  WHERE extracted_rental_info_id IS NOT NULL;
