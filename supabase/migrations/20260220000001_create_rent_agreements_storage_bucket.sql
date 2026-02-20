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

-- Drop existing policies if they exist (idempotent)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can upload their own rent agreement" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view their own rent agreement" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own rent agreement" ON storage.objects;
  DROP POLICY IF EXISTS "Service role can manage rent agreements" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Users can upload their own agreement (folder = user_id)
CREATE POLICY "Users can upload their own rent agreement"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rent-agreements' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own agreement
CREATE POLICY "Users can view their own rent agreement"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rent-agreements' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own agreement (for re-upload)
CREATE POLICY "Users can delete their own rent agreement"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rent-agreements' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role can manage all rent agreements
-- (needed for edge functions using adminClient)
CREATE POLICY "Service role can manage rent agreements"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'rent-agreements')
WITH CHECK (bucket_id = 'rent-agreements');
