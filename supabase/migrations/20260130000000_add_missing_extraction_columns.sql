-- Add missing columns to extracted_rental_info table
-- These columns are used by process-document function

ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,2);
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS gemini_verification_score DECIMAL(5,2);
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS fields_extracted INTEGER;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS tenant_names TEXT[];
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS landlord_names TEXT[];
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS extraction_method TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS is_city_supported BOOLEAN DEFAULT false;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS gemini_raw_response JSONB;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS raw_extraction_data JSONB;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS micromarket TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS property_name TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS rent_duration_months INTEGER;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS rent_escalation_percent DECIMAL(5,2);
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS agreement_date DATE;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS registration_number TEXT;
-- E-stamp fields
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS certificate_no TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS certificate_issued_date DATE;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS account_reference TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS purchased_by TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS description_of_document TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS first_party TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS second_party TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS stamp_duty_paid_by TEXT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS consideration_price_paise BIGINT;
ALTER TABLE extracted_rental_info ADD COLUMN IF NOT EXISTS stamp_duty_amount_paise BIGINT;
