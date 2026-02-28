#!/bin/bash
# =============================================================================
# Frontend Test Runner for Flent Secured
#
# Runs Jest tests for the React Native Expo app.
#
# Usage:
#   ./test-infrastructure/orchestrator/run-frontend.sh                   # Run all
#   ./test-infrastructure/orchestrator/run-frontend.sh --files "src/hooks/__tests__/useAuth.test.ts"
#   ./test-infrastructure/orchestrator/run-frontend.sh --category auth   # Filter by category
#   ./test-infrastructure/orchestrator/run-frontend.sh --coverage        # With coverage
#   ./test-infrastructure/orchestrator/run-frontend.sh --retry 2
#   ./test-infrastructure/orchestrator/run-frontend.sh --output /path/to/results.json
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
RN_APP_DIR="$PROJECT_ROOT/rn-app"
CATEGORY_MAP_FILE="$SCRIPT_DIR/category-map.json"

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[FRONTEND]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[FRONTEND]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[FRONTEND]${NC} $*"; }
log_error() { echo -e "${RED}[FRONTEND]${NC} $*"; }

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
CATEGORY_FILTER=""
MAX_RETRIES=2
TIMEOUT_SECS=600
OUTPUT_FILE=""
WITH_COVERAGE=false
VERBOSE=false
JEST_EXTRA_ARGS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --files)
      FILE_FILTER="$2"
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
    --coverage)
      WITH_COVERAGE=true
      shift
      ;;
    --verbose|-v)
      VERBOSE=true
      JEST_EXTRA_ARGS="$JEST_EXTRA_ARGS --verbose"
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--files f1,f2] [--category cat] [--retry N] [--timeout secs] [--output path] [--coverage] [--verbose]"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

# -- Validate prerequisites --
if [[ ! -d "$RN_APP_DIR" ]]; then
  log_error "React Native app directory not found: $RN_APP_DIR"
  exit 2
fi

if [[ ! -f "$RN_APP_DIR/node_modules/.bin/jest" ]]; then
  log_error "Jest not found. Run: cd rn-app && npm install"
  exit 2
fi

if [[ ! -f "$RN_APP_DIR/jest.config.js" ]]; then
  log_error "jest.config.js not found in rn-app/"
  exit 2
fi

# -- Resolve category to test files --
declare -a JEST_TEST_PATHS=()

