#!/bin/bash
# OTA Update — Production Channel
# Guarantees production env vars by hiding .env from Metro
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

MESSAGE="${1:-v2.2.0 production update}"

# ── Safety checks: prevent pushing stale/wrong code to production ──
CURRENT_BRANCH=$(git -C "$APP_DIR/.." branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ ERROR: Must be on 'main' branch to push production OTA (currently on '$CURRENT_BRANCH')"
  exit 1
fi

# Check for uncommitted changes in rn-app/ (the code that gets bundled)
if ! git -C "$APP_DIR/.." diff --quiet -- rn-app/; then
  echo "⚠️  WARNING: Uncommitted changes in rn-app/ — OTA will include unpushed code"
  echo "   Run 'git add && git commit && git push' first for traceability."
  read -p "   Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
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
