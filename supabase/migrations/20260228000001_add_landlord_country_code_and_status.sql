-- Add missing columns that send-landlord-invite edge function writes to
ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS landlord_status TEXT DEFAULT 'none'
    CHECK (landlord_status IN ('none', 'invited', 'verified', 'declined'));
