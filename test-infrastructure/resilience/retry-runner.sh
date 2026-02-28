#!/bin/bash
# =============================================================================
# retry-runner.sh -- Intelligent Retry Engine
# Wraps any test command with smart retries, backoff, and failure classification.
#
# Usage:
#   ./resilience/retry-runner.sh --max-retries 3 --backoff exponential -- deno test auth-otp.test.ts
#   ./resilience/retry-runner.sh --max-retries 2 --backoff linear --on-fail screenshot -- maestro test flow.yaml
#   ./resilience/retry-runner.sh --on-fail log-dump --on-fail seed-reset -- npm test -- --testPathPattern=useAuth
#
# Options:
#   --max-retries N       Maximum number of retry attempts (default: 3)
#   --backoff STRATEGY    Backoff strategy: none, linear, exponential (default: exponential)
#   --on-fail ACTION      Hook to run on failure: screenshot, log-dump, seed-reset (repeatable)
#   --output-dir DIR      Directory for JSON output (default: test-infrastructure/orchestrator/reports)
#   --test-name NAME      Override test name in output (default: derived from command)
#   --                    Separator before the test command
#
# Exit codes:
#   0  Test passed (possibly after retries)
#   1  Test failed after all retries (deterministic or exhausted retries)
#   2  Usage error
# =============================================================================
set -uo pipefail
# NOTE: We intentionally do NOT use set -e here because we need to capture
# non-zero exit codes from the test command without the script aborting.

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/test-infrastructure"

# ---------------------------------------------------------------------------
# ANSI colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
MAX_RETRIES=3
BACKOFF="exponential"
ON_FAIL_HOOKS=()
OUTPUT_DIR="$INFRA_DIR/orchestrator/reports"
TEST_NAME=""
TEST_CMD=()

# ---------------------------------------------------------------------------
# Cleanup on exit
# ---------------------------------------------------------------------------
TMPDIR_RETRY=""
cleanup() {
    if [ -n "$TMPDIR_RETRY" ] && [ -d "$TMPDIR_RETRY" ]; then
        rm -rf "$TMPDIR_RETRY"
    fi
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    echo "Usage: $0 [OPTIONS] -- COMMAND [ARGS...]"
    echo ""
    echo "Options:"
    echo "  --max-retries N       Max retry attempts (default: 3)"
    echo "  --backoff STRATEGY    none | linear | exponential (default: exponential)"
    echo "  --on-fail ACTION      screenshot | log-dump | seed-reset (repeatable)"
    echo "  --output-dir DIR      Directory for JSON output"
    echo "  --test-name NAME      Override test name in output"
    echo "  --help                Show this help"
    exit 2
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --max-retries)
            MAX_RETRIES="${2:?'--max-retries requires a number'}"
            shift 2
            ;;
        --backoff)
            BACKOFF="${2:?'--backoff requires a strategy'}"
            if [[ ! "$BACKOFF" =~ ^(none|linear|exponential)$ ]]; then
                echo -e "${RED}Error: Invalid backoff strategy '$BACKOFF'. Use: none, linear, exponential${RESET}"
                exit 2
            fi
            shift 2
            ;;
        --on-fail)
            ON_FAIL_HOOKS+=("${2:?'--on-fail requires an action'}")
            shift 2
            ;;
        --output-dir)
            OUTPUT_DIR="${2:?'--output-dir requires a path'}"
            shift 2
            ;;
        --test-name)
            TEST_NAME="${2:?'--test-name requires a name'}"
            shift 2
            ;;
        --help)
            usage
            ;;
        --)
            shift
            TEST_CMD=("$@")
            break
            ;;
        *)
            echo -e "${RED}Error: Unknown option '$1'${RESET}"
            usage
            ;;
    esac
done

