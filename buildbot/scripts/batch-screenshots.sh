#!/bin/bash
# batch-screenshots.sh — Automated screenshot capture for all app screens
#
# Uses SCREENSHOT_TARGET + SCREENSHOT_PARAMS in index.tsx to navigate to each
# screen with the desired mock state, then captures with simctl.
#
# Usage: bash scripts/batch-screenshots.sh [--dry-run] [--filter PATTERN] [--force]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_DIR="$PROJECT_ROOT/rn-app"
INDEX_FILE="$APP_DIR/app/index.tsx"
SCREENSHOT_DIR="$SCRIPT_DIR/../data/screenshots"
APP_BUNDLE="com.flent.secured"

DRY_RUN=false
FILTER=""
WAIT_TIME=8
SKIP_EXISTING=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --filter) FILTER="$2"; shift 2 ;;
    --wait) WAIT_TIME="$2"; shift 2 ;;
    --force) SKIP_EXISTING=false; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$SCREENSHOT_DIR"

# Helper: update SCREENSHOT_TARGET and SCREENSHOT_PARAMS in index.tsx
# Usage: update_screenshot_config "route" "params_json_or_null"
# Example: update_screenshot_config "/(agreement)/upload" "{ state: 'uploading' }"
update_screenshot_config() {
  local route="$1"
  local params="$2"
  python3 - "$INDEX_FILE" "$route" "$params" << 'PYEOF'
import re, sys

filepath = sys.argv[1]
route = sys.argv[2]
params = sys.argv[3]

with open(filepath, 'r') as f:
    content = f.read()

# Update SCREENSHOT_TARGET
if route == "null":
    target_val = "null"
else:
    target_val = f"'{route}'"

content = re.sub(
    r'export const SCREENSHOT_TARGET: string \| null = .*?;',
    f'export const SCREENSHOT_TARGET: string | null = {target_val};',
    content
)

# Update SCREENSHOT_PARAMS
content = re.sub(
    r'export const SCREENSHOT_PARAMS: Record<string, string> \| null = .*?;',
    f'export const SCREENSHOT_PARAMS: Record<string, string> | null = {params};',
    content
)

with open(filepath, 'w') as f:
    f.write(content)
PYEOF
}

# ── Screen definitions: figmaId|route|params|waitTime ──
# params format: TS object literal or "null"
SCREENS=(
  # Auth screens
  "1-28053|/(auth)/splash|null|5"

  # Agreement screens
  "1-30090|/(agreement)/upload|{ state: 'idle' }|8"
  "1-30001|/(agreement)/upload|{ state: 'uploading' }|8"
  "1-30178|/(agreement)/upload|{ state: 'expired' }|8"
  "1-30268|/(agreement)/upload|{ state: 'too-large' }|8"
  "1-30358|/(agreement)/upload|{ state: 'manual-review' }|8"
  "1-30448|/(agreement)/review|{ state: 'verify' }|8"
  "1-30820|/(agreement)/review|{ state: 'modify' }|8"

  # Setup screens
  "41-10712|/(setup)|{ step: '1' }|8"
  "41-10859|/(setup)|{ step: '2' }|8"
  "41-11006|/(setup)|{ step: '3' }|8"
  "1-31485|/(setup)/add-bank|null|8"
  "1-31671|/(setup)/invite-landlord|null|8"

  # Payment screens
  "41-8369|/(payment)/add-upi|null|8"
  "41-8450|/(payment)/add-card|null|8"
  "41-8529|/(payment)/add-netbanking|null|8"
  "41-9460|/(payment)/processing|null|8"
  "41-9388|/(payment)/success|null|8"
  "41-9511|/(payment)/success|{ cashback: '0' }|8"
  "41-9563|/(payment)/failed|null|8"
  "41-9635|/(payment)/failed|{ state: 'refunded' }|8"

  # Profile screens
  "41-8880|/(profile)/edit|null|8"
  "41-8612|/(profile)/payment-methods|{ tab: 'credit' }|8"
  "41-9307|/(profile)/payment-methods|{ tab: 'bank' }|8"
  "41-9811|/(profile)/agreement|null|8"

  # Transactions
  "243-5870|/(transactions)|null|8"
  "41-8695|/(transactions)/1|{ state: 'with-cashback' }|8"
  "41-9681|/(transactions)/1|{ state: 'no-cashback' }|8"
  "41-9746|/(transactions)/1|{ state: 'late-payment' }|8"

  # Home — Active States (mock via homeState in SCREENSHOT_PARAMS → useDashboard)
  "243-2762|/(main)|{ homeState: 'bank-upi' }|10"
  "243-2967|/(main)|{ homeState: 'all-methods' }|10"
  "243-3170|/(main)|{ homeState: 'late-payment' }|10"
  "243-3378|/(main)|{ homeState: 'missed-payment' }|10"
  "243-7185|/(main)|{ homeState: 'complete' }|10"

  # Home — Empty States
  "243-5689|/(main)|{ homeState: 'no-cashback' }|10"
  "243-6296|/(main)|{ homeState: 'upi-no-cashbacks' }|10"
  "243-6490|/(main)|{ homeState: 'setup-payment' }|10"
  "243-6731|/(main)|{ homeState: 'setup-upi' }|10"

  # Payment Select Method (mock via selectState → useDashboard)
  "41-8901|/(payment)/select-method|{ selectState: 'before-7th' }|8"
  "41-9004|/(payment)/select-method|{ selectState: 'after-7th' }|8"
  "41-9114|/(payment)/select-method|{ selectState: 'no-setup' }|8"

  # Pay Rent / Transaction screen (uses useDashboard mock data)
  "243-5870|/(transactions)|{ homeState: 'bank-upi' }|10"

  # Waitlist (different states)
  "41-11206|/(waitlist)|{ state: 'pending' }|8"
  "41-11313|/(waitlist)|{ state: 'accepted' }|8"
  "41-11410|/(waitlist)|{ state: 'rejected' }|8"
  "41-11506|/(waitlist)|{ state: 'pending_long' }|8"
  "41-11613|/(waitlist)|{ state: 'referral' }|8"
  "41-11720|/(waitlist)|{ state: 'referral_invalid' }|8"

  # OTP (different states)
  "1-31175|/(auth)/otp|{ state: 'empty' }|8"
  "1-31073|/(auth)/otp|{ state: 'filled' }|8"
  "1-31277|/(auth)/otp|{ state: 'error1' }|8"
  "1-31380|/(auth)/otp|{ state: 'error2' }|8"

  # Sign-up
  "1-29108|/(auth)/sign-up|{ state: 'empty' }|8"
)

