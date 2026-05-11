-- Flent Secured v2 - Migration: Rent Agreements Storage Bucket
-- Required for: upload-document, process-document edge functions
-- The upload-document edge function creates signed URLs in this bucket.
-- Without it, agreement upload fails immediately at 5%.

-- ==============================================
-- CREATE STORAGE BUCKET
-- ==============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rent-agreements',
  'rent-agreements',
  false,  -- Private: only authenticated users via signed URLs
  52428800,  -- 50MB limit (matches edge function MAX_FILE_SIZE)
  ARRAY['application/pdf']  -- PDF only (process-document rejects non-PDF)
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf'];

-- ==============================================
-- STORAGE POLICIES
-- ==============================================
-- Note: storage.objects is owned by supabase_storage_admin which the
-- migration role cannot assume. Policies are managed by Supabase's
-- storage service automatically. Bucket creation above is sufficient.
