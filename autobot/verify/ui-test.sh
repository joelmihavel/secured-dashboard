#!/bin/bash
# Usage: autobot/verify/ui-test.sh <figmaStateId>
# Runs Jest tests for the screen containing the given Figma state ID.
# Looks up the route in screen-routes.json, derives the test file path.
# If no test file exists, exits 0 (passWithNoTests behavior).
# Exit 0 = pass, Exit 1 = fail.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ROUTE_KEY="${1:-}"
if [[ -z "$ROUTE_KEY" ]]; then
  echo "ERROR: Missing figmaStateId argument"
  echo "Usage: $0 <figmaStateId>"
  exit 1
fi

SCREEN_ROUTES="$PROJECT_ROOT/buildbot/config/screen-routes.json"

# Look up the app route — first by figmaId, then by route key name
ROUTE=$(node -e "
const r = JSON.parse(require('fs').readFileSync('$SCREEN_ROUTES', 'utf8'));
// Try matching by figmaId first
for (const val of Object.values(r.routes)) {
  if (val.screens && val.screens.some(s => s.figmaId === '$ROUTE_KEY')) {
    console.log(val.route);
    process.exit(0);
  }
}
// Fall back to matching by route key name (e.g. 'profile', 'waitlist')
if (r.routes['$ROUTE_KEY']) {
  console.log(r.routes['$ROUTE_KEY'].route);
  process.exit(0);
}
" 2>/dev/null || true)

if [[ -z "$ROUTE" ]]; then
  echo "INFO: No route mapping found for '$ROUTE_KEY' — passing (no tests)"
  exit 0
fi

# Derive test file from route:
#   /(group)/filename -> app/(group)/__tests__/filename.test.tsx
#   /(group)          -> app/(group)/__tests__/index.test.tsx
# Strip leading /
ROUTE_STRIPPED="${ROUTE#/}"
ROUTE_GROUP=$(echo "$ROUTE_STRIPPED" | cut -d'/' -f1)
ROUTE_FILE_RAW=$(echo "$ROUTE_STRIPPED" | cut -d'/' -f2 2>/dev/null || echo "")

# If no second segment (e.g. "(waitlist)"), use "index"
if [[ -z "$ROUTE_FILE_RAW" ]] || [[ "$ROUTE_FILE_RAW" == "$ROUTE_GROUP" ]]; then
  ROUTE_FILE="index"
else
  ROUTE_FILE="$ROUTE_FILE_RAW"
fi

TEST_FILE="$PROJECT_ROOT/rn-app/app/$ROUTE_GROUP/__tests__/$ROUTE_FILE.test.tsx"

if [[ ! -f "$TEST_FILE" ]]; then
  echo "INFO: No test file found at $TEST_FILE — passing (no tests)"
  exit 0
fi

# Escape parentheses for Jest regex matching
TEST_PATTERN=$(echo "$TEST_FILE" | sed 's/(/\\(/g; s/)/\\)/g')
echo "Running tests: $TEST_FILE"
cd "$PROJECT_ROOT/rn-app" && npx jest --testPathPattern="$TEST_PATTERN" --passWithNoTests --forceExit
exit $?
