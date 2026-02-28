#!/bin/bash
# =================================================================
# Seed Apple Review Test Accounts
#
# Seeds TWO demo accounts for Apple Review:
#
# 1. QUICK TEST (+919999900001 / 123456)
#    Pre-seeded to "active" state with payment history, cashback,
#    verified bank, and saved payment methods. Apple tester can
#    immediately test payments, receipts, profile management.
#
# 2. FULL FLOW (+919999900002 / 123456)
#    Seeded to "signed_up" state (minimal). Apple tester goes through
#    the complete onboarding journey:
#    Agreement upload → Review → Auto-approved → Add Bank →
#    Verify Utility → Home Dashboard → Make Payment
#
# Usage:
#   ./test-infrastructure/scripts/seed-apple-review.sh
#   ./test-infrastructure/scripts/seed-apple-review.sh quick    # only quick-test account
#   ./test-infrastructure/scripts/seed-apple-review.sh full     # only full-flow account
#
# Prerequisites:
#   - Supabase CLI installed and authenticated
#   - Edge functions deployed (seed-test-data must be live)
#   - BOTH test phones added in Supabase Dashboard:
#     → Authentication → Phone Auth → Test Phone Numbers
#     → +919999900001 / 123456
#     → +919999900002 / 123456
# =================================================================

set -euo pipefail

PROJECT_REF="zqlowjveyqiagnbmfwsb"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
MODE="${1:-all}"

echo "=== Apple Review Account Seeder ==="
echo ""

# Get service role key
echo "Fetching service role key..."
SERVICE_KEY=$(supabase projects api-keys --project-ref "${PROJECT_REF}" 2>/dev/null | grep service_role | awk '{print $NF}')

if [ -z "${SERVICE_KEY}" ]; then
  echo "ERROR: Could not retrieve service role key."
  echo "Make sure you're logged in: supabase login"
  exit 1
fi

seed_user() {
  local PHONE="$1"
  local STATE="$2"
  local OPTIONS="$3"
  local LABEL="$4"

  echo "--- Seeding ${LABEL} ---"
  echo "  Phone: ${PHONE}"
  echo "  State: ${STATE}"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${SUPABASE_URL}/functions/v1/seed-test-data" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"${PHONE}\",\"target_state\":\"${STATE}\",\"options\":${OPTIONS}}")

  HTTP_CODE=$(echo "${RESPONSE}" | tail -1)
  BODY=$(echo "${RESPONSE}" | sed '$d')

  if [ "${HTTP_CODE}" -ge 200 ] && [ "${HTTP_CODE}" -lt 300 ]; then
    echo "  Result: SUCCESS"
    echo "${BODY}" | python3 -m json.tool 2>/dev/null || echo "  ${BODY}"
  else
    echo "  Result: FAILED (HTTP ${HTTP_CODE})"
    echo "${BODY}" | python3 -m json.tool 2>/dev/null || echo "  ${BODY}"
    return 1
  fi
  echo ""
}

ERRORS=0

# Account 1: Quick Test — Active with full data
if [ "${MODE}" = "all" ] || [ "${MODE}" = "quick" ]; then
  seed_user \
    "+919999900001" \
    "active" \
    '{"with_payment_history":true,"payment_count":3,"with_cashback":true}' \
    "Quick Test Account" || ERRORS=$((ERRORS + 1))
fi

# Account 2: Full Flow — Signed up only (tester does the full journey)
if [ "${MODE}" = "all" ] || [ "${MODE}" = "full" ]; then
  seed_user \
    "+919999900002" \
    "signed_up" \
    '{}' \
    "Full Flow Account" || ERRORS=$((ERRORS + 1))
fi

echo "========================================="
echo ""

if [ "${ERRORS}" -gt 0 ]; then
  echo "WARNING: ${ERRORS} account(s) failed to seed."
  echo "Check the output above for details."
  exit 1
fi

echo "=== Apple Review Credentials ==="
echo ""
echo "ACCOUNT 1 — Quick Test (pre-loaded dashboard)"
echo "  Phone: +91 9999900001"
echo "  OTP:   123456"
echo "  State: Active with 3 payments, cashback, bank verified"
echo "  Test:  Dashboard, payments, receipts, profile, delete account"
echo ""
echo "ACCOUNT 2 — Full Onboarding Flow"
echo "  Phone: +91 9999900002"
echo "  OTP:   123456"
echo "  State: Signed up (minimal)"
echo "  Test:  Agreement upload → extraction → confirm → auto-approved"
echo "         → add bank → verify utility → dashboard → payment"
echo ""
echo "=== Dashboard Setup ==="
echo "Ensure BOTH phones are in Supabase Dashboard:"
echo "  Auth → Phone Auth → Test Phone Numbers"
echo "  +919999900001 / 123456"
echo "  +919999900002 / 123456"
