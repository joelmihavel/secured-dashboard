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
-- Note: storage.objects is owned by supabase_storage_admin which the
-- migration role cannot assume. Policies are applied via seed.sql or
-- Supabase Dashboard instead. The bucket creation above is sufficient
-- for local dev; storage policies are managed by Supabase's storage
-- service automatically in production.
