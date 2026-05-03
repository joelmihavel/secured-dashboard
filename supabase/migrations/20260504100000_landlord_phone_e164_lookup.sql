-- Tenancy lookup by landlord E.164 phone number — country-agnostic.
--
-- Problem: the whatsapp-inbound webhook needs to find the tenancy whose
-- landlord matches a given E.164 phone (Twilio sends `From=whatsapp:+919886051622`).
-- Tenancies store country_code and landlord_phone separately:
--   country_code='+91', landlord_phone='9886051622'
--
-- The original implementation matched on last-10-digits via LIKE, which
-- silently broke for non-10-digit national numbers (Singapore +65 = 8 digits,
-- France +33 = 9 digits, Germany +49 = 11 digits, Saudi Arabia +966 = 9
-- digits, UAE +971 = 9 digits, Australia +61 = 9 digits, etc.).
--
-- This RPC matches on the exact concatenation of country_code + landlord_phone
-- against the inbound E.164. Works for every country we already validate via
-- isValidPhone (15 supported + the 7-15 digit fallback range). No country
-- code list to maintain in app code.

CREATE OR REPLACE FUNCTION public.find_tenancy_by_landlord_e164(p_phone_e164 TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  landlord_phone VARCHAR(15),
  country_code VARCHAR(10),
  landlord_invite_sent_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.user_id,
    t.landlord_phone,
    t.country_code,
    t.landlord_invite_sent_at
  FROM public.tenancies t
  WHERE COALESCE(t.country_code, '') || COALESCE(t.landlord_phone, '') = p_phone_e164
  ORDER BY t.landlord_invite_sent_at DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_tenancy_by_landlord_e164(TEXT) TO service_role;

COMMENT ON FUNCTION public.find_tenancy_by_landlord_e164(TEXT) IS
  'Find the most recently invited tenancy whose landlord phone matches the given E.164 phone (e.g. ''+919886051622''). '
  'Used by the whatsapp-inbound webhook to route inbound replies/quick-reply taps to the correct tenancy. '
  'Country-agnostic: matches on concatenated (country_code || landlord_phone). Returns at most 1 row.';
