#!/bin/bash
# Usage: autobot/verify/ui-extract.sh <routeKey>
# Verifies that Figma blueprints and baseline assets exist for the given route key.
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

# Extract all figmaIds for the given route key
FIGMA_IDS=$(node -e "
  const data = JSON.parse(require('fs').readFileSync('$SCREEN_ROUTES','utf8'));
  const routes = data.routes || {};
  const route = routes['$ROUTE_KEY'];
  if (!route) { process.stderr.write('ROUTE_NOT_FOUND'); process.exit(1); }
  (route.screens || []).forEach(s => console.log(s.figmaId));
" 2>&1)

if echo "$FIGMA_IDS" | grep -q "ROUTE_NOT_FOUND"; then
  echo "ERROR: Route key '$ROUTE_KEY' not found in screen-routes.json"
  exit 1
fi

ERRORS=0

for FIGMA_ID in $FIGMA_IDS; do
  # Normalize figmaId: replace colon with dash (e.g., 1:28053 -> 1-28053)
  NORMALIZED_ID="${FIGMA_ID//:/-}"

  # Check blueprint exists
  BLUEPRINT="$PROJECT_ROOT/buildbot/data/blueprints/${NORMALIZED_ID}-blueprint.json"
  if [[ ! -f "$BLUEPRINT" ]]; then
    echo "FAIL: Blueprint not found: $BLUEPRINT"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Validate blueprint JSON is parseable and has nodes
  VALID=$(node -e "
    const data = JSON.parse(require('fs').readFileSync('$BLUEPRINT','utf8'));
    const nodes = data.nodes || data.componentTree || [];
    if (Array.isArray(nodes) && nodes.length > 0) { console.log('ok'); }
    else { console.log('empty'); }
  " 2>&1)

  if [[ "$VALID" != "ok" ]]; then
    echo "FAIL: Blueprint invalid for $NORMALIZED_ID: $VALID"
    ERRORS=$((ERRORS + 1))
  else
    echo "OK: Blueprint valid: $NORMALIZED_ID"
  fi

  # Check baseline PNGs exist for this figmaId in assets dir
  ASSET_DIR="$PROJECT_ROOT/buildbot/data/assets"
  ASSET_COUNT=$(find "$ASSET_DIR" -name "${NORMALIZED_ID}_*" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$ASSET_COUNT" -eq 0 ]]; then
    echo "WARN: No baseline assets found for $NORMALIZED_ID in $ASSET_DIR"
  else
    echo "OK: Found $ASSET_COUNT asset(s) for $NORMALIZED_ID"
  fi
done

if [[ "$ERRORS" -gt 0 ]]; then
  echo "RESULT: $ERRORS error(s) found for route '$ROUTE_KEY'"
  exit 1
fi

echo "RESULT: All extraction checks passed for route '$ROUTE_KEY'"
exit 0
