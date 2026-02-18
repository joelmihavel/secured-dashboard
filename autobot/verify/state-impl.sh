#!/bin/bash
# Usage: autobot/verify/state-impl.sh <name>
# Runs TypeScript compilation check for the rn-app project.
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

echo "Running TypeScript check for state '$NAME'..."
cd "$PROJECT_ROOT/rn-app" && npx tsc --noEmit
exit $?
