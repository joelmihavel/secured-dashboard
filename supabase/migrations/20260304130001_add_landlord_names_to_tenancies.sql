-- Add landlord_names array to tenancies table
-- Stores ALL landlord names from the agreement (multiple landlords / joint ownership).
-- The existing landlord_name (singular) remains as the primary/invited landlord.

ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS landlord_names TEXT[];

-- Backfill existing tenancies from their linked extraction records
UPDATE tenancies t
SET landlord_names = eri.landlord_names
FROM extracted_rental_info eri
WHERE eri.id = t.extracted_rental_info_id
  AND eri.landlord_names IS NOT NULL
  AND t.landlord_names IS NULL;

-- For tenancies without an extraction link, seed from the singular field
UPDATE tenancies
SET landlord_names = ARRAY[landlord_name]
WHERE landlord_names IS NULL
  AND landlord_name IS NOT NULL;
