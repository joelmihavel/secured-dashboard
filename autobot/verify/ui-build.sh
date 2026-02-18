#!/bin/bash
# Usage: autobot/verify/ui-build.sh <routeKey>
# Verifies that the screen file exists for the given route and TypeScript compiles cleanly.
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

SCREEN_ROUTES="$PROJECT_ROOT/buildbot/config/screen-routes.json"
if [[ ! -f "$SCREEN_ROUTES" ]]; then
  echo "ERROR: screen-routes.json not found at $SCREEN_ROUTES"
  exit 1
fi

# Extract the route path for the given route key
ROUTE_PATH=$(node -e "
  const data = JSON.parse(require('fs').readFileSync('$SCREEN_ROUTES','utf8'));
  const routes = data.routes || {};
  const route = routes['$ROUTE_KEY'];
  if (!route) { process.stderr.write('ROUTE_NOT_FOUND'); process.exit(1); }
  console.log(route.route);
" 2>&1)

if echo "$ROUTE_PATH" | grep -q "ROUTE_NOT_FOUND"; then
  echo "ERROR: Route key '$ROUTE_KEY' not found in screen-routes.json"
  exit 1
fi

# Map route to app file path
RELATIVE_PATH="${ROUTE_PATH#/}"
SCREEN_FILE="$PROJECT_ROOT/rn-app/app/${RELATIVE_PATH}.tsx"

# Also check for .ts extension and index.tsx variants
if [[ ! -f "$SCREEN_FILE" ]]; then
  SCREEN_FILE_TS="$PROJECT_ROOT/rn-app/app/${RELATIVE_PATH}.ts"
  SCREEN_FILE_INDEX="$PROJECT_ROOT/rn-app/app/${RELATIVE_PATH}/index.tsx"
  if [[ -f "$SCREEN_FILE_TS" ]]; then
    SCREEN_FILE="$SCREEN_FILE_TS"
  elif [[ -f "$SCREEN_FILE_INDEX" ]]; then
    SCREEN_FILE="$SCREEN_FILE_INDEX"
  else
    echo "FAIL: Screen file not found. Checked:"
    echo "  - $SCREEN_FILE"
    echo "  - $SCREEN_FILE_TS"
    echo "  - $SCREEN_FILE_INDEX"
    exit 1
  fi
fi

echo "OK: Screen file exists: $SCREEN_FILE"

# Run TypeScript compilation check
echo "Running TypeScript check..."
cd "$PROJECT_ROOT/rn-app" && npx tsc --noEmit
TSC_EXIT=$?

if [[ $TSC_EXIT -ne 0 ]]; then
  echo "FAIL: TypeScript compilation failed"
  exit $TSC_EXIT
fi

echo "RESULT: Build check passed for route '$ROUTE_KEY'"
exit 0
