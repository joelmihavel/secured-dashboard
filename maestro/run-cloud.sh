#!/usr/bin/env bash
# =============================================================================
# TE-122: Maestro Cloud Pipeline Runner
#
# Triggers Maestro Cloud test runs for the Flent Secured app.
# Supports both iOS (.app/.ipa) and Android (.apk) binaries.
#
# Usage:
#   ./maestro/run-cloud.sh                         # Auto-detect binary, default profile
#   ./maestro/run-cloud.sh path/to/app.ipa         # Explicit binary path
#   ./maestro/run-cloud.sh --local                 # Run locally (not cloud)
#   ./maestro/run-cloud.sh --flows-only            # Run screen flows only
#   ./maestro/run-cloud.sh --journeys-only         # Run journey flows only
#   ./maestro/run-cloud.sh --profile smoke         # Run smoke profile (P0 only)
#   ./maestro/run-cloud.sh --profile regression    # Run full regression
#   ./maestro/run-cloud.sh --profile nightly       # Run nightly with video
#   ./maestro/run-cloud.sh --shard                 # Enable test sharding
#   ./maestro/run-cloud.sh --notify slack          # Send results to Slack
#   ./maestro/run-cloud.sh --session-id ABC123     # Link to orchestrator session
#
# Environment variables:
#   MAESTRO_CLOUD_API_KEY  - API key for Maestro Cloud (required for cloud)
#   APP_BINARY             - Path to app binary (optional, auto-detected)
#   MAESTRO_TIMEOUT        - Per-flow timeout in seconds (default: 120)
#   SLACK_WEBHOOK_URL      - Slack webhook for notifications
#   ARTIFACT_DIR           - Where to download artifacts (default: ./maestro-artifacts)
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#   2 - Configuration or setup error
# =============================================================================

set -euo pipefail

# -- Configuration --
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RN_APP_DIR="$PROJECT_ROOT/rn-app"
MAESTRO_DIR="$SCRIPT_DIR"
FLOW_DIR="$MAESTRO_DIR/flows"
JOURNEY_DIR="$MAESTRO_DIR/journeys"
PROFILE_DIR="$MAESTRO_DIR/profiles"
APP_ID="com.flent.secured"
TIMEOUT="${MAESTRO_TIMEOUT:-120}"
ARTIFACT_DIR="${ARTIFACT_DIR:-$MAESTRO_DIR/artifacts}"
NOTIFY_SCRIPT="$PROJECT_ROOT/test-infrastructure/orchestrator/notify.sh"

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[CLOUD]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[CLOUD]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[CLOUD]${NC} $*"; }
log_error() { echo -e "${RED}[CLOUD]${NC} $*"; }

# -- Parse arguments --
MODE="cloud"
FLOW_SCOPE="all"
APP_BINARY="${APP_BINARY:-}"
PROFILE=""
SHARD_ENABLED=false
NOTIFY_TARGET=""
SESSION_ID=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)
      MODE="local"
      shift
      ;;
    --flows-only)
      FLOW_SCOPE="flows"
      shift
      ;;
    --journeys-only)
      FLOW_SCOPE="journeys"
      shift
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --shard)
      SHARD_ENABLED=true
      shift
      ;;
    --notify)
      NOTIFY_TARGET="$2"
      shift 2
      ;;
    --session-id)
      SESSION_ID="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [app-binary] [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --local             Run tests locally instead of Maestro Cloud"
      echo "  --flows-only        Run only screen-level functional flows"
      echo "  --journeys-only     Run only end-to-end journey flows"
      echo "  --profile PROFILE   Load profile config: smoke, regression, nightly"
      echo "  --shard             Enable test sharding across multiple devices"
      echo "  --notify TARGET     Send results via notification: slack, webhook, stdout"
      echo "  --session-id ID     Link run to orchestrator session for reporting"
      echo "  --verbose           Verbose output"
      echo "  --help              Show this help message"
      echo ""
      echo "Environment variables:"
      echo "  MAESTRO_CLOUD_API_KEY  API key for Maestro Cloud"
      echo "  APP_BINARY             Path to app binary"
      echo "  MAESTRO_TIMEOUT        Per-flow timeout (default: 120s)"
      echo "  SLACK_WEBHOOK_URL      Slack webhook URL for --notify slack"
      echo "  ARTIFACT_DIR           Artifact download directory"
      exit 0
      ;;
    *)
      # Treat as app binary path if it looks like a file
      if [[ -f "$1" ]]; then
        APP_BINARY="$1"
      else
        log_warn "Unknown argument or file not found: $1"
      fi
      shift
      ;;
  esac
