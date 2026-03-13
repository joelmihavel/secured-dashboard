#!/bin/bash
# Seed test data for a specific user journey state.
#
# Usage:
#   ./scripts/seed-test.sh <target_state> [phone_number]
#
# Examples:
#   ./scripts/seed-test.sh signed_up
#   ./scripts/seed-test.sh active +919999900001
#   ./scripts/seed-test.sh approved +919999900002
#
# Valid states: signed_up, agreement_confirmed, waitlisted,
#               waitlisted_rejected, approved, active
#
# Options (via env vars):
#   SEED_PAYMENTS=true     Include payment history (active state)
#   SEED_PAYMENT_COUNT=5   Number of payments (default 3)
#   SEED_CASHBACK=true     Include cashback data

set -e

STATE=${1:?"Usage: $0 <target_state> [phone_number]"}
PHONE=${2:-"+919999900001"}
PROJECT_REF="uowjtrzmszuaiokqxgir"

# Validate state
VALID_STATES="signed_up agreement_confirmed waitlisted waitlisted_rejected approved active"
if ! echo "$VALID_STATES" | grep -qw "$STATE"; then
  echo "Error: Invalid state '$STATE'"
  echo "Valid states: $VALID_STATES"
  exit 1
fi

# Validate phone pattern
if ! echo "$PHONE" | grep -qE '^\+91999990[0-9]{4}$'; then
  echo "Error: Phone must match +91999990XXXX pattern (test numbers only)"
  exit 1
fi

# Get service role key
SERVICE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep service_role | awk '{print $NF}')

if [ -z "$SERVICE_KEY" ]; then
  echo "Error: Could not retrieve service role key."
  echo "Make sure you are logged in to Supabase CLI: supabase login"
  exit 1
fi

# Build options JSON
OPTIONS="{}"
if [ "${SEED_PAYMENTS:-false}" = "true" ] || [ "$STATE" = "active" ]; then
  PAYMENT_COUNT=${SEED_PAYMENT_COUNT:-3}
  CASHBACK=${SEED_CASHBACK:-true}
  OPTIONS="{\"with_payment_history\": true, \"payment_count\": $PAYMENT_COUNT, \"with_cashback\": $CASHBACK}"
fi

echo "Seeding test data..."
echo "  Phone:  $PHONE"
echo "  State:  $STATE"
echo "  Options: $OPTIONS"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://${PROJECT_REF}.supabase.co/functions/v1/seed-test-data" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"$PHONE\", \"target_state\": \"$STATE\", \"options\": $OPTIONS}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

echo ""
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "Done. (HTTP $HTTP_CODE)"
else
  echo "Failed. (HTTP $HTTP_CODE)"
  exit 1
fi
