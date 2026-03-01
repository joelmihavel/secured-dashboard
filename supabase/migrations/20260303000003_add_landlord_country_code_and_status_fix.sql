-- Fix: migration 20260228000001_add_landlord_country_code_and_status was never applied
-- due to version collision with 20260228000001_create_netbanking_banks.sql.applied.
-- This migration adds the missing columns.

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS landlord_status TEXT DEFAULT 'none'
    CHECK (landlord_status IN ('none', 'invited', 'verified', 'declined'));
