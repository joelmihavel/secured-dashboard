#!/bin/bash
# Usage: autobot/verify/backend-test.sh <functionName>
# Runs Deno tests for the given Supabase edge function.
# If no test file exists, exits 0 (no tests yet).
# Exit 0 = pass, Exit 1 = fail.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FUNCTION_NAME="${1:-}"
if [[ -z "$FUNCTION_NAME" ]]; then
  echo "ERROR: Missing functionName argument"
  echo "Usage: $0 <functionName>"
  exit 1
fi

TEST_DIR="$PROJECT_ROOT/supabase/functions/_tests"
TEST_FILE=""

# Search for test file in multiple naming conventions
for CANDIDATE in \
  "${TEST_DIR}/${FUNCTION_NAME}.test.ts" \
  "${TEST_DIR}/${FUNCTION_NAME}-test.ts" \
  "${TEST_DIR}/test-${FUNCTION_NAME}.ts"; do
  if [[ -f "$CANDIDATE" ]]; then
    TEST_FILE="$CANDIDATE"
    break
  fi
done

if [[ -z "$TEST_FILE" ]]; then
  echo "INFO: No test file found for '$FUNCTION_NAME' — passing (no tests yet)"
  exit 0
fi

TEST_BASENAME="$(basename "$TEST_FILE")"
echo "Running tests: $TEST_FILE"
cd "$PROJECT_ROOT/supabase" && deno test --allow-all "functions/_tests/${TEST_BASENAME}"
exit $?