if [ ${#TEST_CMD[@]} -eq 0 ]; then
    echo -e "${RED}Error: No test command provided. Use -- to separate options from command.${RESET}"
    usage
fi

# ---------------------------------------------------------------------------
# Derive test name if not provided
# ---------------------------------------------------------------------------
if [ -z "$TEST_NAME" ]; then
    # Try to extract a meaningful name from the command
    # Look for common test file patterns: *.test.ts, *.test.tsx, *.yaml, *.spec.*
    for arg in ${TEST_CMD[@]+"${TEST_CMD[@]}"}; do
        if [[ "$arg" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]] || [[ "$arg" =~ \.yaml$ ]] || [[ "$arg" =~ \.yml$ ]]; then
            TEST_NAME="$(basename "$arg")"
            break
        fi
    done
    # Fallback: use the full command joined
    if [ -z "$TEST_NAME" ]; then
        TEST_NAME="${TEST_CMD[*]}"
    fi
fi

# Sanitize test name for filesystem use
SAFE_TEST_NAME="$(echo "$TEST_NAME" | tr '/' '_' | tr ' ' '_' | tr -cd '[:alnum:]._-')"

# ---------------------------------------------------------------------------
# Create temp directory for attempt outputs
# ---------------------------------------------------------------------------
TMPDIR_RETRY="$(mktemp -d "${TMPDIR:-/tmp}/retry-runner.XXXXXX")"

# ---------------------------------------------------------------------------
# Backoff calculation
# ---------------------------------------------------------------------------
calculate_backoff() {
    local attempt=$1
    case "$BACKOFF" in
        none)
            echo 0
            ;;
        linear)
            # 2s, 4s, 6s, 8s, ...
            echo $((attempt * 2))
            ;;
        exponential)
            # 2s, 4s, 8s, 16s, ...
            local result=1
            for ((i = 0; i < attempt; i++)); do
                result=$((result * 2))
            done
            echo "$result"
            ;;
    esac
}

# ---------------------------------------------------------------------------
# Failure classification
# ---------------------------------------------------------------------------
# Infrastructure patterns: timeouts, connection errors, simulator crashes
INFRA_PATTERNS=(
    "ETIMEDOUT"
    "ECONNREFUSED"
    "ECONNRESET"
    "ENOTFOUND"
    "connection refused"
    "connect ECONNREFUSED"
    "timed out"
    "timeout"
    "TimeoutError"
    "TIMEOUT"
    "simulator.*crash"
    "Simulator.*not.*running"
    "xcrun.*simctl.*error"
    "Unable to boot"
    "failed to boot"
    "Could not connect"
    "socket hang up"
    "EPIPE"
    "EHOSTUNREACH"
    "no such host"
    "DNS resolution failed"
    "network.*unreachable"
    "Cannot connect to"
    "Error: spawn"
    "ENOMEM"
    "out of memory"
    "heap.*overflow"
    "SIGKILL"
    "SIGSEGV"
    "segmentation fault"
    "bus error"
    "Killed"
    "deno.*panic"
    "fatal error"
    "too many open files"
    "EMFILE"
)

classify_failure() {
    local output_file="$1"
    local exit_code="$2"

    # Exit code 124 is standard timeout exit code
    if [ "$exit_code" -eq 124 ] || [ "$exit_code" -eq 137 ] || [ "$exit_code" -eq 139 ]; then
        echo "infra"
        return
    fi

    # Check for infrastructure patterns in output
    for pattern in ${INFRA_PATTERNS[@]+"${INFRA_PATTERNS[@]}"}; do
        if grep -qi "$pattern" "$output_file" 2>/dev/null; then
            echo "infra"
            return
        fi
    done

    # Default: could be flaky or deterministic (determined after multiple attempts)
    echo "assertion"
}

# Extract the primary error message from test output
extract_error() {
    local output_file="$1"
    local error=""

    # Try to find assertion errors, expect errors, or the last error line
    error=$(grep -iE '(AssertionError|expect\(|Error:|FAIL|FAILED|error:)' "$output_file" 2>/dev/null | head -3 | tr '\n' ' ' | cut -c1-200)

    if [ -z "$error" ]; then
        # Fallback: last 3 non-empty lines
        error=$(tail -20 "$output_file" | grep -v '^$' | tail -3 | tr '\n' ' ' | cut -c1-200)
    fi

    echo "$error"
}

