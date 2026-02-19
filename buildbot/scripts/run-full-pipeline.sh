#!/bin/bash
# run-full-pipeline.sh — Full BuildBot pipeline orchestrator
#
# Runs hierarchy capture + verify-screen.ts for each flow group.
#
# Usage:
#   bash scripts/run-full-pipeline.sh                    # all flows
#   bash scripts/run-full-pipeline.sh --flow auth        # auth flow only
#   bash scripts/run-full-pipeline.sh --flow onboarding  # onboarding flow only
#   bash scripts/run-full-pipeline.sh --screen 1-28055   # single screen
#
# Available flows: auth, onboarding, home, payment, profile, transactions, payment-cards

set -euo pipefail
cd "$(dirname "$0")/.."

FLOW="${1:---flow}"
FLOW_NAME="${2:-all}"

# If first arg is --screen, handle single screen
if [ "$FLOW" = "--screen" ]; then
  SCREEN_ID="$FLOW_NAME"
  echo "═══════════════════════════════════════════════════════"
  echo "PHASE 1: Capturing hierarchy for screen $SCREEN_ID"
  echo "═══════════════════════════════════════════════════════"
  npx tsx scripts/capture-all-hierarchies.ts --screen "$SCREEN_ID"

  # Look up the route for this screen
  ROUTE=$(node -e "
    const r = require('./config/screen-routes.json');
    for (const [k, v] of Object.entries(r.routes)) {
      for (const s of v.screens) {
        if (s.figmaId === '$SCREEN_ID') {
          console.log(v.route);
          process.exit(0);
        }
      }
    }
    console.error('Screen not found');
    process.exit(1);
  ")

  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "PHASE 2: Running verify pipeline for $SCREEN_ID"
  echo "═══════════════════════════════════════════════════════"
  npx tsx scripts/verify-screen.ts "$SCREEN_ID" --route "$ROUTE" --skip-maestro
  exit 0
fi

# Flow mode
echo "═══════════════════════════════════════════════════════"
echo "PHASE 1: Capturing hierarchies for flow: $FLOW_NAME"
echo "═══════════════════════════════════════════════════════"
npx tsx scripts/capture-all-hierarchies.ts --flow "$FLOW_NAME"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "PHASE 2: Running verify pipeline for each screen"
echo "═══════════════════════════════════════════════════════"

# Map flow groups to screen-routes.json keys
declare -A FLOW_GROUPS
FLOW_GROUPS[auth]="splash beta-splash carousel sign-up otp"
FLOW_GROUPS[onboarding]="waitlist agreement-upload agreement-review setup add-bank invite-landlord"
FLOW_GROUPS[home]="home-empty home-active"
FLOW_GROUPS[payment]="payment-select payment-add-upi payment-add-card payment-add-netbanking payment-processing payment-success payment-failed"
FLOW_GROUPS[profile]="profile"
FLOW_GROUPS[transactions]="transactions"
FLOW_GROUPS[payment-cards]="payment-cards"

if [ "$FLOW_NAME" = "all" ]; then
  ROUTE_KEYS=$(node -e "const r=require('./config/screen-routes.json'); console.log(Object.keys(r.routes).join(' '))")
else
  ROUTE_KEYS="${FLOW_GROUPS[$FLOW_NAME]:-$FLOW_NAME}"
fi

TOTAL=0
PASSED=0
FAILED=0

for ROUTE_KEY in $ROUTE_KEYS; do
  echo ""
  echo "─── Verifying: $ROUTE_KEY ───"

  # Use batch mode for multi-state screens
  if npx tsx scripts/verify-screen.ts --screen "$ROUTE_KEY" --skip-maestro --skip-inspector 2>&1; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
  TOTAL=$((TOTAL + 1))
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "PIPELINE COMPLETE"
echo "Total flows: $TOTAL | Passed: $PASSED | Failed: $FAILED"
echo "═══════════════════════════════════════════════════════"
