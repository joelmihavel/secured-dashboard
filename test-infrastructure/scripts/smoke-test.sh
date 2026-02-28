#!/bin/bash
# Smoke test all 61 edge functions
# Checks that each function responds (no 500/503 errors)
# Usage: ./scripts/smoke-test.sh [--verbose]
set -euo pipefail

PROJECT_REF="zqlowjveyqiagnbmfwsb"
VERBOSE=false
[ "${1:-}" = "--verbose" ] && VERBOSE=true

# Get keys
ANON_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep anon | awk '{print $NF}')
SERVICE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep service_role | awk '{print $NF}')

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "Error: Could not retrieve API keys. Run: supabase login"
  exit 1
fi

BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"

PASS=0
FAIL=0
ERRORS=()
WARNINGS=()

# Public endpoints (anon key)
PUBLIC_FUNCTIONS="dev-seed get-fee-config get-netbanking-banks"

# All 61 edge functions
ALL_FUNCTIONS=(
  add-card-token add-upi-vpa admin-waitlist agreement-lifecycle apply-referral-code
  assign-default-avatar auth-otp calculate-cashback check-payment-status claim-invite-code
  cleanup-stale-payments confirm-extraction dashboard-data delete-account delete-payment-method
  dev-seed generate-payu-hash generate-receipt get-bin-info get-cashback-history get-fee-config
  get-my-referral-code get-netbanking-banks get-payment-history get-payment-schedule
  get-payment-stamps get-refund-status get-saved-payment-methods get-waitlist-status
  initiate-payment initiate-refund join-waitlist landlord-approve manage-landlord
  mark-notification-read payment-webhook pixelate-avatar poll-settlement-status
  process-document register-device-token save-bank-preference schedule-payment
  seed-test-data send-landlord-invite send-push-notification send-sms send-whatsapp
  set-default-payment-method settle-to-landlord sync-netbanking-banks test-cashfree-m360
  update-extraction update-profile upload-avatar upload-document validate-referral-code
  verify-bank verify-card verify-identity verify-pan verify-utility
)

# GET endpoints (query-style functions)
GET_FUNCTIONS="get-bin-info get-cashback-history get-fee-config get-my-referral-code get-netbanking-banks get-payment-history get-payment-schedule get-payment-stamps get-refund-status get-saved-payment-methods get-waitlist-status verify-utility"

echo "=== Edge Function Smoke Test ==="
echo "  Project: $PROJECT_REF"
echo "  Functions: ${#ALL_FUNCTIONS[@]}"
echo ""

for fn in "${ALL_FUNCTIONS[@]}"; do
  # Choose key
  if echo "$PUBLIC_FUNCTIONS" | grep -qw "$fn"; then
    KEY="$ANON_KEY"
    KEY_TYPE="anon"
  else
    KEY="$SERVICE_KEY"
    KEY_TYPE="service"
  fi

  # Choose method
  if echo "$GET_FUNCTIONS" | grep -qw "$fn"; then
    METHOD="GET"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      -X GET "${BASE_URL}/${fn}" \
      -H "Authorization: Bearer $KEY" \
      -H "Content-Type: application/json" 2>/dev/null || echo "000")
  else
    METHOD="POST"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      -X POST "${BASE_URL}/${fn}" \
      -H "Authorization: Bearer $KEY" \
      -H "Content-Type: application/json" \
      -d '{}' 2>/dev/null || echo "000")
  fi

  # 500, 503, or timeout (000) = FAIL. Everything else = PASS.
  if [ "$RESPONSE" = "500" ] || [ "$RESPONSE" = "503" ] || [ "$RESPONSE" = "000" ]; then
    FAIL=$((FAIL + 1))
    ERRORS+=("FAIL  $fn  (HTTP $RESPONSE, $METHOD, $KEY_TYPE)")
    if [ "$VERBOSE" = true ]; then
      echo "  FAIL  $fn  (HTTP $RESPONSE)"
    else
      printf "x"
    fi
  elif [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "403" ] || [ "$RESPONSE" = "404" ]; then
    PASS=$((PASS + 1))
    WARNINGS+=("WARN  $fn  (HTTP $RESPONSE, $METHOD, $KEY_TYPE) -- auth/routing issue")
    if [ "$VERBOSE" = true ]; then
      echo "  WARN  $fn  (HTTP $RESPONSE)"
    else
      printf "!"
    fi
  else
    PASS=$((PASS + 1))
    if [ "$VERBOSE" = true ]; then
      echo "  PASS  $fn  (HTTP $RESPONSE)"
    else
      printf "."
    fi
  fi
done

echo ""
echo ""
echo "=== Results ==="
echo "  PASS: $PASS / ${#ALL_FUNCTIONS[@]}"
echo "  FAIL: $FAIL / ${#ALL_FUNCTIONS[@]}"

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo ""
  echo "--- Warnings (${#WARNINGS[@]}) ---"
  for warn in "${WARNINGS[@]}"; do
    echo "  $warn"
  done
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "--- Failures ---"
  for err in "${ERRORS[@]}"; do
    echo "  $err"
  done
  echo ""
  exit 1
else
  echo ""
  echo "All functions healthy."
fi
