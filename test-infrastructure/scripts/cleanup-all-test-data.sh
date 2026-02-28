#!/bin/bash
# Remove ALL test user data from the database
# Default: dry run (shows counts). Use --execute to actually delete.
# Usage: ./scripts/cleanup-all-test-data.sh [--execute]
set -euo pipefail

PROJECT_REF="zqlowjveyqiagnbmfwsb"
EXECUTE=false
[ "${1:-}" = "--execute" ] && EXECUTE=true

# Get service role key
SERVICE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep service_role | awk '{print $NF}')
if [ -z "$SERVICE_KEY" ]; then
  echo "Error: Could not retrieve service role key. Run: supabase login"
  exit 1
fi

BASE_URL="https://${PROJECT_REF}.supabase.co/rest/v1"

echo "=== Cleanup All Test Data ==="
if [ "$EXECUTE" = false ]; then
  echo "  Mode: DRY RUN (use --execute to delete)"
else
  echo "  Mode: EXECUTE (will delete data!)"
fi
echo ""

# Helper: count rows matching filter
count_rows() {
  local table=$1
  local filter=$2
  local result
  result=$(curl -s -X GET \
    "${BASE_URL}/${table}?${filter}&select=id" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: count=exact" \
    -H "Range: 0-0" \
    -D - 2>/dev/null | grep -i "content-range" | sed 's/.*\///' | tr -d '\r')
  echo "${result:-0}"
}

# Helper: delete rows matching filter
delete_rows() {
  local table=$1
  local filter=$2
  curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    "${BASE_URL}/${table}?${filter}" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal"
}

# Step 1: Find test user count
echo "--- Test User Discovery ---"
TEST_USER_COUNT=$(count_rows "users" "phone=like.*999990*")
echo "  Test users found: $TEST_USER_COUNT"
echo ""

if [ "$TEST_USER_COUNT" = "0" ]; then
  echo "No test users to clean up."
  exit 0
fi

# FK-ordered tables with their filter
# Tables that reference user_id directly
DIRECT_TABLES=(
  "device_tokens:user_id"
  "notifications:user_id"
  "cashback_ledger:user_id"
  "bank_accounts:user_id"
  "identity_verifications:user_id"
  "utility_verifications:user_id"
  "extracted_rental_info:user_id"
  "waitlist_entries:user_id"
  "referral_redemptions:user_id"
  "idempotency_keys:user_id"
)

# For tenancy-linked tables, we use RPC or nested queries
# Supabase REST doesn't support subqueries in filters directly,
# so we use a two-pass approach

if [ "$EXECUTE" = false ]; then
  echo "--- Dry Run: Row Counts ---"

  # Count direct FK tables
  for entry in "${DIRECT_TABLES[@]}"; do
    TABLE="${entry%%:*}"
    COL="${entry##*:}"
    # Use inner join approach: filter by user_id in test users
    COUNT=$(count_rows "$TABLE" "${COL}=in.(select(id).from(users).filter(phone.like.*999990*))" 2>/dev/null || echo "?")
    echo "  $TABLE: $COUNT"
  done

  # Tenancy-linked tables are harder to count via REST; show test user count
  echo "  tenancies: (linked to $TEST_USER_COUNT test users)"
  echo "  payments: (linked to test tenancies)"
  echo "  payment_schedules: (linked to test tenancies)"
  echo "  processed_webhooks: (linked to test payments)"
  echo "  otp_requests: (linked to test phone numbers)"
  echo "  users: $TEST_USER_COUNT"
  echo "  auth.users: $TEST_USER_COUNT"

  echo ""
  echo "Run with --execute to delete all test data."
  exit 0
fi

# EXECUTE mode: use SQL via supabase db execute for atomic deletion
echo "--- Executing Cleanup ---"

SQL=$(cat <<'EOSQL'
DO $$
DECLARE
  test_user_ids uuid[];
  test_tenancy_ids uuid[];
  test_payment_ids uuid[];
  test_phones text[];
  deleted_count int;
BEGIN
  -- Gather test user IDs
  SELECT array_agg(id) INTO test_user_ids FROM users WHERE phone LIKE '%999990%';
  IF test_user_ids IS NULL THEN
    RAISE NOTICE 'No test users found';
    RETURN;
  END IF;

  -- Gather test phones
  SELECT array_agg(phone) INTO test_phones FROM users WHERE phone LIKE '%999990%';

  -- Gather tenancy IDs
  SELECT array_agg(id) INTO test_tenancy_ids FROM tenancies WHERE user_id = ANY(test_user_ids);

  -- Gather payment IDs (if tenancies exist)
  IF test_tenancy_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO test_payment_ids FROM payments WHERE tenancy_id = ANY(test_tenancy_ids);
  END IF;

  -- 1. device_tokens
  DELETE FROM device_tokens WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'device_tokens: % deleted', deleted_count;

  -- 2. notifications
  DELETE FROM notifications WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'notifications: % deleted', deleted_count;

  -- 3. cashback_ledger
  DELETE FROM cashback_ledger WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'cashback_ledger: % deleted', deleted_count;

  -- 4. processed_webhooks (via payment_ids)
  IF test_payment_ids IS NOT NULL THEN
    DELETE FROM processed_webhooks WHERE payment_id = ANY(test_payment_ids);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'processed_webhooks: % deleted', deleted_count;
  END IF;

  -- 5. payments
  IF test_tenancy_ids IS NOT NULL THEN
    DELETE FROM payments WHERE tenancy_id = ANY(test_tenancy_ids);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'payments: % deleted', deleted_count;
  END IF;

  -- 6. payment_schedules
  IF test_tenancy_ids IS NOT NULL THEN
    DELETE FROM payment_schedules WHERE tenancy_id = ANY(test_tenancy_ids);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'payment_schedules: % deleted', deleted_count;
  END IF;

  -- 7. bank_accounts
  DELETE FROM bank_accounts WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'bank_accounts: % deleted', deleted_count;

  -- 8. identity_verifications
  DELETE FROM identity_verifications WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'identity_verifications: % deleted', deleted_count;

  -- 9. utility_verifications
  DELETE FROM utility_verifications WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'utility_verifications: % deleted', deleted_count;

  -- 10. tenancies
  DELETE FROM tenancies WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'tenancies: % deleted', deleted_count;

  -- 11. extracted_rental_info
  DELETE FROM extracted_rental_info WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'extracted_rental_info: % deleted', deleted_count;

  -- 12. waitlist_entries
  DELETE FROM waitlist_entries WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'waitlist_entries: % deleted', deleted_count;

  -- 13. referral_redemptions
  DELETE FROM referral_redemptions WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'referral_redemptions: % deleted', deleted_count;

  -- 14. otp_requests
  IF test_phones IS NOT NULL THEN
    DELETE FROM otp_requests WHERE phone = ANY(test_phones);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'otp_requests: % deleted', deleted_count;
  END IF;

  -- 15. idempotency_keys
  DELETE FROM idempotency_keys WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'idempotency_keys: % deleted', deleted_count;

  -- 16. users
  DELETE FROM users WHERE id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'users: % deleted', deleted_count;

  -- 17. auth.users
  DELETE FROM auth.users WHERE id = ANY(test_user_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'auth.users: % deleted', deleted_count;

  RAISE NOTICE 'Cleanup complete.';
END $$;
EOSQL
)

echo "$SQL" | supabase db execute --project-ref "$PROJECT_REF"

echo ""
echo "=== Cleanup Complete ==="
