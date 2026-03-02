-- Add geocoding columns to extracted_rental_info
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS geocode_formatted_address TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS geocode_place_id TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;