# Determine overall classification after all attempts
# - If error messages are identical across all failed attempts -> deterministic
# - If error messages differ or classification was "infra" -> flaky or infra
determine_final_classification() {
    local num_attempts=$1
    local classifications_file="$2"  # file with one classification per line
    local errors_file="$3"           # file with one error message per line

    local has_infra=false
    local has_pass=false
    local unique_errors=0

    while IFS= read -r cls; do
        if [ "$cls" = "infra" ]; then
            has_infra=true
        fi
    done < "$classifications_file"

    # Count unique non-empty error messages
    unique_errors=$(grep -v '^$' "$errors_file" 2>/dev/null | sort -u | wc -l | tr -d ' ')

    if [ "$has_infra" = true ]; then
        echo "infra"
    elif [ "$unique_errors" -le 1 ] && [ "$unique_errors" -gt 0 ]; then
        # Same error every time -> deterministic
        echo "deterministic"
    else
        echo "flaky"
    fi
}

# ---------------------------------------------------------------------------
# On-fail hooks
# ---------------------------------------------------------------------------
SIMULATOR_UUID="EA52887A-365C-495B-8618-16FBEE0E0990"
APP_BUNDLE_ID="com.flent.secured"

run_on_fail_hooks() {
    local attempt=$1
    local fail_dir="$TMPDIR_RETRY/attempt_${attempt}"
    mkdir -p "$fail_dir"

    for hook in ${ON_FAIL_HOOKS[@]+"${ON_FAIL_HOOKS[@]}"}; do
        case "$hook" in
            screenshot)
                echo -e "  ${DIM}[hook] Capturing Maestro screenshot...${RESET}"
                # Try Maestro screenshot, fall back to xcrun simctl
                if command -v maestro &>/dev/null; then
                    maestro screenshot "$fail_dir/screenshot_attempt${attempt}.png" 2>/dev/null || true
                fi
                # Also try simulator screenshot as backup
                xcrun simctl io "$SIMULATOR_UUID" screenshot "$fail_dir/sim_screenshot_attempt${attempt}.png" 2>/dev/null || true
                if [ -f "$fail_dir/screenshot_attempt${attempt}.png" ] || [ -f "$fail_dir/sim_screenshot_attempt${attempt}.png" ]; then
                    echo -e "  ${DIM}[hook] Screenshot saved to $fail_dir/${RESET}"
                else
                    echo -e "  ${DIM}[hook] Screenshot capture failed (simulator may not be running)${RESET}"
                fi
                ;;
            log-dump)
                echo -e "  ${DIM}[hook] Collecting log dump...${RESET}"
                # Collect simulator logs
                xcrun simctl spawn "$SIMULATOR_UUID" log show --last 2m --predicate "process == 'FlentSecured'" \
                    > "$fail_dir/app_logs_attempt${attempt}.txt" 2>/dev/null || true
                # Collect system log (last 100 lines)
                log show --last 1m --predicate 'process == "com.apple.CoreSimulator"' \
                    2>/dev/null | tail -100 > "$fail_dir/simulator_logs_attempt${attempt}.txt" || true
                # If supabase local is running, collect its logs
                if command -v supabase &>/dev/null; then
                    supabase functions logs --limit 50 2>/dev/null \
                        > "$fail_dir/supabase_logs_attempt${attempt}.txt" || true
                fi
                echo -e "  ${DIM}[hook] Logs saved to $fail_dir/${RESET}"
                ;;
            seed-reset)
                echo -e "  ${DIM}[hook] Re-seeding test data...${RESET}"
                if [ -x "$INFRA_DIR/scripts/seed-state.sh" ]; then
                    "$INFRA_DIR/scripts/seed-state.sh" active "+919999900018" 2>/dev/null || true
                    echo -e "  ${DIM}[hook] Test data re-seeded${RESET}"
                else
                    echo -e "  ${DIM}[hook] seed-state.sh not found, skipping${RESET}"
                fi
                ;;
            *)
                echo -e "  ${YELLOW}[hook] Unknown hook: $hook${RESET}"
                ;;
        esac
    done
}

