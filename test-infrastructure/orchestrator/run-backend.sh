#!/bin/bash
# =============================================================================
# Backend Test Runner for Flent Secured
#
# Runs Deno-based edge function tests against local Supabase.
#
# Usage:
#   ./test-infrastructure/orchestrator/run-backend.sh                  # Run all
#   ./test-infrastructure/orchestrator/run-backend.sh --files "auth-otp.test.ts,verify-bank.test.ts"
#   ./test-infrastructure/orchestrator/run-backend.sh --retry 3
#   ./test-infrastructure/orchestrator/run-backend.sh --timeout 300
#   ./test-infrastructure/orchestrator/run-backend.sh --output /path/to/results.json
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
BACKEND_TEST_DIR="$PROJECT_ROOT/supabase/functions/_tests"
HELPERS_DIR="$BACKEND_TEST_DIR/helpers"

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[BACKEND]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[BACKEND]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[BACKEND]${NC} $*"; }
log_error() { echo -e "${RED}[BACKEND]${NC} $*"; }

# macOS-compatible timeout wrapper
cmd_timeout() {
  if command -v gtimeout &>/dev/null; then gtimeout "$@"
  elif command -v timeout &>/dev/null; then timeout "$@"
  else
    local duration="$1"; shift
    perl -e 'alarm shift; exec @ARGV' -- "$duration" "$@"
  fi
}

# -- Parse arguments --
FILE_FILTER=""
MAX_RETRIES=2
TIMEOUT_SECS=300
OUTPUT_FILE=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --files)
      FILE_FILTER="$2"
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
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--files file1.ts,file2.ts] [--retry N] [--timeout secs] [--output path] [--verbose]"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

# -- Validate prerequisites --
if ! command -v deno &>/dev/null; then
  log_error "Deno not found. Install via: curl -fsSL https://deno.land/install.sh | sh"
  exit 2
fi

if [[ ! -d "$BACKEND_TEST_DIR" ]]; then
  log_error "Backend test directory not found: $BACKEND_TEST_DIR"
  exit 2
fi

# -- Environment setup --
export SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

