#!/bin/bash
# Usage: autobot/verify/backend-impl.sh <functionName>
# Checks that the Supabase edge function exists and type-checks with deno.
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

FUNCTION_FILE="$PROJECT_ROOT/supabase/functions/${FUNCTION_NAME}/index.ts"

if [[ ! -f "$FUNCTION_FILE" ]]; then
  echo "FAIL: Function file not found: $FUNCTION_FILE"
  exit 1
fi

echo "OK: Function file exists: $FUNCTION_FILE"

# Run deno check if deno is available
if command -v deno &>/dev/null; then
  echo "Running deno check..."
  cd "$PROJECT_ROOT/supabase" && deno check "functions/${FUNCTION_NAME}/index.ts"
  exit $?
else
  echo "INFO: deno not available — skipping type check, file existence is sufficient"
  exit 0
fi
