#!/bin/bash
# OTA Update — Production Channel
# Guarantees production env vars by hiding .env from Metro
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

MESSAGE="${1:-v2.2.0 production update}"

echo ">>> Killing Metro..."
pkill -f metro 2>/dev/null || true
sleep 1

echo ">>> Clearing Metro cache..."
rm -rf node_modules/.cache 2>/dev/null
rm -rf "$TMPDIR"/metro-* 2>/dev/null

echo ">>> Hiding .env..."
[ -f .env ] && mv .env .env._hidden

echo ">>> Sending OTA to production channel..."
EXPO_PUBLIC_SUPABASE_URL=https://api-secured.flent.in \
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_c80tL8IG3x46DQhLQ7WKfg_QUgIMI2x \
EXPO_PUBLIC_PAYMENT_GATEWAY=cashfree \
EXPO_PUBLIC_CASHFREE_ENV=PRODUCTION \
EXPO_PUBLIC_PAYU_KEY=PLycrf \
EXPO_PUBLIC_USE_OTP_ROUTING=true \
eas update --channel production --message "$MESSAGE" --non-interactive

echo ">>> Restoring .env..."
[ -f .env._hidden ] && mv .env._hidden .env

echo ">>> Done! OTA sent to production with verified production env vars."
