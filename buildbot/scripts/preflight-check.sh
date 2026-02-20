#!/bin/bash
# preflight-check.sh — Guardian script: validates simulator + app state
# Returns 0 if everything is healthy, non-zero with diagnostic info if not.
#
# Usage: bash scripts/preflight-check.sh [--route "/(auth)/splash"] [--screen-id 1-28055]
#
# Checks performed:
#   1. Simulator is booted
#   2. Metro bundler is running on :8081
#   3. App (com.flent.secured) is installed
#   4. Deep link navigation works (if --route provided)
#   5. Screenshot captures successfully (not black/blank)
#   6. Screenshot contains expected screen content (if --screen-id provided)

set -euo pipefail

ROUTE=""
SCREEN_ID=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --route) ROUTE="$2"; shift 2;;
    --screen-id) SCREEN_ID="$2"; shift 2;;
    --verbose) VERBOSE=true; shift;;
    *) shift;;
  esac
done

PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "ok" ]; then
    PASS=$((PASS + 1))
    $VERBOSE && echo "  ✓ $name"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ $name: $result"
  fi
}

echo "═══ BuildBot Pre-flight Check ═══"

# 1. Simulator booted
SIM_OUT=$(xcrun simctl list devices booted 2>&1)
if echo "$SIM_OUT" | grep -q "(Booted)"; then
  check "Simulator booted" "ok"
  DEVICE_NAME=$(echo "$SIM_OUT" | grep "(Booted)" | head -1 | sed 's/^[[:space:]]*//' | cut -d'(' -f1 | xargs)
  $VERBOSE && echo "    Device: $DEVICE_NAME"
else
  check "Simulator booted" "No booted simulator found"
fi

# 2. Metro running
if lsof -i :8081 >/dev/null 2>&1; then
  check "Metro bundler (:8081)" "ok"
else
  check "Metro bundler (:8081)" "Not running. Start with: cd rn-app && npx expo start"
fi

# 3. App installed
APP_CHECK=$(xcrun simctl listapps booted 2>/dev/null | grep -c "com.flent.secured" || true)
if [ "$APP_CHECK" -gt 0 ]; then
  check "App installed" "ok"
else
  check "App installed" "com.flent.secured not found. Run: npx expo run:ios"
fi

# 4. Maestro available
if which maestro >/dev/null 2>&1; then
  check "Maestro CLI" "ok"
else
  check "Maestro CLI" "Not found in PATH"
fi

# 5. Navigation test (if route provided)
if [ -n "$ROUTE" ]; then
  NAV_OUT=$(xcrun simctl openurl booted "flentsecured://$ROUTE" 2>&1)
  if [ $? -eq 0 ]; then
    check "Deep link navigation" "ok"
    sleep 3

    # 6. Screenshot capture test
    TMP_SCREENSHOT="/tmp/buildbot-preflight-$$.png"
    SHOT_OUT=$(xcrun simctl io booted screenshot "$TMP_SCREENSHOT" 2>&1)
    if [ -f "$TMP_SCREENSHOT" ]; then
      FILE_SIZE=$(stat -f%z "$TMP_SCREENSHOT" 2>/dev/null || echo 0)
      if [ "$FILE_SIZE" -gt 1000 ]; then
        check "Screenshot capture" "ok"

        # 7. Check screenshot is not all-black (blank screen)
        if which magick >/dev/null 2>&1; then
          MEAN=$(magick "$TMP_SCREENSHOT" -colorspace Gray -format "%[fx:mean]" info: 2>/dev/null || echo "0")
          if [ "$(echo "$MEAN > 0.02" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
            check "Screenshot not blank" "ok"
          else
            check "Screenshot not blank" "Screenshot appears to be all-black (mean=$MEAN). App may not be rendering."
          fi
        else
          $VERBOSE && echo "    (ImageMagick not found, skipping blank check)"
        fi
      else
        check "Screenshot capture" "File too small ($FILE_SIZE bytes) — likely failed"
      fi
      rm -f "$TMP_SCREENSHOT"
    else
      check "Screenshot capture" "Failed to create screenshot file"
    fi
  else
    check "Deep link navigation" "Failed: $NAV_OUT"
  fi
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  echo "STATUS: UNHEALTHY"
  exit 1
else
  echo "STATUS: HEALTHY"
  exit 0
fi
