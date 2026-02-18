#!/bin/bash
# Usage: autobot/verify/state-test.sh <name>
# Runs Jest tests for the given state/hook/component by name.
# Searches multiple test file locations. If no test file found, exits 0.
# Exit 0 = pass, Exit 1 = fail.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "ERROR: Missing name argument"
  echo "Usage: $0 <name>"
  exit 1
fi

RN_APP="$PROJECT_ROOT/rn-app"
TEST_FILE=""

# Search for test file in multiple locations and extensions
for CANDIDATE in \
  "${RN_APP}/src/stores/__tests__/${NAME}.test.ts" \
  "${RN_APP}/src/stores/__tests__/${NAME}.test.tsx" \
  "${RN_APP}/src/hooks/__tests__/${NAME}.test.ts" \
  "${RN_APP}/src/hooks/__tests__/${NAME}.test.tsx" \
  "${RN_APP}/src/components/__tests__/${NAME}.test.tsx"; do
  if [[ -f "$CANDIDATE" ]]; then
    TEST_FILE="$CANDIDATE"
    break
  fi
done

if [[ -z "$TEST_FILE" ]]; then
  echo "INFO: No test file found for '$NAME' — passing (no tests yet)"
  exit 0
fi

echo "Running tests: $TEST_FILE"
cd "$RN_APP" && npx jest "$TEST_FILE" --passWithNoTests
exit $?
