#!/bin/bash
# =============================================================================
# E2E Test Runner (Maestro) for Flent Secured
#
# Runs Maestro flows locally or on Maestro Cloud.
#
# Usage:
#   ./test-infrastructure/orchestrator/run-e2e.sh                    # Run all locally
#   ./test-infrastructure/orchestrator/run-e2e.sh --cloud            # Run on Maestro Cloud
#   ./test-infrastructure/orchestrator/run-e2e.sh --flows "flows/auth/sign-up.yaml,flows/auth/otp.yaml"
#   ./test-infrastructure/orchestrator/run-e2e.sh --category auth    # Filter by category
#   ./test-infrastructure/orchestrator/run-e2e.sh --retry 3
#   ./test-infrastructure/orchestrator/run-e2e.sh --seed active +919999900001
#   ./test-infrastructure/orchestrator/run-e2e.sh --output /path/to/results.json
#
# Exit codes:
#   0 - All tests passed
#   1 - Test failures
#   2 - Configuration error
#   3 - Infrastructure error
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MAESTRO_DIR="$PROJECT_ROOT/maestro"
FLOW_DIR="$MAESTRO_DIR/flows"
JOURNEY_DIR="$MAESTRO_DIR/journeys"
CATEGORY_MAP_FILE="$SCRIPT_DIR/category-map.json"
SEED_SCRIPT="$PROJECT_ROOT/test-infrastructure/scripts/seed-state.sh"

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[E2E]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[E2E]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[E2E]${NC} $*"; }
log_error() { echo -e "${RED}[E2E]${NC} $*"; }

# -- Parse arguments --
MODE="local"
FLOW_FILTER=""
CATEGORY_FILTER=""
MAX_RETRIES=3
TIMEOUT_SECS=1200
OUTPUT_FILE=""
SEED_STATE=""
SEED_PHONE=""
APP_BINARY="${APP_BINARY:-}"
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cloud)
      MODE="cloud"
      shift
      ;;
    --local)
      MODE="local"
      shift
      ;;
    --flows)
      FLOW_FILTER="$2"
      shift 2
      ;;
    --category)
      CATEGORY_FILTER="$2"
      shift 2
      ;;
    --retry)
      MAX_RETRIES="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECS="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --seed)
      SEED_STATE="$2"
      SEED_PHONE="${3:-+919999900001}"
      shift 3 2>/dev/null || shift 2
      ;;
    --app-binary)
      APP_BINARY="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--cloud] [--flows f1,f2] [--category cat] [--retry N] [--seed state phone] [--output path]"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

# -- Validate prerequisites --
if ! command -v maestro &>/dev/null; then
  log_error "Maestro CLI not found. Install: curl -Ls 'https://get.maestro.mobile.dev' | bash"
  exit 2
fi

if [[ ! -d "$MAESTRO_DIR" ]]; then
  log_error "Maestro directory not found: $MAESTRO_DIR"
  exit 2
fi

# For local mode, check simulator
if [[ "$MODE" == "local" ]]; then
  if command -v xcrun &>/dev/null; then
    BOOTED=$(xcrun simctl list devices 2>/dev/null | grep -i "booted" | head -1 || echo "")
    if [[ -z "$BOOTED" ]]; then
      log_warn "No iOS simulator booted. E2E tests may fail."
    else
      DEVICE_NAME=$(echo "$BOOTED" | sed 's/^[[:space:]]*//' | sed 's/ (.*//')
      log_info "Simulator: $DEVICE_NAME"
    fi
  fi
fi

# For cloud mode, check API key
if [[ "$MODE" == "cloud" ]]; then
  if [[ -z "${MAESTRO_CLOUD_API_KEY:-}" ]]; then
    log_error "MAESTRO_CLOUD_API_KEY not set. Required for cloud execution."
    exit 2
  fi
fi

# -- Seed test data if requested --
if [[ -n "$SEED_STATE" ]]; then
  log_info "Seeding test data: state=$SEED_STATE phone=$SEED_PHONE"
  if [[ -x "$SEED_SCRIPT" ]]; then
    if ! "$SEED_SCRIPT" "$SEED_STATE" "$SEED_PHONE"; then
      log_warn "Seed script failed (non-fatal, continuing)"
    else
      log_ok "Test data seeded successfully"
    fi
  else
    log_warn "Seed script not found or not executable: $SEED_SCRIPT"
  fi
