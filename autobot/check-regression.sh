#!/bin/bash
set -uo pipefail

# check-regression.sh — Verifies all previously-passing UI screens still pass
# Usage: bash autobot/check-regression.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Running regression check on passing UI screens..."

# Get all passing UI verify stories
PASSING=$(node -e "
const prd = JSON.parse(require('fs').readFileSync('autobot/prd.json','utf8'));
const passing = prd.stories.filter(s => s.passes && s.track === 'ui' && s.verify);
passing.forEach(s => console.log(s.verify));
" 2>/dev/null)

if [ -z "$PASSING" ]; then
  echo "No passing UI stories to check. Regression check passes."
  exit 0
fi

TOTAL=0
FAILED=0
while IFS= read -r cmd; do
  TOTAL=$((TOTAL + 1))
  echo "  Running: $cmd"
  if ! eval "$cmd" >/dev/null 2>&1; then
    echo "  FAIL REGRESSION: $cmd"
    FAILED=$((FAILED + 1))
  else
    echo "  Pass"
  fi
done <<< "$PASSING"

echo ""
echo "Regression check: $((TOTAL - FAILED))/$TOTAL passed"

if [ $FAILED -gt 0 ]; then
  echo "REGRESSION DETECTED — $FAILED screen(s) regressed"
  exit 1
fi

echo "All passing screens still pass."
exit 0
