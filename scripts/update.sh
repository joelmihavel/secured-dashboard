#!/bin/bash
# Flent Secured — Safe OTA Update
# Clears Metro cache, verifies env vars, then pushes OTA.
# Usage: ./scripts/update.sh "your update message"

set -euo pipefail

cd "$(dirname "$0")/../rn-app"

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
  echo "Usage: ./scripts/update.sh \"update message\""
  exit 1
fi

# Detect git branch → channel
BRANCH=$(git -C .. rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
  CHANNEL="production"
  EXPECTED_URL="uowjtrzmszuaiokqxgir"
  printf "\033[33m%s\033[0m\n" "PRODUCTION OTA to channel: production"
  read -p "Are you sure? (y/N) " confirm
  [ "$confirm" != "y" ] && echo "Cancelled." && exit 1
elif [ "$BRANCH" = "dev" ]; then
  CHANNEL="preview"
  EXPECTED_URL="zqlowjveyqiagnbmfwsb"
  printf "\033[36m%s\033[0m\n" "Dev OTA to channel: preview"
else
  echo "Unknown branch: $BRANCH — update from 'dev' or 'main' only."
  exit 1
fi

# Step 1: Clear Metro cache + old dist
echo ""
echo "1/4 Clearing Metro cache and dist/..."
rm -rf dist/ node_modules/.cache/metro-* /tmp/metro-*

# Step 2: Export fresh bundle
echo "2/4 Exporting fresh bundle..."
npx expo export --platform ios --clear 2>&1 | grep -E "env:|Bundled"

# Step 3: Verify bundled URL matches expected environment
echo "3/4 Verifying bundled Supabase URL..."
BUNDLED_URL=$(strings dist/_expo/static/js/ios/*.hbc | grep -o "https://[a-z0-9]*\.supabase\.co" | sort -u | head -1)

if echo "$BUNDLED_URL" | grep -q "$EXPECTED_URL"; then
  printf "\033[32m%s\033[0m\n" "   URL verified: $BUNDLED_URL"
else
  printf "\033[31m%s\033[0m\n" "   WRONG URL in bundle: $BUNDLED_URL"
  printf "\033[31m%s\033[0m\n" "   Expected: $EXPECTED_URL"
  echo "   Metro cache was stale. Bundle has been rebuilt with correct URL."
  echo "   Run this script again."
  exit 1
fi

# Step 4: Push OTA
echo "4/4 Pushing OTA to channel: $CHANNEL..."
npx eas update --channel "$CHANNEL" --message "$MESSAGE" --non-interactive

echo ""
echo "Done. 2-restart cycle to apply on device."
