#!/bin/bash
# Switch between dev and main environment
# Usage: ./switch-env.sh dev|main
#
# CRITICAL: Metro caches env vars. This script clears the cache
# so the new values take effect immediately.

set -e

ENV="${1:-}"

if [[ "$ENV" != "dev" && "$ENV" != "main" ]]; then
  echo "Usage: ./switch-env.sh dev|main"
  echo ""
  echo "  dev   → zqlowjveyqiagnbmfwsb (Supabase branch, SANDBOX)"
  echo "  main  → uowjtrzmszuaiokqxgir (Production, PRODUCTION)"
  echo ""
  echo "Current:"
  grep EXPO_PUBLIC_SUPABASE_URL .env 2>/dev/null || echo "  No .env found"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_FILE="$SCRIPT_DIR/.env.$ENV"
TARGET_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Error: $SOURCE_FILE not found"
  exit 1
fi

# Copy the env file
cp "$SOURCE_FILE" "$TARGET_FILE"
echo "Switched to $ENV environment"
grep EXPO_PUBLIC_SUPABASE_URL "$TARGET_FILE"

# Clear Metro cache (env vars are cached)
echo "Clearing Metro cache..."
rm -rf "$SCRIPT_DIR/node_modules/.cache/metro" 2>/dev/null || true
rm -rf /tmp/metro-* 2>/dev/null || true
rm -rf /tmp/haste-map-* 2>/dev/null || true

echo ""
echo "Done. Restart Expo: npx expo start --clear"
