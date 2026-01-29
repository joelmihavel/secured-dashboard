-- Flent Secured v2 - Migration: Avatars Storage Bucket
-- Sets up the storage bucket for user avatars
-- Required for P0 API: upload-avatar

-- ==============================================
-- CREATE STORAGE BUCKET
-- ==============================================

-- Note: Storage bucket creation via SQL is limited.
-- This migration ensures the policies are in place.
-- The bucket itself should be created via:
-- 1. Supabase Dashboard -> Storage -> New bucket
-- 2. Or via supabase CLI

-- If the bucket doesn't exist, insert it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public read access
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

-- ==============================================
-- STORAGE POLICIES
-- ==============================================

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Users can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Avatars are publicly accessible (read only)
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ==============================================
-- NOTES
-- ==============================================
-- Policy comments are not added because storage.objects is a managed table
-- and COMMENT ON POLICY requires ownership which Supabase does not grant.
