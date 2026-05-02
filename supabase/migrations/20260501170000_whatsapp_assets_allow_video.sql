-- Expand whatsapp-assets bucket to host video assets.
--
-- Original bucket (20260402000002) was image-only (PNG/JPEG, 5MB) for
-- notification icons. The new landlord-invite WhatsApp template uses a video
-- header (60s explainer from the founder), which is hosted in this same
-- bucket and referenced from the Twilio Content Template's `media` field.
--
-- WhatsApp template video header constraints:
--   - Format: MP4 / 3GP
--   - Max size: 16MB
-- We set the bucket cap to 20MB to leave a small safety margin while still
-- preventing accidental upload of arbitrarily large files.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'video/mp4'],
  file_size_limit = 20971520  -- 20 MB
WHERE id = 'whatsapp-assets';
