#!/bin/bash
# maestro-cloud.sh — Submit Maestro flows to Maestro Cloud
# Usage:
#   bash scripts/maestro-cloud.sh <flow-name-or-yaml-path>
#   Examples:
#     bash scripts/maestro-cloud.sh auth
#     bash scripts/maestro-cloud.sh flows/01-auth-e2e.yaml

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUTOBOT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILDBOT_ROOT="$(cd "$AUTOBOT_ROOT/../buildbot" && pwd)"
RN_APP_ROOT="$(cd "$AUTOBOT_ROOT/../rn-app" && pwd)"
REPORTS_DIR="$AUTOBOT_ROOT/reports/flow"

# Source env for MAESTRO_API_KEY
if [ -f "$BUILDBOT_ROOT/.env" ]; then
  set -a
  source "$BUILDBOT_ROOT/.env"
  set +a
fi

if [ -z "${MAESTRO_API_KEY:-}" ]; then
  echo "ERROR: MAESTRO_API_KEY not set. Add it to buildbot/.env"
  exit 1
fi

# Set JAVA_HOME (same as buildbot/scripts/maestro-run.sh)
if [ -d "/opt/homebrew/opt/openjdk@17" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
elif [ -d "/usr/local/opt/openjdk@17" ]; then
  export JAVA_HOME="/usr/local/opt/openjdk@17"
fi
export PATH="$JAVA_HOME/bin:$PATH"

INPUT="${1:-}"
if [ -z "$INPUT" ]; then
  echo "Usage: bash scripts/maestro-cloud.sh <flow-name-or-yaml-path>"
  echo "  flow-name: matches *-e2e.yaml in buildbot/data/flows/"
  echo "  yaml-path: direct path to a YAML file"
  exit 1
fi

# Resolve input to YAML path
YAML_PATH=""
FLOW_NAME=""

if [ -f "$INPUT" ]; then
  # Direct file path
  YAML_PATH="$INPUT"
  FLOW_NAME="$(basename "$INPUT" .yaml)"
elif [ -f "$BUILDBOT_ROOT/data/flows/$INPUT" ]; then
  YAML_PATH="$BUILDBOT_ROOT/data/flows/$INPUT"
  FLOW_NAME="$(basename "$INPUT" .yaml)"
elif [ -f "$RN_APP_ROOT/.maestro/$INPUT" ]; then
  YAML_PATH="$RN_APP_ROOT/.maestro/$INPUT"
  FLOW_NAME="$(basename "$INPUT" .yaml)"
else
  # Try matching flow name to *-e2e.yaml pattern
  MATCH=$(find "$BUILDBOT_ROOT/data/flows" "$RN_APP_ROOT/.maestro" -name "*${INPUT}*e2e*.yaml" -o -name "*${INPUT}*.yaml" 2>/dev/null | head -1)
  if [ -n "$MATCH" ]; then
    YAML_PATH="$MATCH"
    FLOW_NAME="$(basename "$MATCH" .yaml)"
  fi
fi

if [ -z "$YAML_PATH" ] || [ ! -f "$YAML_PATH" ]; then
  echo "ERROR: Could not resolve '$INPUT' to a Maestro YAML file"
  echo "Searched:"
  echo "  - Direct path: $INPUT"
  echo "  - buildbot/data/flows/$INPUT"
  echo "  - rn-app/.maestro/$INPUT"
  echo "  - Pattern match in flows/ and .maestro/ dirs"
  exit 1
fi

echo "=== Maestro Cloud Submission ==="
echo "Flow: $FLOW_NAME"
echo "YAML: $YAML_PATH"
echo ""

# Ensure reports dir exists
mkdir -p "$REPORTS_DIR"

# Run maestro cloud
OUTPUT_FILE="$REPORTS_DIR/${FLOW_NAME}-cloud.json"

echo "Submitting to Maestro Cloud..."
if maestro cloud --apiKey "$MAESTRO_API_KEY" "$YAML_PATH" 2>&1 | tee /tmp/maestro-cloud-output.txt; then
  STATUS="success"
else
  STATUS="failed"
fi

# Write result JSON
cat > "$OUTPUT_FILE" <<ENDJSON
{
  "flowName": "$FLOW_NAME",
  "yamlPath": "$YAML_PATH",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "$STATUS",
  "output": $(python3 -c "import json,sys; print(json.dumps(open('/tmp/maestro-cloud-output.txt').read()))" 2>/dev/null || echo '""')
}
ENDJSON

echo ""
echo "Result written to: $OUTPUT_FILE"
echo "Status: $STATUS"
