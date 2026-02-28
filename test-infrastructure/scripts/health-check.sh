#!/bin/bash
# Database and migration health check
# Runs FK integrity checks, stale data audit, and migration status
# Usage: ./scripts/health-check.sh
set -euo pipefail

PROJECT_REF="zqlowjveyqiagnbmfwsb"

# Get service role key
SERVICE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep service_role | awk '{print $NF}')
if [ -z "$SERVICE_KEY" ]; then
  echo "Error: Could not retrieve service role key. Run: supabase login"
  exit 1
fi

BASE_URL="https://${PROJECT_REF}.supabase.co/rest/v1"
ISSUES=0

echo "=== Database Health Check ==="
echo "  Project: $PROJECT_REF"
echo ""

# Helper: run a count query via REST API
count_query() {
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

# Helper: run SQL via supabase CLI and capture output
run_sql() {
  local sql=$1
  echo "$sql" | supabase db execute --project-ref "$PROJECT_REF" 2>/dev/null
}

echo "--- Orphan Check ---"
echo ""

# Check for tenancies with missing users
ORPHAN_SQL=$(cat <<'EOSQL'
SELECT 'tenancies_missing_user' AS check_name,
       COUNT(*) AS orphan_count
FROM tenancies t
LEFT JOIN users u ON t.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'payments_missing_tenancy',
       COUNT(*)
FROM payments p
LEFT JOIN tenancies t ON p.tenancy_id = t.id
WHERE t.id IS NULL

UNION ALL

SELECT 'notifications_missing_user',
       COUNT(*)
FROM notifications n
LEFT JOIN users u ON n.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'cashback_missing_user',
       COUNT(*)
FROM cashback_ledger c
LEFT JOIN users u ON c.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'bank_accounts_missing_user',
       COUNT(*)
FROM bank_accounts b
LEFT JOIN users u ON b.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'waitlist_missing_user',
       COUNT(*)
FROM waitlist_entries w
LEFT JOIN users u ON w.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'device_tokens_missing_user',
       COUNT(*)
FROM device_tokens d
LEFT JOIN users u ON d.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'payment_schedules_missing_tenancy',
       COUNT(*)
FROM payment_schedules ps
LEFT JOIN tenancies t ON ps.tenancy_id = t.id
WHERE t.id IS NULL

UNION ALL

SELECT 'processed_webhooks_missing_payment',
       COUNT(*)
FROM processed_webhooks pw
LEFT JOIN payments p ON pw.payment_id = p.id
WHERE p.id IS NULL;
EOSQL
)

ORPHAN_RESULT=$(run_sql "$ORPHAN_SQL")
echo "$ORPHAN_RESULT"

# Check for non-zero orphan counts
if echo "$ORPHAN_RESULT" | grep -qE '\|\s*[1-9]'; then
  echo ""
  echo "  WARNING: Orphan records detected!"
  ISSUES=$((ISSUES + 1))
else
  echo ""
  echo "  No orphan records found."
fi
echo ""

echo "--- Stale Data Audit ---"
echo ""

STALE_SQL=$(cat <<'EOSQL'
SELECT 'stale_otp_requests_7d' AS check_name,
       COUNT(*) AS count
FROM otp_requests
WHERE created_at < NOW() - INTERVAL '7 days'

UNION ALL

SELECT 'stale_idempotency_keys_24h',
       COUNT(*)
FROM idempotency_keys
WHERE created_at < NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 'pending_payments_24h',
       COUNT(*)
FROM payments
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 'unverified_identities_30d',
       COUNT(*)
FROM identity_verifications
WHERE status != 'verified'
  AND created_at < NOW() - INTERVAL '30 days'

UNION ALL

SELECT 'test_users_in_production',
       COUNT(*)
FROM users
WHERE phone LIKE '%999990%';
EOSQL
)

STALE_RESULT=$(run_sql "$STALE_SQL")
echo "$STALE_RESULT"

# Check for stale data warnings
if echo "$STALE_RESULT" | grep -E 'stale_otp_requests|stale_idempotency_keys' | grep -qE '\|\s*[1-9]'; then
  echo ""
  echo "  WARNING: Stale data detected. Consider running cleanup."
  ISSUES=$((ISSUES + 1))
fi
echo ""

echo "--- Table Row Counts ---"
echo ""

COUNTS_SQL=$(cat <<'EOSQL'
SELECT 'users' AS table_name, COUNT(*) AS rows FROM users
UNION ALL SELECT 'tenancies', COUNT(*) FROM tenancies
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'payment_schedules', COUNT(*) FROM payment_schedules
UNION ALL SELECT 'waitlist_entries', COUNT(*) FROM waitlist_entries
UNION ALL SELECT 'cashback_ledger', COUNT(*) FROM cashback_ledger
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'bank_accounts', COUNT(*) FROM bank_accounts
UNION ALL SELECT 'identity_verifications', COUNT(*) FROM identity_verifications
UNION ALL SELECT 'otp_requests', COUNT(*) FROM otp_requests
ORDER BY 1;
EOSQL
)

COUNTS_RESULT=$(run_sql "$COUNTS_SQL")
echo "$COUNTS_RESULT"
echo ""

echo "--- Migration Status ---"
echo ""
supabase db migrations list --project-ref "$PROJECT_REF" 2>/dev/null | tail -20 || echo "  Could not fetch migration status"
echo ""

echo "=== Health Check Complete ==="
if [ "$ISSUES" -gt 0 ]; then
  echo "  Issues found: $ISSUES"
  exit 1
else
  echo "  All checks passed."
fi
