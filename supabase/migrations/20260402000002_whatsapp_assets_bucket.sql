-- Public bucket for WhatsApp notification images (Twilio needs direct URL access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-assets',
  'whatsapp-assets',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;
