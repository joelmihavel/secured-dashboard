#!/bin/bash
# Reset a test user: cleanup + re-seed
# Usage: ./scripts/reset-user.sh <state> <phone> [seed options...]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE=${1:?"Usage: $0 <state> <phone> [options]"}
PHONE=${2:?"Usage: $0 <state> <phone> [options]"}

echo "=== Reset Test User ==="
echo "  Phone: $PHONE"
echo "  Target State: $STATE"
echo ""

echo "--- Step 1: Cleanup ---"
"$SCRIPT_DIR/cleanup-user.sh" "$PHONE" || true
echo ""

echo "--- Step 2: Seed ---"
"$SCRIPT_DIR/seed-state.sh" "$@"