echo "=== Batch Screenshot Capture ==="
echo "Screens to process: ${#SCREENS[@]}"
echo "Screenshot dir: $SCREENSHOT_DIR"
echo "Skip existing: $SKIP_EXISTING"
echo "Dry run: $DRY_RUN"
echo ""

captured=0
skipped=0
failed=0

for entry in "${SCREENS[@]}"; do
  IFS='|' read -r figma_id route params extra_wait <<< "$entry"
  wait="${extra_wait:-$WAIT_TIME}"

  # Apply filter
  if [[ -n "$FILTER" ]] && [[ "$figma_id" != *"$FILTER"* ]] && [[ "$route" != *"$FILTER"* ]]; then
    continue
  fi

  screenshot_path="$SCREENSHOT_DIR/${figma_id}.png"

  # Skip if exists
  if [[ "$SKIP_EXISTING" == "true" ]] && [[ -f "$screenshot_path" ]]; then
    echo "SKIP $figma_id (exists)"
    skipped=$((skipped + 1))
    continue
  fi

  echo -n "CAPTURE $figma_id → $route [$params] ... "

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY RUN"
    continue
  fi

  # Step 1: Update index.tsx config
  update_screenshot_config "$route" "$params"

  # Step 2: Kill + relaunch
  xcrun simctl terminate booted "$APP_BUNDLE" 2>/dev/null || true
  sleep 2
  xcrun simctl launch booted "$APP_BUNDLE" > /dev/null 2>&1

  # Step 3: Wait for render
  sleep "$wait"

  # Step 4: Capture screenshot
  if xcrun simctl io booted screenshot "$screenshot_path" 2>/dev/null; then
    if file "$screenshot_path" | grep -q "PNG image data"; then
      size=$(stat -f%z "$screenshot_path")
      if [ "$size" -gt 60000 ]; then
        echo "OK ($(du -h "$screenshot_path" | cut -f1))"
        captured=$((captured + 1))
      else
        echo "ERROR SCREEN (${size}b) — removed"
        rm -f "$screenshot_path"
        failed=$((failed + 1))
      fi
    else
      echo "INVALID PNG"
      rm -f "$screenshot_path"
      failed=$((failed + 1))
    fi
  else
    echo "FAILED"
    failed=$((failed + 1))
  fi
done

# Restore index.tsx to null
update_screenshot_config "null" "null"

echo ""
echo "=== Summary ==="
echo "Captured: $captured"
echo "Skipped:  $skipped"
echo "Failed:   $failed"
echo "Total:    ${#SCREENS[@]}"
echo ""
echo "SCREENSHOT_TARGET/PARAMS reset to null in index.tsx"
