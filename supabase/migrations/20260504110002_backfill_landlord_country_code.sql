-- Backfill tenancies.country_code for the small population of rows where
-- country_code IS NULL but landlord_phone contains its country code in the
-- body (legacy writes that pre-date the country_code column).
--
-- Strategy: only backfill rows where the country code is UNAMBIGUOUS from
-- the data itself. We do NOT default to '+91' for bare 10-digit phones,
-- because Indian tenants frequently have NRI landlords (+1, +44, +61, +971,
-- ...). Inferring '+91' from a bare 10-digit number would silently
-- mis-attribute NRI rows. Those bare-10 NULLs are left for the tenant or
-- admin to resolve via invite-landlord-whatsapp / manage-landlord.
--
-- Rule applied here: when country_code IS NULL AND landlord_phone matches
-- ^91[6-9]\d{9}$  (12 digits, leading '91', then a valid Indian mobile
-- prefix 6-9 followed by 9 digits) — the leading '91' IS the country code
-- written into the body. Split it: country_code='+91', landlord_phone = the
-- last 10 digits.
--
-- Audited prod count at write time (2026-05-04): 1 row affected. Dev may
-- have similar shapes; idempotent because UPDATE only touches rows where
-- country_code IS NULL.

UPDATE public.tenancies
SET
  country_code = '+91',
  landlord_phone = SUBSTRING(landlord_phone, 3, 10)
WHERE country_code IS NULL
  AND landlord_phone ~ '^91[6-9][0-9]{9}$';

-- rollback:
--   No automatic rollback. The original 12-digit form ('91XXXXXXXXXX') can
--   be reconstructed manually as country_code || landlord_phone with the +
--   stripped, but rollback is not expected — the new shape is canonical.