fi

# -- Determine which flows to run --
declare -a FLOW_FILES=()

if [[ -n "$CATEGORY_FILTER" ]]; then
  if [[ ! -f "$CATEGORY_MAP_FILE" ]]; then
    log_error "Category map not found: $CATEGORY_MAP_FILE"
    exit 2
  fi

  IFS=',' read -ra CATEGORIES <<< "$CATEGORY_FILTER"
  for cat in "${CATEGORIES[@]}"; do
    cat=$(echo "$cat" | xargs)

    FILES=$(python3 -c "
import json
with open('$CATEGORY_MAP_FILE') as f:
    data = json.load(f)
cat_data = data.get('$cat', {})
e2e_files = cat_data.get('e2e', [])
for f in e2e_files:
    print(f)
" 2>/dev/null)

    if [[ -z "$FILES" ]]; then
      log_warn "No E2E flows found for category: $cat"
      continue
    fi

    while IFS= read -r file; do
      FULL_PATH="$MAESTRO_DIR/$file"
      if [[ -f "$FULL_PATH" ]]; then
        FLOW_FILES+=("$FULL_PATH")
      else
        log_warn "Flow file not found: $file"
      fi
    done <<< "$FILES"
  done

elif [[ -n "$FLOW_FILTER" ]]; then
  IFS=',' read -ra FILTER_ARRAY <<< "$FLOW_FILTER"
  for f in "${FILTER_ARRAY[@]}"; do
    f=$(echo "$f" | xargs)
    FULL_PATH="$MAESTRO_DIR/$f"
    if [[ -f "$FULL_PATH" ]]; then
      FLOW_FILES+=("$FULL_PATH")
    else
      log_warn "Flow file not found: $f"
    fi
  done

else
  # Run all flows then journeys
  while IFS= read -r -d '' file; do
    FLOW_FILES+=("$file")
  done < <(find "$FLOW_DIR" -name "*.yaml" -type f -print0 | sort -z)

  while IFS= read -r -d '' file; do
    FLOW_FILES+=("$file")
  done < <(find "$JOURNEY_DIR" -name "*.yaml" -type f -print0 | sort -z)
fi

if [[ ${#FLOW_FILES[@]} -eq 0 ]]; then
  log_warn "No E2E flows to run. Exiting with success."
  exit 0
fi

log_info "Running ${#FLOW_FILES[@]} E2E flow(s) in $MODE mode"
log_info "Timeout: ${TIMEOUT_SECS}s total, retries: $MAX_RETRIES per flow"

# -- App environment variables for Maestro --
APP_ID="com.flent.secured"
MAESTRO_ENV_ARGS=(
  "--env" "APP_ID=$APP_ID"
  "--env" "DEEP_LINK_SCHEME=flentsecured"
  "--env" "TEST_PHONE=9876543210"
  "--env" "TEST_NAME=Test User"
  "--env" "TEST_OTP=123456"
  "--env" "TEST_UPI_VPA=test@upi"
  "--env" "TEST_PAYMENT_AMOUNT=32500"
)

# -- Screenshot capture directory --
SCREENSHOT_DIR="$SCRIPT_DIR/.session/e2e-screenshots"
mkdir -p "$SCREENSHOT_DIR"

# -- Run flows --
START_TIME=$(date +%s)
TOTAL_PASS=0
TOTAL_FAIL=0
declare -a FAILED_FLOWS=()
declare -a FLOW_RESULTS=()

if [[ "$MODE" == "local" ]]; then
  # ==========================================
  # LOCAL EXECUTION (one flow at a time)
  # ==========================================
  for flow_file in "${FLOW_FILES[@]}"; do
    FLOW_REL=$(echo "$flow_file" | sed "s|$MAESTRO_DIR/||")
    FLOW_NAME=$(basename "$flow_file" .yaml)
    FLOW_START=$(date +%s)
    ATTEMPT=0
    FLOW_PASSED=false

    while [[ $ATTEMPT -le $MAX_RETRIES ]]; do
      ATTEMPT=$((ATTEMPT + 1))

      if [[ $ATTEMPT -gt 1 ]]; then
        BACKOFF=$(( 2 ** (ATTEMPT - 2) ))
        [[ $BACKOFF -gt 15 ]] && BACKOFF=15
        log_warn "Retry $((ATTEMPT-1))/$MAX_RETRIES for $FLOW_REL (backoff: ${BACKOFF}s)"
        sleep "$BACKOFF"
      fi

      log_info "Running: $FLOW_REL (attempt $ATTEMPT/$((MAX_RETRIES + 1)))"

      if maestro test "$flow_file" "${MAESTRO_ENV_ARGS[@]}" 2>&1; then
        FLOW_PASSED=true
        break
      else
        # Capture screenshot on failure
        SCREENSHOT_NAME="${FLOW_NAME}_attempt${ATTEMPT}_$(date +%s).png"
        if command -v xcrun &>/dev/null; then
          BOOTED_UDID=$(xcrun simctl list devices 2>/dev/null | grep -i "booted" | grep -oE '[A-F0-9-]{36}' | head -1 || echo "")
          if [[ -n "$BOOTED_UDID" ]]; then
            xcrun simctl io "$BOOTED_UDID" screenshot "$SCREENSHOT_DIR/$SCREENSHOT_NAME" 2>/dev/null && \
              log_info "Screenshot saved: $SCREENSHOT_NAME"
          fi
        fi
      fi
    done

    FLOW_END=$(date +%s)
    FLOW_DURATION=$((FLOW_END - FLOW_START))

    if [[ "$FLOW_PASSED" == "true" ]]; then
      log_ok "PASS: $FLOW_REL (${FLOW_DURATION}s)"
      TOTAL_PASS=$((TOTAL_PASS + 1))
    else
      log_error "FAIL: $FLOW_REL (${FLOW_DURATION}s, $ATTEMPT attempts)"
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
      FAILED_FLOWS+=("$FLOW_REL")
    fi

    FLOW_RESULTS+=("{\"flow\":\"$FLOW_REL\",\"status\":\"$([ "$FLOW_PASSED" == "true" ] && echo "pass" || echo "fail")\",\"duration\":$FLOW_DURATION,\"attempts\":$ATTEMPT}")
  done

else
  # ==========================================
  # CLOUD EXECUTION
  # ==========================================
  log_info "Uploading to Maestro Cloud..."

  # Resolve app binary
  if [[ -z "$APP_BINARY" ]]; then
    IOS_BUILD_DIR="$PROJECT_ROOT/rn-app/ios/build/Build/Products/Debug-iphonesimulator"
    if [[ -d "$IOS_BUILD_DIR/FlentSecured.app" ]]; then
      APP_BINARY="$IOS_BUILD_DIR/FlentSecured.app"
    fi
  fi

  if [[ -z "$APP_BINARY" ]]; then
    log_error "No app binary found. Provide --app-binary or set APP_BINARY."
    exit 2
  fi

  # Build flow directory args
  declare -a FLOW_DIRS_ARR=()
  for flow in "${FLOW_FILES[@]}"; do
    # Maestro Cloud works better with directories
    FLOW_DIR_PATH=$(dirname "$flow")
    already_added=false
    for existing in ${FLOW_DIRS_ARR[@]+"${FLOW_DIRS_ARR[@]}"}; do
      if [[ "$existing" == "$FLOW_DIR_PATH" ]]; then
        already_added=true
        break
      fi
    done
    if [[ "$already_added" == "false" ]]; then
      FLOW_DIRS_ARR+=("$FLOW_DIR_PATH")
    fi
  done

  CLOUD_START=$(date +%s)

  if maestro cloud \
    --apiKey "$MAESTRO_CLOUD_API_KEY" \
    --app-file "$APP_BINARY" \
    --timeout 120 \
    "${MAESTRO_ENV_ARGS[@]}" \
    --env "CI=true" \
    ${FLOW_DIRS_ARR[@]+"${FLOW_DIRS_ARR[@]}"} 2>&1; then
    TOTAL_PASS=${#FLOW_FILES[@]}
    log_ok "Maestro Cloud run completed successfully"
  else
    TOTAL_FAIL=${#FLOW_FILES[@]}
    log_error "Maestro Cloud run failed"
    for flow_file in "${FLOW_FILES[@]}"; do
      FLOW_REL=$(echo "$flow_file" | sed "s|$MAESTRO_DIR/||")
      FAILED_FLOWS+=("$FLOW_REL")
    done
  fi

  CLOUD_END=$(date +%s)
  CLOUD_DURATION=$((CLOUD_END - CLOUD_START))

  FLOW_RESULTS+=("{\"mode\":\"cloud\",\"status\":\"$([ $TOTAL_FAIL -eq 0 ] && echo "pass" || echo "fail")\",\"duration\":$CLOUD_DURATION,\"total_flows\":${#FLOW_FILES[@]}}")
fi

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# -- Summary --
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  E2E Test Results ($MODE)${NC}"
echo -e "${BOLD}========================================${NC}"
echo -e "  Total:    ${#FLOW_FILES[@]}"
echo -e "  Passed:   ${GREEN}${TOTAL_PASS}${NC}"
echo -e "  Failed:   ${RED}${TOTAL_FAIL}${NC}"
echo -e "  Duration: ${TOTAL_DURATION}s"
echo -e "  Mode:     $MODE"
echo -e "${BOLD}========================================${NC}"

if [[ ${#FAILED_FLOWS[@]} -gt 0 ]]; then
  echo ""
  log_error "Failed flows:"
  for f in "${FAILED_FLOWS[@]}"; do
    echo "  - $f"
  done
fi

# Check for screenshots
SCREENSHOT_COUNT=$(find "$SCREENSHOT_DIR" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$SCREENSHOT_COUNT" -gt 0 ]]; then
  echo ""
  log_info "Failure screenshots: $SCREENSHOT_DIR ($SCREENSHOT_COUNT files)"
fi

# -- Generate JSON results --
generate_results_json() {
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  echo "{"
  echo "  \"layer\": \"e2e\","
  echo "  \"mode\": \"$MODE\","
  echo "  \"timestamp\": \"$timestamp\","
  echo "  \"duration_seconds\": $TOTAL_DURATION,"
  echo "  \"summary\": {"
  echo "    \"total_flows\": ${#FLOW_FILES[@]},"
  echo "    \"total_passed\": $TOTAL_PASS,"
  echo "    \"total_failed\": $TOTAL_FAIL,"

  if [[ ${#FLOW_FILES[@]} -gt 0 ]]; then
    local pass_rate
    pass_rate=$(echo "scale=2; ($TOTAL_PASS * 100) / ${#FLOW_FILES[@]}" | bc 2>/dev/null || echo "0")
    echo "    \"pass_rate\": $pass_rate"
  else
    echo "    \"pass_rate\": 0"
  fi

  echo "  },"
  echo "  \"flows\": ["

  local first=true
  for result in "${FLOW_RESULTS[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      echo ","
    fi
    echo "    $result"
  done

  echo ""
  echo "  ],"
  echo "  \"failed_flows\": ["

  first=true
  for f in "${FAILED_FLOWS[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      echo ","
    fi
    echo "    \"$f\""
  done

  echo ""
  echo "  ],"
  echo "  \"screenshot_dir\": \"$SCREENSHOT_DIR\","
  echo "  \"screenshot_count\": $SCREENSHOT_COUNT,"
  echo "  \"status\": \"$([ $TOTAL_FAIL -eq 0 ] && echo "pass" || echo "fail")\""
  echo "}"
}

RESULTS_JSON=$(generate_results_json)

if [[ -n "$OUTPUT_FILE" ]]; then
  mkdir -p "$(dirname "$OUTPUT_FILE")"
  echo "$RESULTS_JSON" > "$OUTPUT_FILE"
  log_info "Results written to: $OUTPUT_FILE"
else
  SESSION_DIR="$SCRIPT_DIR/.session"
  mkdir -p "$SESSION_DIR"
  echo "$RESULTS_JSON" > "$SESSION_DIR/e2e-results.json"
fi

# -- Exit code --
if [[ $TOTAL_FAIL -gt 0 ]]; then
  exit 1
fi

exit 0