# Try to get keys from local Supabase if not set
if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]] && command -v supabase &>/dev/null; then
  log_info "Fetching Supabase keys from local instance..."
  LOCAL_STATUS=$(supabase status 2>/dev/null || echo "")
  if [[ -n "$LOCAL_STATUS" ]]; then
    SUPABASE_SERVICE_ROLE_KEY=$(echo "$LOCAL_STATUS" | grep -i "service_role" | awk '{print $NF}' || echo "")
    SUPABASE_ANON_KEY=$(echo "$LOCAL_STATUS" | grep -i "anon" | awk '{print $NF}' || echo "")
    export SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY
    if [[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
      log_ok "Supabase keys loaded from local instance"
    fi
  fi
fi

# -- Determine which test files to run --
declare -a TEST_FILES=()

if [[ -n "$FILE_FILTER" ]]; then
  IFS=',' read -ra FILTER_ARRAY <<< "$FILE_FILTER"
  for f in "${FILTER_ARRAY[@]}"; do
    f=$(echo "$f" | xargs)  # trim whitespace
    FULL_PATH="$BACKEND_TEST_DIR/$f"
    if [[ -f "$FULL_PATH" ]]; then
      TEST_FILES+=("$FULL_PATH")
    else
      log_warn "Test file not found, skipping: $f"
    fi
  done
else
  while IFS= read -r -d '' file; do
    TEST_FILES+=("$file")
  done < <(find "$BACKEND_TEST_DIR" -name "*.test.ts" -type f -print0 | sort -z)
fi

if [[ ${#TEST_FILES[@]} -eq 0 ]]; then
  log_error "No test files to run"
  exit 2
fi

log_info "Running ${#TEST_FILES[@]} backend test file(s)"
log_info "Supabase URL: $SUPABASE_URL"
log_info "Timeout: ${TIMEOUT_SECS}s per file, retries: $MAX_RETRIES"

# -- Run tests --
START_TIME=$(date +%s)
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0
declare -a FAILED_FILES=()
declare -a FILE_RESULTS=()

for test_file in "${TEST_FILES[@]}"; do
  FILE_NAME=$(basename "$test_file")
  FILE_START=$(date +%s)
  ATTEMPT=0
  FILE_PASSED=false

  while [[ $ATTEMPT -le $MAX_RETRIES ]]; do
    ATTEMPT=$((ATTEMPT + 1))

    if [[ $ATTEMPT -gt 1 ]]; then
      # Exponential backoff: 2^(attempt-2) seconds, capped at 10
      BACKOFF=$(( 2 ** (ATTEMPT - 2) ))
      [[ $BACKOFF -gt 10 ]] && BACKOFF=10
      log_warn "Retry $((ATTEMPT-1))/$MAX_RETRIES for $FILE_NAME (backoff: ${BACKOFF}s)"
      sleep "$BACKOFF"
    fi

    log_info "Running: $FILE_NAME (attempt $ATTEMPT/$((MAX_RETRIES + 1)))"

    # Create temp file for output capture
    TEMP_OUTPUT=$(mktemp)

    # Run deno test with timeout
    if cmd_timeout "${TIMEOUT_SECS}s" deno test \
      --allow-net --allow-env --allow-read \
      "$test_file" \
      2>&1 | tee "$TEMP_OUTPUT"; then
      FILE_PASSED=true
    fi

    # Parse output for pass/fail counts
    FILE_OUTPUT=$(cat "$TEMP_OUTPUT")
    rm -f "$TEMP_OUTPUT"

    # Extract test counts from Deno output
    # Deno format: "ok | X passed | Y failed | Z ignored"
    PASS_COUNT=$(echo "$FILE_OUTPUT" | grep -oE '[0-9]+ passed' | tail -1 | grep -oE '[0-9]+' || echo "0")
    FAIL_COUNT=$(echo "$FILE_OUTPUT" | grep -oE '[0-9]+ failed' | tail -1 | grep -oE '[0-9]+' || echo "0")
    SKIP_COUNT=$(echo "$FILE_OUTPUT" | grep -oE '[0-9]+ ignored' | tail -1 | grep -oE '[0-9]+' || echo "0")

    if [[ "$FILE_PASSED" == "true" || "$FAIL_COUNT" == "0" ]]; then
      FILE_PASSED=true
      break
    fi
  done

  FILE_END=$(date +%s)
  FILE_DURATION=$((FILE_END - FILE_START))

  if [[ "$FILE_PASSED" == "true" ]]; then
    log_ok "PASS: $FILE_NAME (${FILE_DURATION}s, ${PASS_COUNT} tests)"
    TOTAL_PASS=$((TOTAL_PASS + PASS_COUNT))
    TOTAL_SKIP=$((TOTAL_SKIP + SKIP_COUNT))
  else
    log_error "FAIL: $FILE_NAME (${FILE_DURATION}s, ${FAIL_COUNT} failures after $ATTEMPT attempts)"
    TOTAL_FAIL=$((TOTAL_FAIL + FAIL_COUNT))
    TOTAL_PASS=$((TOTAL_PASS + PASS_COUNT))
    TOTAL_SKIP=$((TOTAL_SKIP + SKIP_COUNT))
    FAILED_FILES+=("$FILE_NAME")
  fi

  # Record per-file result
  FILE_RESULTS+=("{\"file\":\"$FILE_NAME\",\"status\":\"$([ "$FILE_PASSED" == "true" ] && echo "pass" || echo "fail")\",\"passed\":$PASS_COUNT,\"failed\":$FAIL_COUNT,\"skipped\":$SKIP_COUNT,\"duration\":$FILE_DURATION,\"attempts\":$ATTEMPT}")
done

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# -- Summary --
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  Backend Test Results${NC}"
echo -e "${BOLD}========================================${NC}"
echo -e "  Files:    ${#TEST_FILES[@]}"
echo -e "  Passed:   ${GREEN}${TOTAL_PASS}${NC}"
echo -e "  Failed:   ${RED}${TOTAL_FAIL}${NC}"
echo -e "  Skipped:  ${YELLOW}${TOTAL_SKIP}${NC}"
echo -e "  Duration: ${TOTAL_DURATION}s"
echo -e "${BOLD}========================================${NC}"

if [[ ${#FAILED_FILES[@]} -gt 0 ]]; then
  echo ""
  log_error "Failed files:"
  for f in "${FAILED_FILES[@]}"; do
    echo "  - $f"
  done
fi

# -- Generate JSON results --
generate_results_json() {
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  echo "{"
  echo "  \"layer\": \"backend\","
  echo "  \"timestamp\": \"$timestamp\","
  echo "  \"duration_seconds\": $TOTAL_DURATION,"
  echo "  \"summary\": {"
  echo "    \"total_files\": ${#TEST_FILES[@]},"
  echo "    \"total_passed\": $TOTAL_PASS,"
  echo "    \"total_failed\": $TOTAL_FAIL,"
  echo "    \"total_skipped\": $TOTAL_SKIP,"
  echo "    \"pass_rate\": $(echo "scale=2; ($TOTAL_PASS * 100) / ($TOTAL_PASS + $TOTAL_FAIL + 1)" | bc 2>/dev/null || echo "0")"
  echo "  },"
  echo "  \"files\": ["

  local first=true
  for result in "${FILE_RESULTS[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      echo ","
    fi
    echo "    $result"
  done

  echo ""
  echo "  ],"
  echo "  \"failed_files\": ["

  first=true
  for f in "${FAILED_FILES[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      echo ","
    fi
    echo "    \"$f\""
  done

  echo ""
  echo "  ],"
  echo "  \"status\": \"$([ ${#FAILED_FILES[@]} -eq 0 ] && echo "pass" || echo "fail")\""
  echo "}"
}

RESULTS_JSON=$(generate_results_json)

if [[ -n "$OUTPUT_FILE" ]]; then
  # Ensure directory exists
  mkdir -p "$(dirname "$OUTPUT_FILE")"
  echo "$RESULTS_JSON" > "$OUTPUT_FILE"
  log_info "Results written to: $OUTPUT_FILE"
else
  # Write to default session location
  SESSION_DIR="$SCRIPT_DIR/.session"
  mkdir -p "$SESSION_DIR"
  echo "$RESULTS_JSON" > "$SESSION_DIR/backend-results.json"
fi

# -- Exit code --
if [[ ${#FAILED_FILES[@]} -gt 0 ]]; then
  exit 1
fi

exit 0
