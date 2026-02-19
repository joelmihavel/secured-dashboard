#!/bin/bash
# BuildBot pipeline runner — sets full environment and runs verify-screen.ts
# Usage: ./scripts/run-pipeline.sh {figmaId} --route "{route}" [other args]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILDBOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env vars
if [ -f "$BUILDBOT_DIR/.env" ]; then
  export $(grep -v '^#' "$BUILDBOT_DIR/.env" | xargs)
fi

# Set Java 17 and Maestro in PATH
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:/Users/atrishabh/.maestro/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH

cd "$BUILDBOT_DIR"

# Extract figmaId from args for hierarchy capture
FIGMA_ID="$1"
HIERARCHY_DIR="$BUILDBOT_DIR/data/hierarchies"
mkdir -p "$HIERARCHY_DIR"
HIERARCHY_CSV="$HIERARCHY_DIR/${FIGMA_ID}-hierarchy.csv"

# Step: capture Maestro view hierarchy BEFORE running pipeline (screen must be on target)
# This runs AFTER warmup navigation has placed the app on the correct screen.
# The hierarchy is used by maestro-structural-verify.ts for structural checks.
capture_hierarchy() {
  local figma_id="$1"
  local csv_path="$HIERARCHY_DIR/${figma_id}-hierarchy.csv"

  # Use maestro hierarchy command if available (captures current screen state)
  if maestro --help 2>&1 | grep -q "hierarchy"; then
    maestro hierarchy --device "${SIMULATOR_UDID:-}" 2>/dev/null > "$csv_path" || true
  fi
}

# Run the main pipeline
npx tsx scripts/verify-screen.ts "$@"
EXIT_CODE=$?
exit $EXIT_CODE