if [[ -n "$CATEGORY_FILTER" ]]; then
  if [[ ! -f "$CATEGORY_MAP_FILE" ]]; then
    log_error "Category map not found: $CATEGORY_MAP_FILE"
    exit 2
  fi

  log_info "Resolving category: $CATEGORY_FILTER"

  # Handle comma-separated categories
  IFS=',' read -ra CATEGORIES <<< "$CATEGORY_FILTER"
  for cat in "${CATEGORIES[@]}"; do
    cat=$(echo "$cat" | xargs)  # trim whitespace

    # Extract frontend test files for this category using python3 (reliable JSON parsing)
    FILES=$(python3 -c "
import json, sys
with open('$CATEGORY_MAP_FILE') as f:
    data = json.load(f)
cat_data = data.get('$cat', {})
frontend_files = cat_data.get('frontend', [])
for f in frontend_files:
    print(f)
" 2>/dev/null)

    if [[ -z "$FILES" ]]; then
      log_warn "No frontend tests found for category: $cat"
      continue
    fi

    while IFS= read -r file; do
      JEST_TEST_PATHS+=("$file")
    done <<< "$FILES"
  done

  if [[ ${#JEST_TEST_PATHS[@]} -eq 0 ]]; then
    log_warn "No test files matched the category filter. Exiting with success."
    exit 0
  fi

elif [[ -n "$FILE_FILTER" ]]; then
  IFS=',' read -ra FILTER_ARRAY <<< "$FILE_FILTER"
  for f in "${FILTER_ARRAY[@]}"; do
    f=$(echo "$f" | xargs)  # trim whitespace
    JEST_TEST_PATHS+=("$f")
  done
fi

# -- Build Jest command --
JEST_CMD=("npx" "jest" "--forceExit" "--detectOpenHandles")

# Add JSON output
JEST_JSON_FILE=$(mktemp)
JEST_CMD+=("--json" "--outputFile" "$JEST_JSON_FILE")

# Add coverage if requested
if [[ "$WITH_COVERAGE" == "true" ]]; then
  JEST_CMD+=("--coverage")
fi

# Add extra args
if [[ -n "$JEST_EXTRA_ARGS" ]]; then
  read -ra EXTRA_ARGS <<< "$JEST_EXTRA_ARGS"
  JEST_CMD+=("${EXTRA_ARGS[@]}")
fi

# Add test path filters
if [[ ${#JEST_TEST_PATHS[@]} -gt 0 ]]; then
  JEST_CMD+=("--" "${JEST_TEST_PATHS[@]}")
  log_info "Running ${#JEST_TEST_PATHS[@]} test path(s)"
else
  log_info "Running all frontend tests"
fi

log_info "Timeout: ${TIMEOUT_SECS}s, retries: $MAX_RETRIES"

# -- Run Jest with retries --
START_TIME=$(date +%s)
ATTEMPT=0
JEST_PASSED=false
JEST_EXIT_CODE=1
STDOUT_FILE=$(mktemp)

while [[ $ATTEMPT -le $MAX_RETRIES ]]; do
  ATTEMPT=$((ATTEMPT + 1))

  if [[ $ATTEMPT -gt 1 ]]; then
    BACKOFF=$(( 2 ** (ATTEMPT - 2) ))
    [[ $BACKOFF -gt 10 ]] && BACKOFF=10
    log_warn "Retry $((ATTEMPT-1))/$MAX_RETRIES (backoff: ${BACKOFF}s)"
    sleep "$BACKOFF"
  fi

  log_info "Attempt $ATTEMPT/$((MAX_RETRIES + 1)): ${JEST_CMD[*]}"

  # Run Jest from the rn-app directory
  cd "$RN_APP_DIR"

  if cmd_timeout "${TIMEOUT_SECS}s" "${JEST_CMD[@]}" 2>&1 | tee "$STDOUT_FILE"; then
    JEST_PASSED=true
    JEST_EXIT_CODE=0
  else
    JEST_EXIT_CODE=$?
  fi

  cd "$PROJECT_ROOT"

  # Check if the JSON output was generated
  if [[ -f "$JEST_JSON_FILE" && -s "$JEST_JSON_FILE" ]]; then
    # Verify JSON is valid
    if python3 -c "import json; json.load(open('$JEST_JSON_FILE'))" 2>/dev/null; then
      # Check if all tests passed
      ALL_PASSED=$(python3 -c "
import json
with open('$JEST_JSON_FILE') as f:
    data = json.load(f)
print('true' if data.get('success', False) else 'false')
" 2>/dev/null)

      if [[ "$ALL_PASSED" == "true" ]]; then
        JEST_PASSED=true
        break
      fi

      # On failure, check if there are only retry-worthy failures (e.g., timeouts)
      if [[ $ATTEMPT -le $MAX_RETRIES ]]; then
        FAILED_SUITES=$(python3 -c "
import json
with open('$JEST_JSON_FILE') as f:
    data = json.load(f)
failed = [s['name'] for s in data.get('testResults', []) if s.get('status') == 'failed']
print(len(failed))
" 2>/dev/null || echo "unknown")
        log_warn "$FAILED_SUITES test suite(s) failed. Will retry."
      fi
    else
      log_warn "Jest JSON output is invalid. Retrying..."
    fi
  else
    log_warn "Jest JSON output not generated. Retrying..."
  fi

  if [[ "$JEST_PASSED" == "true" ]]; then
    break
  fi
done

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# -- Parse results from JSON --
TOTAL_SUITES=0
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0
TOTAL_TESTS=0
declare -a FAILED_SUITE_NAMES=()
COVERAGE_DATA="{}"

if [[ -f "$JEST_JSON_FILE" && -s "$JEST_JSON_FILE" ]]; then
  PARSED=$(python3 -c "
import json, sys

try:
    with open('$JEST_JSON_FILE') as f:
        data = json.load(f)

    suites = data.get('numTotalTestSuites', 0)
    passed = data.get('numPassedTests', 0)
    failed = data.get('numFailedTests', 0)
    skipped = data.get('numPendingTests', 0) + data.get('numTodoTests', 0)
    total = data.get('numTotalTests', 0)

    failed_suites = []
    for s in data.get('testResults', []):
        if s.get('status') == 'failed':
            name = s.get('name', 'unknown')
            # Make path relative to rn-app
            if '/rn-app/' in name:
                name = name.split('/rn-app/')[1]
            failed_suites.append(name)

    # Coverage summary if available
    coverage = {}
    cov = data.get('coverageMap', {})
    if cov:
        coverage = {'available': True}

    print(json.dumps({
        'suites': suites,
        'passed': passed,
        'failed': failed,
        'skipped': skipped,
        'total': total,
        'failed_suites': failed_suites,
        'coverage': coverage
    }))
except Exception as e:
    print(json.dumps({
        'suites': 0, 'passed': 0, 'failed': 0, 'skipped': 0,
        'total': 0, 'failed_suites': [], 'coverage': {},
        'error': str(e)
    }))
" 2>/dev/null)

  if [[ -n "$PARSED" ]]; then
    TOTAL_SUITES=$(echo "$PARSED" | python3 -c "import json,sys; print(json.load(sys.stdin)['suites'])")
    TOTAL_PASSED=$(echo "$PARSED" | python3 -c "import json,sys; print(json.load(sys.stdin)['passed'])")
    TOTAL_FAILED=$(echo "$PARSED" | python3 -c "import json,sys; print(json.load(sys.stdin)['failed'])")
    TOTAL_SKIPPED=$(echo "$PARSED" | python3 -c "import json,sys; print(json.load(sys.stdin)['skipped'])")
    TOTAL_TESTS=$(echo "$PARSED" | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")

    while IFS= read -r suite; do
      [[ -n "$suite" ]] && FAILED_SUITE_NAMES+=("$suite")
    done < <(echo "$PARSED" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data.get('failed_suites', []):
    print(s)
")
  fi
fi

# -- Summary --
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  Frontend Test Results${NC}"
echo -e "${BOLD}========================================${NC}"
echo -e "  Suites:   $TOTAL_SUITES"
echo -e "  Tests:    $TOTAL_TESTS"
echo -e "  Passed:   ${GREEN}${TOTAL_PASSED}${NC}"
echo -e "  Failed:   ${RED}${TOTAL_FAILED}${NC}"
echo -e "  Skipped:  ${YELLOW}${TOTAL_SKIPPED}${NC}"
echo -e "  Duration: ${TOTAL_DURATION}s"
echo -e "  Attempts: $ATTEMPT"
echo -e "${BOLD}========================================${NC}"

if [[ ${#FAILED_SUITE_NAMES[@]} -gt 0 ]]; then
  echo ""
  log_error "Failed suites:"
  for s in "${FAILED_SUITE_NAMES[@]}"; do
    echo "  - $s"
  done
fi

# -- Generate JSON results --
generate_results_json() {
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  echo "{"
  echo "  \"layer\": \"frontend\","
  echo "  \"timestamp\": \"$timestamp\","
  echo "  \"duration_seconds\": $TOTAL_DURATION,"
  echo "  \"attempts\": $ATTEMPT,"
  echo "  \"summary\": {"
  echo "    \"total_suites\": $TOTAL_SUITES,"
  echo "    \"total_tests\": $TOTAL_TESTS,"
  echo "    \"total_passed\": $TOTAL_PASSED,"
  echo "    \"total_failed\": $TOTAL_FAILED,"
  echo "    \"total_skipped\": $TOTAL_SKIPPED,"

  if [[ $TOTAL_TESTS -gt 0 ]]; then
    local pass_rate
    pass_rate=$(echo "scale=2; ($TOTAL_PASSED * 100) / $TOTAL_TESTS" | bc 2>/dev/null || echo "0")
    echo "    \"pass_rate\": $pass_rate"
  else
    echo "    \"pass_rate\": 0"
  fi

  echo "  },"
  echo "  \"failed_suites\": ["

  local first=true
  for s in "${FAILED_SUITE_NAMES[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      echo ","
    fi
    # Escape quotes in suite name
    local escaped
    escaped=$(echo "$s" | sed 's/"/\\"/g')
    echo "    \"$escaped\""
  done

  echo ""
  echo "  ],"
  echo "  \"coverage_enabled\": $WITH_COVERAGE,"
  echo "  \"status\": \"$([ $TOTAL_FAILED -eq 0 ] && echo "pass" || echo "fail")\""
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
  echo "$RESULTS_JSON" > "$SESSION_DIR/frontend-results.json"
fi

# Also copy the raw Jest JSON if it exists
if [[ -f "$JEST_JSON_FILE" && -s "$JEST_JSON_FILE" ]]; then
  if [[ -n "$OUTPUT_FILE" ]]; then
    cp "$JEST_JSON_FILE" "$(dirname "$OUTPUT_FILE")/frontend-jest-raw.json"
  else
    cp "$JEST_JSON_FILE" "$SCRIPT_DIR/.session/frontend-jest-raw.json"
  fi
fi

# Cleanup
rm -f "$JEST_JSON_FILE" "$STDOUT_FILE"

# -- Exit code --
if [[ $TOTAL_FAILED -gt 0 ]]; then
  exit 1
fi

exit 0
