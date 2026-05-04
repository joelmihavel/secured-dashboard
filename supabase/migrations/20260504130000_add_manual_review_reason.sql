ALTER TABLE public.extracted_rental_info
  ADD COLUMN IF NOT EXISTS manual_review_reason TEXT;

COMMENT ON COLUMN public.extracted_rental_info.manual_review_reason IS
  'Structured reason for manual_review/invalid_document/missing_stamp_paper. '
  'Values: missing_stamp_paper, missing_critical_fields, missing_required_fields, '
  'low_confidence, not_rental_agreement, other.';

-- rollback:
--   ALTER TABLE public.extracted_rental_info DROP COLUMN IF EXISTS manual_review_reason;