# ---------------------------------------------------------------------------
# Main execution loop
# ---------------------------------------------------------------------------
echo -e "${BOLD}Retry Runner${RESET}"
echo -e "  Test:        ${CYAN}$TEST_NAME${RESET}"
echo -e "  Command:     ${DIM}${TEST_CMD[*]-}${RESET}"
echo -e "  Max retries: $MAX_RETRIES"
echo -e "  Backoff:     $BACKOFF"
if [ ${#ON_FAIL_HOOKS[@]} -gt 0 ] 2>/dev/null; then
    echo -e "  On-fail:     ${ON_FAIL_HOOKS[*]}"
fi
echo ""

ATTEMPTS_JSON="["
CLASSIFICATIONS_FILE="$TMPDIR_RETRY/classifications.txt"
ERRORS_FILE="$TMPDIR_RETRY/errors.txt"
: > "$CLASSIFICATIONS_FILE"
: > "$ERRORS_FILE"

FINAL_RESULT="fail"
TOTAL_ATTEMPTS=0
LAST_EXIT_CODE=1

for ((attempt = 1; attempt <= MAX_RETRIES + 1; attempt++)); do
    TOTAL_ATTEMPTS=$attempt
    ATTEMPT_OUTPUT="$TMPDIR_RETRY/output_${attempt}.txt"
    ATTEMPT_START=$(python3 -c "import time; print(int(time.time() * 1000))")

    if [ "$attempt" -eq 1 ]; then
        echo -e "${BOLD}Attempt $attempt/$((MAX_RETRIES + 1))${RESET}"
    else
        echo -e "${BOLD}Retry $((attempt - 1))/$MAX_RETRIES (Attempt $attempt)${RESET}"
    fi

    # Run the test command, capturing stdout+stderr.
    # We capture the exit code manually since we do not use set -e.
    if ${TEST_CMD[@]+"${TEST_CMD[@]}"} > "$ATTEMPT_OUTPUT" 2>&1; then
        LAST_EXIT_CODE=0
    else
        LAST_EXIT_CODE=$?
    fi

    ATTEMPT_END=$(python3 -c "import time; print(int(time.time() * 1000))")
    DURATION_MS=$((ATTEMPT_END - ATTEMPT_START))

    if [ "$LAST_EXIT_CODE" -eq 0 ]; then
        # Test passed
        echo -e "  ${GREEN}PASS${RESET} (${DURATION_MS}ms)"

        # Build attempt JSON
        [ "$attempt" -gt 1 ] && ATTEMPTS_JSON+=","
        ATTEMPTS_JSON+=$(python3 -c "
import json, sys
print(json.dumps({
    'attempt': $attempt,
    'result': 'pass',
    'duration_ms': $DURATION_MS
}))
")
        FINAL_RESULT="pass"
        break
    else
        # Test failed
        CLASSIFICATION=$(classify_failure "$ATTEMPT_OUTPUT" "$LAST_EXIT_CODE")
        ERROR_MSG=$(extract_error "$ATTEMPT_OUTPUT")

        echo "$CLASSIFICATION" >> "$CLASSIFICATIONS_FILE"
        echo "$ERROR_MSG" >> "$ERRORS_FILE"

        echo -e "  ${RED}FAIL${RESET} (${DURATION_MS}ms, exit=$LAST_EXIT_CODE, class=$CLASSIFICATION)"
        if [ -n "$ERROR_MSG" ]; then
            echo -e "  ${DIM}Error: ${ERROR_MSG:0:120}${RESET}"
        fi

        # Build attempt JSON
        [ "$attempt" -gt 1 ] && ATTEMPTS_JSON+=","
        ATTEMPTS_JSON+=$(python3 -c "
import json, sys
error_msg = sys.stdin.read().strip()
print(json.dumps({
    'attempt': $attempt,
    'result': 'fail',
    'error': error_msg[:500] if error_msg else 'exit code $LAST_EXIT_CODE',
    'exit_code': $LAST_EXIT_CODE,
    'classification': '$CLASSIFICATION',
    'duration_ms': $DURATION_MS
}))
" <<< "$ERROR_MSG")

        # Check if we should skip retries for deterministic failures
        # After 2 attempts with the same assertion error, classify as deterministic and stop
        if [ "$attempt" -ge 2 ] && [ "$CLASSIFICATION" = "assertion" ]; then
            UNIQUE_ERRORS=$(sort -u "$ERRORS_FILE" | grep -cv '^$' || echo "0")
            if [ "$UNIQUE_ERRORS" -le 1 ]; then
                echo -e "  ${YELLOW}Deterministic failure detected (same error on $attempt attempts). Stopping retries.${RESET}"
                FINAL_RESULT="fail"
                # Run hooks one last time
                if [ ${#ON_FAIL_HOOKS[@]} -gt 0 ] 2>/dev/null; then
                    run_on_fail_hooks "$attempt"
                fi
                break
            fi
        fi

        # Run on-fail hooks
        if [ ${#ON_FAIL_HOOKS[@]} -gt 0 ] 2>/dev/null; then
            run_on_fail_hooks "$attempt"
        fi

        # If we have more attempts, apply backoff
        if [ "$attempt" -le "$MAX_RETRIES" ]; then
            BACKOFF_SECS=$(calculate_backoff "$attempt")
            if [ "$BACKOFF_SECS" -gt 0 ]; then
                echo -e "  ${DIM}Waiting ${BACKOFF_SECS}s before retry...${RESET}"
                sleep "$BACKOFF_SECS"
            fi
        fi
    fi
done

ATTEMPTS_JSON+="]"

# ---------------------------------------------------------------------------
# Determine final classification
# ---------------------------------------------------------------------------
if [ "$FINAL_RESULT" = "pass" ] && [ "$TOTAL_ATTEMPTS" -gt 1 ]; then
    FINAL_CLASSIFICATION="flaky"
elif [ "$FINAL_RESULT" = "pass" ]; then
    FINAL_CLASSIFICATION="stable"
elif [ "$FINAL_RESULT" = "fail" ]; then
    FINAL_CLASSIFICATION=$(determine_final_classification "$TOTAL_ATTEMPTS" "$CLASSIFICATIONS_FILE" "$ERRORS_FILE")
else
    FINAL_CLASSIFICATION="unknown"
fi

# ---------------------------------------------------------------------------
# Write structured JSON output
# ---------------------------------------------------------------------------
mkdir -p "$OUTPUT_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="$OUTPUT_DIR/retry-${SAFE_TEST_NAME}-${TIMESTAMP}.json"

# Write to temp file first, then atomic move.
# Use environment variables to safely pass strings that may contain quotes.
OUTPUT_TMP="${OUTPUT_FILE}.tmp"
RETRY_TEST_NAME="$TEST_NAME" \
RETRY_COMMAND="${TEST_CMD[*]-}" \
RETRY_FINAL_RESULT="$FINAL_RESULT" \
RETRY_TOTAL_ATTEMPTS="$TOTAL_ATTEMPTS" \
RETRY_CLASSIFICATION="$FINAL_CLASSIFICATION" \
RETRY_MAX_RETRIES="$MAX_RETRIES" \
RETRY_BACKOFF="$BACKOFF" \
RETRY_TIMESTAMP="$TIMESTAMP" \
python3 -c "
import json, sys, os

attempts = json.loads(sys.stdin.read())

result = {
    'test': os.environ['RETRY_TEST_NAME'],
    'command': os.environ['RETRY_COMMAND'],
    'attempts': attempts,
    'final_result': os.environ['RETRY_FINAL_RESULT'],
    'total_attempts': int(os.environ['RETRY_TOTAL_ATTEMPTS']),
    'classification': os.environ['RETRY_CLASSIFICATION'],
    'max_retries_configured': int(os.environ['RETRY_MAX_RETRIES']),
    'backoff_strategy': os.environ['RETRY_BACKOFF'],
    'timestamp': os.environ['RETRY_TIMESTAMP']
}

print(json.dumps(result, indent=2))
" <<< "$ATTEMPTS_JSON" > "$OUTPUT_TMP"
mv "$OUTPUT_TMP" "$OUTPUT_FILE"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}--- Result ---${RESET}"
if [ "$FINAL_RESULT" = "pass" ]; then
    echo -e "  Status:         ${GREEN}PASS${RESET}"
else
    echo -e "  Status:         ${RED}FAIL${RESET}"
fi
echo -e "  Classification: ${FINAL_CLASSIFICATION}"
echo -e "  Attempts:       ${TOTAL_ATTEMPTS}"
echo -e "  Output:         ${DIM}${OUTPUT_FILE}${RESET}"
echo ""

# Exit with appropriate code
if [ "$FINAL_RESULT" = "pass" ]; then
    exit 0
else
    exit 1
fi