done

# -- Banner --
echo ""
echo -e "${BOLD}${MAGENTA}"
echo "  ================================================================"
echo "   Maestro Cloud Pipeline Runner"
echo "  ================================================================"
echo -e "${NC}"
echo -e "  ${DIM}Mode:    $MODE${NC}"
echo -e "  ${DIM}Profile: ${PROFILE:-default}${NC}"
echo -e "  ${DIM}Scope:   $FLOW_SCOPE${NC}"
echo -e "  ${DIM}Shard:   $SHARD_ENABLED${NC}"
[[ -n "$SESSION_ID" ]] && echo -e "  ${DIM}Session: $SESSION_ID${NC}"
echo ""

# -- Load profile configuration --
PROFILE_TIMEOUT=""
PROFILE_RETRIES=""
PROFILE_CONTINUE_ON_FAILURE=""
declare -a PROFILE_FLOWS=()

if [[ -n "$PROFILE" ]]; then
  PROFILE_FILE="$PROFILE_DIR/${PROFILE}.yaml"

  if [[ ! -f "$PROFILE_FILE" ]]; then
    log_error "Profile not found: $PROFILE_FILE"
    log_info "Available profiles:"
    for pf in "$PROFILE_DIR"/*.yaml; do
      if [[ -f "$pf" ]]; then
        echo "  - $(basename "$pf" .yaml)"
      fi
    done
    exit 2
  fi

  log_info "Loading profile: $PROFILE ($PROFILE_FILE)"

  # Parse profile YAML using python3 (available on macOS and CI)
  PROFILE_TIMEOUT=$(python3 -c "
import re
with open('$PROFILE_FILE') as f:
    content = f.read()
m = re.search(r'^timeout:\s*(\d+)', content, re.MULTILINE)
print(m.group(1) if m else '')
" 2>/dev/null || echo "")

  PROFILE_RETRIES=$(python3 -c "
import re
with open('$PROFILE_FILE') as f:
    content = f.read()
m = re.search(r'maxRetries:\s*(\d+)', content)
print(m.group(1) if m else '')
" 2>/dev/null || echo "")

  PROFILE_CONTINUE_ON_FAILURE=$(python3 -c "
import re
with open('$PROFILE_FILE') as f:
    content = f.read()
m = re.search(r'continueOnFailure:\s*(true|false)', content)
print(m.group(1) if m else '')
" 2>/dev/null || echo "")

  # Parse flow list from profile
  mapfile -t PROFILE_FLOWS < <(python3 -c "
import re
with open('$PROFILE_FILE') as f:
    content = f.read()
in_flows = False
for line in content.split('\n'):
    stripped = line.strip()
    if stripped == 'flows:':
        in_flows = True
        continue
    if in_flows:
        if stripped.startswith('- '):
            flow = stripped[2:].strip().strip('\"').strip(\"'\")
            print(flow)
        elif stripped and not stripped.startswith('#'):
            break
" 2>/dev/null || true)

  # Apply profile overrides
  if [[ -n "$PROFILE_TIMEOUT" ]]; then
    TIMEOUT="$PROFILE_TIMEOUT"
    log_info "Profile timeout: ${TIMEOUT}s"
  fi

  if [[ -n "$PROFILE_RETRIES" ]]; then
    log_info "Profile max retries: $PROFILE_RETRIES"
  fi

  if [[ ${#PROFILE_FLOWS[@]} -gt 0 ]]; then
    log_info "Profile specifies ${#PROFILE_FLOWS[@]} flows"
    # Override scope when profile specifies explicit flows
    FLOW_SCOPE="profile"
  fi
fi

# -- Check prerequisites --
log_info "Checking prerequisites..."

if ! command -v maestro &> /dev/null; then
  log_error "Maestro CLI not found."
  log_info "Install with: curl -Ls 'https://get.maestro.mobile.dev' | bash"
  log_info ""
  log_info "Common fixes:"
  log_info "  - macOS: brew install maestro"
  log_info "  - CI: Add maestro setup step to workflow"
  log_info "  - PATH: Ensure ~/.maestro/bin is in PATH"
  exit 2
fi

MAESTRO_VERSION=$(maestro --version 2>/dev/null || echo "unknown")
log_info "Maestro CLI version: $MAESTRO_VERSION"

# -- Auto-detect app binary --
if [[ -z "$APP_BINARY" ]]; then
  log_info "Auto-detecting app binary..."

  # Check for iOS simulator build
  IOS_BUILD_DIR="$RN_APP_DIR/ios/build/Build/Products/Debug-iphonesimulator"
  if [[ -d "$IOS_BUILD_DIR/FlentSecured.app" ]]; then
    APP_BINARY="$IOS_BUILD_DIR/FlentSecured.app"
    log_ok "Found iOS simulator build: $APP_BINARY"
  fi

  # Check for EAS build artifacts
  if [[ -z "$APP_BINARY" ]]; then
    # Look for .ipa or .apk in common locations
    for ext in ipa apk; do
      FOUND=$(find "$RN_APP_DIR" -maxdepth 3 -name "*.$ext" -type f 2>/dev/null | head -1)
      if [[ -n "$FOUND" ]]; then
        APP_BINARY="$FOUND"
        log_ok "Found build artifact: $APP_BINARY"
        break
      fi
    done
  fi

  # Check for EAS build output directory
  if [[ -z "$APP_BINARY" ]]; then
    EAS_BUILD_DIR="$RN_APP_DIR/build"
    if [[ -d "$EAS_BUILD_DIR" ]]; then
      FOUND=$(find "$EAS_BUILD_DIR" -name "*.app" -o -name "*.ipa" -o -name "*.apk" 2>/dev/null | head -1)
      if [[ -n "$FOUND" ]]; then
        APP_BINARY="$FOUND"
        log_ok "Found EAS build artifact: $APP_BINARY"
      fi
    fi
  fi
fi

# -- Determine which flows to run --
declare -a TEST_DIRS=()
declare -a EXPLICIT_FLOWS=()

case "$FLOW_SCOPE" in
  flows)
    TEST_DIRS=("$FLOW_DIR")
    log_info "Running screen-level functional flows only"
    ;;
  journeys)
    TEST_DIRS=("$JOURNEY_DIR")
    log_info "Running end-to-end journey flows only"
    ;;
  profile)
    # Use flows from the loaded profile
    for flow in "${PROFILE_FLOWS[@]}"; do
      FULL_PATH="$MAESTRO_DIR/$flow"
      if [[ -f "$FULL_PATH" ]]; then
        EXPLICIT_FLOWS+=("$FULL_PATH")
      else
        log_warn "Profile flow not found: $flow"
      fi
    done
    log_info "Running ${#EXPLICIT_FLOWS[@]} flows from profile: $PROFILE"
    ;;
  all)
    TEST_DIRS=("$FLOW_DIR" "$JOURNEY_DIR")
    log_info "Running all flows (screens + journeys)"
    ;;
esac

# -- Count flows --
TOTAL_FLOWS=0
if [[ ${#EXPLICIT_FLOWS[@]} -gt 0 ]]; then
  TOTAL_FLOWS=${#EXPLICIT_FLOWS[@]}
else
  for dir in "${TEST_DIRS[@]}"; do
    COUNT=$(find "$dir" -name "*.yaml" -type f 2>/dev/null | wc -l | tr -d ' ')
    TOTAL_FLOWS=$((TOTAL_FLOWS + COUNT))
  done
fi
log_info "Total flows to execute: $TOTAL_FLOWS"

# -- Setup artifact directory --
RUN_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_ARTIFACT_DIR="$ARTIFACT_DIR/$RUN_TIMESTAMP"
mkdir -p "$RUN_ARTIFACT_DIR"

# -- Execute tests --
START_TIME=$(date +%s)

if [[ "$MODE" == "local" ]]; then
  # ==========================================
  # LOCAL EXECUTION
  # ==========================================
  log_info "Running Maestro tests locally..."

  PASS=0
  FAIL=0
  SKIP=0
  declare -a ERRORS=()
  declare -a RESULTS=()

  # Build flow list
  declare -a ALL_FLOWS=()
  if [[ ${#EXPLICIT_FLOWS[@]} -gt 0 ]]; then
    ALL_FLOWS=("${EXPLICIT_FLOWS[@]}")
  else
    for dir in "${TEST_DIRS[@]}"; do
      while IFS= read -r flow; do
        ALL_FLOWS+=("$flow")
      done < <(find "$dir" -name "*.yaml" -type f | sort)
    done
  fi

  for flow in "${ALL_FLOWS[@]}"; do
    FLOW_NAME=$(basename "$flow" .yaml)
    FLOW_REL=$(echo "$flow" | sed "s|$MAESTRO_DIR/||")
    log_info "Running: $FLOW_REL"

    FLOW_START=$(date +%s)
    RETRIES=0
    MAX_LOCAL_RETRIES="${PROFILE_RETRIES:-0}"
    FLOW_PASSED=false

    while [[ $RETRIES -le $MAX_LOCAL_RETRIES ]]; do
      if [[ $RETRIES -gt 0 ]]; then
        log_warn "Retrying ($RETRIES/$MAX_LOCAL_RETRIES): $FLOW_REL"
      fi

      if maestro test "$flow" \
        --env APP_ID="$APP_ID" \
        --env TEST_PHONE="9876543210" \
        --env TEST_NAME="Test User" \
        --env TEST_OTP="123456" \
        --env CI="true" 2>&1; then
        FLOW_PASSED=true
        break
      fi

      RETRIES=$((RETRIES + 1))
    done

    FLOW_END=$(date +%s)
    FLOW_DURATION=$((FLOW_END - FLOW_START))

    if [[ "$FLOW_PASSED" == "true" ]]; then
      log_ok "PASS: $FLOW_REL (${FLOW_DURATION}s)"
      PASS=$((PASS + 1))
      RESULTS+=("{\"flow\":\"$FLOW_REL\",\"status\":\"pass\",\"duration\":$FLOW_DURATION,\"retries\":$RETRIES}")
    else
      log_error "FAIL: $FLOW_REL (${FLOW_DURATION}s, retries=$RETRIES)"
      FAIL=$((FAIL + 1))
      ERRORS+=("$FLOW_REL")
      RESULTS+=("{\"flow\":\"$FLOW_REL\",\"status\":\"fail\",\"duration\":$FLOW_DURATION,\"retries\":$RETRIES}")

      # Stop early if profile says so
      if [[ "$PROFILE_CONTINUE_ON_FAILURE" == "false" ]]; then
        log_warn "Stopping early (continueOnFailure=false)"
        SKIP=$((TOTAL_FLOWS - PASS - FAIL))
        break
      fi
    fi
  done

  END_TIME=$(date +%s)
  TOTAL_DURATION=$((END_TIME - START_TIME))

  # -- Write results JSON --
  RESULTS_FILE="$RUN_ARTIFACT_DIR/results.json"
  python3 -c "
import json
results = [${RESULTS:+$(IFS=,; echo "${RESULTS[*]}")}]
summary = {
    'session_id': '${SESSION_ID:-local-$RUN_TIMESTAMP}',
    'profile': '${PROFILE:-default}',
    'mode': 'local',
    'timestamp': '$(date -u +"%Y-%m-%dT%H:%M:%SZ")',
    'duration_seconds': $TOTAL_DURATION,
    'total_flows': $TOTAL_FLOWS,
    'passed': $PASS,
    'failed': $FAIL,
    'skipped': $SKIP,
    'pass_rate': round(($PASS / max($TOTAL_FLOWS, 1)) * 100, 2),
    'status': 'pass' if $FAIL == 0 else 'fail',
    'flows': results
}
print(json.dumps(summary, indent=2))
" > "$RESULTS_FILE" 2>/dev/null || true

  # -- Results summary --
  echo ""
  echo -e "${BOLD}${MAGENTA}"
  echo "  ============================================"
  echo "   Maestro E2E Test Results"
  echo "  ============================================"
  echo -e "${NC}"
  echo -e "  Mode:     local"
  echo -e "  Profile:  ${PROFILE:-default}"
  echo -e "  Duration: ${TOTAL_DURATION}s"
  echo ""
  echo -e "  Total:    $TOTAL_FLOWS"
  echo -e "  Passed:   ${GREEN}$PASS${NC}"
  echo -e "  Failed:   ${RED}$FAIL${NC}"
  [[ $SKIP -gt 0 ]] && echo -e "  Skipped:  ${YELLOW}$SKIP${NC}"
  echo ""

  if [[ ${#ERRORS[@]} -gt 0 ]]; then
    log_error "Failed flows:"
    for err in "${ERRORS[@]}"; do
      echo "    - $err"
    done
    echo ""
  fi

  log_info "Results: $RESULTS_FILE"
  log_info "Artifacts: $RUN_ARTIFACT_DIR"

  # -- Send notifications --
  if [[ -n "$NOTIFY_TARGET" && -x "$NOTIFY_SCRIPT" ]]; then
    log_info "Sending notification to: $NOTIFY_TARGET"
    "$NOTIFY_SCRIPT" --target "$NOTIFY_TARGET" --results "$RESULTS_FILE" || {
      log_warn "Notification delivery failed (non-blocking)"
    }
  fi

  if [[ $FAIL -gt 0 ]]; then
    exit 1
  fi

  log_ok "All Maestro E2E tests passed."
  exit 0

else
  # ==========================================
  # MAESTRO CLOUD EXECUTION
  # ==========================================
  if [[ -z "${MAESTRO_CLOUD_API_KEY:-}" ]]; then
    log_error "MAESTRO_CLOUD_API_KEY is not set. Required for cloud execution."
    echo ""
    log_info "How to fix:"
    log_info "  1. Sign up at https://cloud.mobile.dev/"
    log_info "  2. Generate an API key in your dashboard"
    log_info "  3. Export it: export MAESTRO_CLOUD_API_KEY=your_key_here"
    log_info "  4. For CI: Add MAESTRO_CLOUD_API_KEY as a GitHub Actions secret"
    echo ""
    log_info "Or run locally with: $0 --local"
    exit 2
  fi

  if [[ -z "$APP_BINARY" ]]; then
    log_error "No app binary found."
    echo ""
    log_info "How to fix:"
    log_info "  1. Build locally:  cd rn-app && npx expo run:ios"
    log_info "  2. Build with EAS: cd rn-app && eas build --platform ios --profile preview"
    log_info "  3. Set manually:   APP_BINARY=/path/to/app $0"
    echo ""
    log_info "Supported formats: .app (simulator), .ipa (device), .apk (Android)"
    exit 2
  fi

  log_info "Uploading to Maestro Cloud..."
  log_info "App binary: $APP_BINARY"

  # Build the flow arguments
  FLOW_ARGS=""
  if [[ ${#EXPLICIT_FLOWS[@]} -gt 0 ]]; then
    for flow in "${EXPLICIT_FLOWS[@]}"; do
      FLOW_ARGS="$FLOW_ARGS $flow"
    done
  else
    for dir in "${TEST_DIRS[@]}"; do
      FLOW_ARGS="$FLOW_ARGS $dir"
    done
  fi

  # Build cloud command arguments
  declare -a CLOUD_ARGS=()
  CLOUD_ARGS+=("--apiKey" "$MAESTRO_CLOUD_API_KEY")
  CLOUD_ARGS+=("--app-file" "$APP_BINARY")
  CLOUD_ARGS+=("--timeout" "$TIMEOUT")
  CLOUD_ARGS+=("--env" "APP_ID=$APP_ID")
  CLOUD_ARGS+=("--env" "TEST_PHONE=9876543210")
  CLOUD_ARGS+=("--env" "TEST_NAME=Test User")
  CLOUD_ARGS+=("--env" "TEST_OTP=123456")
  CLOUD_ARGS+=("--env" "CI=true")

  # Add profile name as env var for flow-level branching
  if [[ -n "$PROFILE" ]]; then
    CLOUD_ARGS+=("--env" "MAESTRO_PROFILE=$PROFILE")
    CLOUD_ARGS+=("--name" "Flent Secured - ${PROFILE^} ($RUN_TIMESTAMP)")
  else
    CLOUD_ARGS+=("--name" "Flent Secured - CI ($RUN_TIMESTAMP)")
  fi

  # Shard configuration
  if [[ "$SHARD_ENABLED" == "true" ]]; then
    log_info "Test sharding enabled -- flows will be distributed across devices"
    CLOUD_ARGS+=("--shard" "all")
  fi

  # Retry configuration from profile
  if [[ -n "$PROFILE_RETRIES" && "$PROFILE_RETRIES" != "0" ]]; then
    CLOUD_ARGS+=("--retries" "$PROFILE_RETRIES")
  fi

  # Capture cloud output for parsing
  CLOUD_OUTPUT_FILE="$RUN_ARTIFACT_DIR/cloud-output.log"

  log_info "Executing: maestro cloud ${CLOUD_ARGS[*]} $FLOW_ARGS"
  echo ""

  # Execute on Maestro Cloud, capturing output
  set +e
  maestro cloud "${CLOUD_ARGS[@]}" $FLOW_ARGS 2>&1 | tee "$CLOUD_OUTPUT_FILE"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  END_TIME=$(date +%s)
  TOTAL_DURATION=$((END_TIME - START_TIME))

  # -- Parse cloud output for results --
  CLOUD_RUN_URL=""
  CLOUD_PASSED=0
  CLOUD_FAILED=0

  if [[ -f "$CLOUD_OUTPUT_FILE" ]]; then
    # Extract run URL from cloud output
    CLOUD_RUN_URL=$(grep -oE 'https://cloud\.mobile\.dev/[^ ]+' "$CLOUD_OUTPUT_FILE" 2>/dev/null | head -1 || echo "")

    # Attempt to parse pass/fail counts from output
    CLOUD_PASSED=$(grep -cE '(PASSED|passed|Pass)' "$CLOUD_OUTPUT_FILE" 2>/dev/null || echo "0")
    CLOUD_FAILED=$(grep -cE '(FAILED|failed|Fail)' "$CLOUD_OUTPUT_FILE" 2>/dev/null || echo "0")
  fi

  # -- Download artifacts --
  log_info "Collecting artifacts to: $RUN_ARTIFACT_DIR"

  # Copy cloud output log
  if [[ -f "$CLOUD_OUTPUT_FILE" ]]; then
    log_ok "Cloud output log: $CLOUD_OUTPUT_FILE"
  fi

  # -- Write results JSON --
  RESULTS_FILE="$RUN_ARTIFACT_DIR/results.json"
  python3 -c "
import json
summary = {
    'session_id': '${SESSION_ID:-cloud-$RUN_TIMESTAMP}',
    'profile': '${PROFILE:-default}',
    'mode': 'cloud',
    'timestamp': '$(date -u +"%Y-%m-%dT%H:%M:%SZ")',
    'duration_seconds': $TOTAL_DURATION,
    'total_flows': $TOTAL_FLOWS,
    'passed': $CLOUD_PASSED,
    'failed': $CLOUD_FAILED,
    'pass_rate': round(($CLOUD_PASSED / max($TOTAL_FLOWS, 1)) * 100, 2),
    'status': 'pass' if $EXIT_CODE == 0 else 'fail',
    'exit_code': $EXIT_CODE,
    'cloud_run_url': '${CLOUD_RUN_URL}',
    'shard_enabled': $([ "$SHARD_ENABLED" == "true" ] && echo "true" || echo "false"),
    'artifact_dir': '$RUN_ARTIFACT_DIR'
}
print(json.dumps(summary, indent=2))
" > "$RESULTS_FILE" 2>/dev/null || true

  # -- Results summary --
  echo ""
  echo -e "${BOLD}${MAGENTA}"
  echo "  ============================================"
  echo "   Maestro Cloud Results"
  echo "  ============================================"
  echo -e "${NC}"
  echo -e "  Profile:  ${PROFILE:-default}"
  echo -e "  Duration: ${TOTAL_DURATION}s"
  [[ -n "$CLOUD_RUN_URL" ]] && echo -e "  Cloud URL: ${CYAN}$CLOUD_RUN_URL${NC}"
  echo ""
  echo -e "  Results:  $RESULTS_FILE"
  echo -e "  Logs:     $CLOUD_OUTPUT_FILE"
  echo ""

  # -- Normalize exit code --
  # Maestro Cloud may return various codes. Normalize to our convention:
  #   0 = all passed, 1 = test failures, 2 = config/setup error
  case $EXIT_CODE in
    0)
      log_ok "Maestro Cloud run completed successfully."
      NORMALIZED_EXIT=0
      ;;
    1|10|20)
      # Common failure codes from Maestro Cloud
      log_error "Maestro Cloud run completed with test failures (raw exit: $EXIT_CODE)."
      NORMALIZED_EXIT=1
      ;;
    2|126|127)
      # Command not found, permission denied, config errors
      log_error "Maestro Cloud configuration or setup error (raw exit: $EXIT_CODE)."
      NORMALIZED_EXIT=2
      ;;
    *)
      log_error "Maestro Cloud run ended with unexpected exit code: $EXIT_CODE"
      if [[ $EXIT_CODE -gt 100 ]]; then
        log_info "This may indicate a network or infrastructure issue."
        log_info "Check your API key and network connectivity."
        NORMALIZED_EXIT=2
      else
        NORMALIZED_EXIT=1
      fi
      ;;
  esac

  # -- Send notifications --
  if [[ -n "$NOTIFY_TARGET" && -x "$NOTIFY_SCRIPT" ]]; then
    log_info "Sending notification to: $NOTIFY_TARGET"
    "$NOTIFY_SCRIPT" --target "$NOTIFY_TARGET" --results "$RESULTS_FILE" || {
      log_warn "Notification delivery failed (non-blocking)"
    }
  fi

  exit $NORMALIZED_EXIT
fi
