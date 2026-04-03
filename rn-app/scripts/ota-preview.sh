#!/bin/bash
# OTA Update — Preview Channel (also uses production backend)
# Guarantees production env vars by hiding .env from Metro
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

MESSAGE="${1:-v2.2.0 preview update}"

# ── Safety check: preview OTA should go from dev branch ──
CURRENT_BRANCH=$(git -C "$APP_DIR/.." branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "dev" ]; then
  echo "❌ ERROR: Must be on 'dev' branch to push preview OTA (currently on '$CURRENT_BRANCH')"
  exit 1
fi

echo ">>> Branch: $CURRENT_BRANCH | Commit: $(git -C "$APP_DIR/.." rev-parse --short HEAD)"
echo ">>> Killing Metro..."
pkill -f metro 2>/dev/null || true
sleep 1

echo ">>> Clearing Metro cache..."
rm -rf node_modules/.cache 2>/dev/null
rm -rf "$TMPDIR"/metro-* 2>/dev/null

echo ">>> Hiding .env..."
[ -f .env ] && mv .env .env._hidden

echo ">>> Sending OTA to preview channel..."
EXPO_PUBLIC_SUPABASE_URL=https://api-secured.flent.in \
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_c80tL8IG3x46DQhLQ7WKfg_QUgIMI2x \
EXPO_PUBLIC_PAYMENT_GATEWAY=cashfree \
EXPO_PUBLIC_CASHFREE_ENV=PRODUCTION \
EXPO_PUBLIC_PAYU_KEY=PLycrf \
EXPO_PUBLIC_USE_OTP_ROUTING=true \
eas update --channel preview --message "$MESSAGE" --non-interactive

echo ">>> Restoring .env..."
[ -f .env._hidden ] && mv .env._hidden .env

echo ">>> Done! OTA sent to preview with verified production env vars."
