#!/bin/bash
# Cascade-delete a single test user by phone number
# Usage: ./scripts/cleanup-user.sh <phone>
#
# Safety: Only deletes users matching the +91999990XXXX test phone pattern
# Deletes in FK order to avoid constraint violations

set -euo pipefail

PHONE=${1:?"Usage: $0 <phone>"}
PROJECT_REF="zqlowjveyqiagnbmfwsb"

# Validate phone pattern
if ! echo "$PHONE" | grep -qE '^\+91999990[0-9]{4}$'; then
  echo "Error: Phone must match +91999990XXXX pattern (test numbers only)"
  exit 1
fi

# Get service role key
SERVICE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep service_role | awk '{print $NF}')
if [ -z "$SERVICE_KEY" ]; then
  echo "Error: Could not retrieve service role key. Run: supabase login"
  exit 1
fi

BASE_URL="https://${PROJECT_REF}.supabase.co/rest/v1"
AUTH_HEADERS=(-H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" -H "Prefer: return=representation")

echo "=== Cleanup Test User ==="
echo "  Phone: $PHONE"
echo ""

# Step 1: Look up user ID by phone
echo "Looking up user..."
USER_RESPONSE=$(curl -s -X GET \
  "${BASE_URL}/users?phone=eq.${PHONE}&select=id" \
  "${AUTH_HEADERS[@]}")

USER_ID=$(echo "$USER_RESPONSE" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null)

if [ -z "$USER_ID" ]; then
  echo "No test user found with phone $PHONE"
  exit 0
fi

echo "  User ID: $USER_ID"
echo ""

# Step 2: Get tenancy IDs for this user (needed for payments FK)
TENANCY_IDS=$(curl -s -X GET \
  "${BASE_URL}/tenancies?user_id=eq.${USER_ID}&select=id" \
  "${AUTH_HEADERS[@]}" | python3 -c "import sys,json; data=json.load(sys.stdin); print(','.join(d['id'] for d in data) if data else '')" 2>/dev/null)

# Helper function for deletion
delete_from() {
  local table=$1
  local filter=$2
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    "${BASE_URL}/${table}?${filter}" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal")
  if [ "$response" -ge 200 ] && [ "$response" -lt 300 ]; then
    echo "  Cleaned: $table"
  else
    echo "  Warning: $table returned HTTP $response"
  fi
}

echo "Deleting in FK order..."

# FK-ordered deletion
delete_from "device_tokens" "user_id=eq.${USER_ID}"
delete_from "notifications" "user_id=eq.${USER_ID}"
delete_from "cashback_ledger" "user_id=eq.${USER_ID}"

# Payments reference tenancies, not user directly
if [ -n "$TENANCY_IDS" ]; then
  IFS=',' read -ra T_IDS <<< "$TENANCY_IDS"
  for tid in "${T_IDS[@]}"; do
    delete_from "processed_webhooks" "payment_id=in.(select+id+from+payments+where+tenancy_id+eq.${tid})"
    delete_from "payments" "tenancy_id=eq.${tid}"
    delete_from "payment_schedules" "tenancy_id=eq.${tid}"
  done
fi

delete_from "bank_accounts" "user_id=eq.${USER_ID}"
delete_from "identity_verifications" "user_id=eq.${USER_ID}"
delete_from "utility_verifications" "user_id=eq.${USER_ID}"
delete_from "tenancies" "user_id=eq.${USER_ID}"
delete_from "extracted_rental_info" "user_id=eq.${USER_ID}"
delete_from "waitlist_entries" "user_id=eq.${USER_ID}"
delete_from "referral_redemptions" "user_id=eq.${USER_ID}"
delete_from "otp_requests" "phone=eq.${PHONE}"
delete_from "idempotency_keys" "user_id=eq.${USER_ID}"
delete_from "users" "id=eq.${USER_ID}&phone=like.*999990*"

# Step 3: Delete auth user via admin API
echo ""
echo "Deleting auth user..."
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  "https://${PROJECT_REF}.supabase.co/auth/v1/admin/users/${USER_ID}" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY")

if [ "$AUTH_RESPONSE" -ge 200 ] && [ "$AUTH_RESPONSE" -lt 300 ]; then
  echo "  Auth user deleted"
else
  echo "  Warning: Auth user deletion returned HTTP $AUTH_RESPONSE"
fi

echo ""
echo "Cleanup complete for $PHONE"
