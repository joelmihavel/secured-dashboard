-- Drop V1 backward-compatibility trigger that creates ghost extraction records
-- on every user signup. The V2 flow creates extraction records explicitly in
-- upload-document edge function. This trigger causes:
-- 1. Ghost extracted_rental_info rows with empty document_storage_path
-- 2. Duplicate rows per user (one from trigger, one from upload-document)
-- 3. Journey router confusion (finds ghost "pending" record instead of real one)

-- Drop the trigger first, then the function
DROP TRIGGER IF EXISTS waitlist_entries_sync_trigger ON public.waitlist_entries;
DROP FUNCTION IF EXISTS sync_waitlist_to_extracted_rental_info();

-- Clean up existing ghost extraction records:
-- These have empty document_storage_path and null extraction_method,
-- meaning no actual document was ever uploaded or processed.
-- Only delete unverified ones to avoid touching any manually-corrected records.
DELETE FROM public.extracted_rental_info
WHERE document_storage_path = ''
  AND extraction_method IS NULL
  AND user_verified = false;

-- Also clean up ghost records that are pending with no document
-- (created by the trigger but never processed)
DELETE FROM public.extracted_rental_info
WHERE document_storage_path = ''
  AND extraction_status = 'pending'
  AND user_verified = false;
