-- Add rooms_in_agreement and property_bhk_type columns to extracted_rental_info
-- rooms_in_agreement: number of rooms covered by this agreement (partial rent = only rented rooms)
-- property_bhk_type: BHK type of the full property (e.g., '1BHK', '2BHK', '3BHK')

ALTER TABLE extracted_rental_info
  ADD COLUMN IF NOT EXISTS rooms_in_agreement smallint,
  ADD COLUMN IF NOT EXISTS property_bhk_type text;

-- Add to admin funnel view if it exists
COMMENT ON COLUMN extracted_rental_info.rooms_in_agreement IS 'Number of rooms/bedrooms covered by this agreement. Partial rent = only rented portion count.';
COMMENT ON COLUMN extracted_rental_info.property_bhk_type IS 'BHK type of the full property (e.g., 1BHK, 2BHK, 3BHK, Studio, Independent House).';
