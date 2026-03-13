#!/bin/bash
# Seed a test phone to any journey state
# Usage: ./scripts/seed-state.sh <state> <phone> [--skip-landlord] [--skip-utility] [--with-payments N] [--with-cashback]
#
# States: signed_up, agreement_confirmed, extraction_confirmed, waitlisted, waitlisted_rejected, approved, active
# Phone pattern: +91999990XXXX (test numbers only)

set -euo pipefail

STATE=${1:?"Usage: $0 <state> <phone> [options]"}
PHONE=${2:?"Usage: $0 <state> <phone> [options]"}
shift 2

PROJECT_REF="uowjtrzmszuaiokqxgir"

# Validate state
VALID_STATES="clean otp_sent verified signed_up agreement_confirmed agreement_uploaded extraction_confirmed landlord_invited waitlisted waitlisted_rejected approved setup_complete active"
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

# Parse flags
SKIP_LANDLORD=false
SKIP_UTILITY=false
WITH_PAYMENTS=false
PAYMENT_COUNT=3
WITH_CASHBACK=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-landlord) SKIP_LANDLORD=true; shift ;;
    --skip-utility) SKIP_UTILITY=true; shift ;;
    --with-payments) WITH_PAYMENTS=true; PAYMENT_COUNT=${2:-3}; shift 2 ;;
    --with-cashback) WITH_CASHBACK=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Get service role key
SERVICE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep service_role | awk '{print $NF}')
if [ -z "$SERVICE_KEY" ]; then
  echo "Error: Could not retrieve service role key. Run: supabase login"
  exit 1
fi

# Build options JSON
OPTIONS="{"
OPTS_ADDED=false

if [ "$SKIP_LANDLORD" = true ]; then
  OPTIONS+="\"landlord_approved\": false"
  OPTS_ADDED=true
fi

if [ "$SKIP_UTILITY" = true ]; then
  [ "$OPTS_ADDED" = true ] && OPTIONS+=", "
  OPTIONS+="\"utility_verified\": false"
  OPTS_ADDED=true
fi

if [ "$WITH_PAYMENTS" = true ] || [ "$STATE" = "active" ]; then
  [ "$OPTS_ADDED" = true ] && OPTIONS+=", "
  OPTIONS+="\"with_payment_history\": true, \"payment_count\": $PAYMENT_COUNT"
  OPTS_ADDED=true
fi

if [ "$WITH_CASHBACK" = true ]; then
  [ "$OPTS_ADDED" = true ] && OPTIONS+=", "
  OPTIONS+="\"with_cashback\": true"
fi

OPTIONS+="}"

echo "=== Seed Test Data ==="
echo "  Phone:   $PHONE"
echo "  State:   $STATE"
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
  echo "Seeded successfully (HTTP $HTTP_CODE)"
else
  echo "Seed failed (HTTP $HTTP_CODE)"
  exit 1
fi
