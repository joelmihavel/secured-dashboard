#!/bin/bash
# Usage: autobot/verify/ui-verify.sh <routeKey>
# Runs the BuildBot verify-screen script for the given route key.
# Exit 0 = pass, Exit 1 = fail.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ROUTE_KEY="${1:-}"
if [[ -z "$ROUTE_KEY" ]]; then
  echo "ERROR: Missing routeKey argument"
  echo "Usage: $0 <routeKey>"
  exit 1
fi

echo "Running verify-screen for '$ROUTE_KEY'..."
cd "$PROJECT_ROOT/buildbot" && npx tsx scripts/verify-screen.ts --screen "$ROUTE_KEY"
exit $?
