-- Flent Secured v2 - Migration: Restrict sensitive payment_methods columns
-- Creates a safe view excluding card_token for client-side queries.
-- Clients should query payment_methods_safe instead of payment_methods directly.

CREATE OR REPLACE VIEW payment_methods_safe AS
SELECT
  id,
  user_id,
  type,
  display_name,
  upi_vpa,
  upi_provider,
  card_last4,
  card_network,
  card_type,
  card_issuer,
  card_expiry,
  card_expiry_month,
  card_expiry_year,
  bank_code,
  bank_name,
  nickname,
  is_default,
  is_verified,
  verification_status,
  verified_at,
  metadata,
  created_at,
  updated_at
FROM payment_methods
WHERE deleted_at IS NULL;

-- Grant read access to authenticated users
GRANT SELECT ON payment_methods_safe TO authenticated;

COMMENT ON VIEW payment_methods_safe IS 'Safe view of payment_methods excluding card_token. Use this for all client-facing queries.';
