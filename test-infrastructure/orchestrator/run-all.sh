#!/bin/bash
# =============================================================================
# Unified Test Orchestrator for Flent Secured
#
# Combines backend (Deno), frontend (Jest), and E2E (Maestro) test layers
# into a single autonomous pipeline with health checks, retries, session
# persistence, parallel execution, and structured reporting.
#
# Usage:
#   ./test-infrastructure/orchestrator/run-all.sh                        # Run all layers
#   ./test-infrastructure/orchestrator/run-all.sh --layer backend        # Backend only
#   ./test-infrastructure/orchestrator/run-all.sh --layer frontend       # Frontend only
#   ./test-infrastructure/orchestrator/run-all.sh --layer e2e            # E2E only
#   ./test-infrastructure/orchestrator/run-all.sh --layer backend,frontend
#   ./test-infrastructure/orchestrator/run-all.sh --category auth        # Filter by category
#   ./test-infrastructure/orchestrator/run-all.sh --priority P0          # Only P0 tests
#   ./test-infrastructure/orchestrator/run-all.sh --cloud                # Maestro Cloud for E2E
#   ./test-infrastructure/orchestrator/run-all.sh --retry 3              # Retry failed 3x
#   ./test-infrastructure/orchestrator/run-all.sh --resume               # Resume crashed session
#   ./test-infrastructure/orchestrator/run-all.sh --report html          # Generate HTML report
#   ./test-infrastructure/orchestrator/run-all.sh --parallel             # Backend+frontend parallel
#   ./test-infrastructure/orchestrator/run-all.sh --smoke                # P0 smoke test only
#   ./test-infrastructure/orchestrator/run-all.sh --nightly              # Full nightly config
#   ./test-infrastructure/orchestrator/run-all.sh --skip-health          # Skip pre-flight checks
#   ./test-infrastructure/orchestrator/run-all.sh --dry-run              # Show plan, do not run
#   ./test-infrastructure/orchestrator/run-all.sh --coverage             # Frontend with coverage
#
# Exit codes:
#   0 - All tests passed
#   1 - Test failures detected
#   2 - Configuration error
#   3 - Infrastructure error
# =============================================================================

set -uo pipefail

# =============================================================================
# CONFIGURATION AND PATHS
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"
CATEGORY_MAP_FILE="$SCRIPT_DIR/category-map.json"
SESSION_DIR="$SCRIPT_DIR/.session"
REPORT_BASE_DIR="$SCRIPT_DIR/reports"

# Sub-scripts
HEALTH_CHECK="$SCRIPT_DIR/health-check.sh"
RUN_BACKEND="$SCRIPT_DIR/run-backend.sh"
RUN_FRONTEND="$SCRIPT_DIR/run-frontend.sh"
RUN_E2E="$SCRIPT_DIR/run-e2e.sh"

# Production safety guard
PRODUCTION_PROJECT_REF="zqlowjveyqiagnbmfwsb"

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log_header() { echo -e "\n${BOLD}${MAGENTA}=== $* ===${NC}\n"; }
log_info()   { echo -e "${BLUE}[ORCH]${NC} $*"; }
log_ok()     { echo -e "${GREEN}[ORCH]${NC} $*"; }
log_warn()   { echo -e "${YELLOW}[ORCH]${NC} $*"; }
log_error()  { echo -e "${RED}[ORCH]${NC} $*"; }
log_dim()    { echo -e "${DIM}$*${NC}"; }

# =============================================================================
# ARGUMENT PARSING
# =============================================================================

LAYER_FILTER="all"
CATEGORY_FILTER=""
PRIORITY_FILTER=""
CLOUD_MODE=false
MAX_RETRIES=""          # Will use config defaults if empty
RESUME_MODE=false
REPORT_FORMAT=""        # empty=no report, "json"=default, "html"=HTML
PARALLEL_MODE=false
SMOKE_MODE=false
NIGHTLY_MODE=false
SKIP_HEALTH=false
DRY_RUN=false
WITH_COVERAGE=false
GLOBAL_TIMEOUT=""       # Will use config default if empty
VERBOSE=false
E2E_SEED_STATE=""
E2E_SEED_PHONE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --layer)
      LAYER_FILTER="$2"
      shift 2
      ;;
    --category)
      CATEGORY_FILTER="$2"
      shift 2
      ;;
    --priority)
      PRIORITY_FILTER="$2"
      shift 2
      ;;
    --cloud)
      CLOUD_MODE=true
      shift
      ;;
    --retry)
      MAX_RETRIES="$2"
      shift 2
      ;;
    --resume)
      RESUME_MODE=true
      shift
      ;;
    --report)
      REPORT_FORMAT="${2:-json}"
      shift 2 2>/dev/null || shift
      ;;
    --parallel)
      PARALLEL_MODE=true
      shift
      ;;
    --smoke)
      SMOKE_MODE=true
      shift
      ;;
    --nightly)
      NIGHTLY_MODE=true
      shift
      ;;
    --skip-health)
      SKIP_HEALTH=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --coverage)
      WITH_COVERAGE=true
      shift
      ;;
    --timeout)
      GLOBAL_TIMEOUT="$2"
      shift 2
      ;;
    --seed)
      E2E_SEED_STATE="$2"
      E2E_SEED_PHONE="${3:-+919999900001}"
      shift 3 2>/dev/null || shift 2
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Unified Test Orchestrator for Flent Secured"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Layer selection:"
      echo "  --layer LAYERS       Comma-separated: backend,frontend,e2e (default: all)"
      echo "  --category CATS      Filter by category: auth,payment,setup,etc."
      echo "  --priority P0|P1|P2  Filter by priority level"
      echo ""
      echo "Execution modes:"
      echo "  --smoke              P0 smoke test only (fast)"
      echo "  --nightly            Full nightly run with extended retries"
      echo "  --parallel           Run backend+frontend in parallel, then E2E"
      echo "  --cloud              Use Maestro Cloud for E2E tests"
      echo "  --resume             Resume from last crashed/stopped session"
      echo "  --dry-run            Show execution plan without running"
      echo ""
      echo "Options:"
      echo "  --retry N            Max retries per test (default: 2 for unit, 3 for E2E)"
      echo "  --timeout MS         Global timeout in seconds"
      echo "  --coverage           Include frontend coverage report"
      echo "  --report FORMAT      Generate report: json (default) or html"
      echo "  --seed STATE PHONE   Seed test data before E2E (state and phone)"
      echo "  --skip-health        Skip pre-flight health checks"
      echo "  --verbose            Verbose output"
      echo ""
      echo "Exit codes: 0=pass, 1=test failure, 2=config error, 3=infra error"
      exit 0
      ;;
    *)
      log_warn "Unknown argument: $1"
      shift
      ;;
  esac
done

# =============================================================================
# PRESET MODES
# =============================================================================

if [[ "$SMOKE_MODE" == "true" ]]; then
  PRIORITY_FILTER="P0"
  [[ -z "$MAX_RETRIES" ]] && MAX_RETRIES=1
  log_info "Smoke mode: P0 tests only, retries=$MAX_RETRIES"
fi

if [[ "$NIGHTLY_MODE" == "true" ]]; then
  PARALLEL_MODE=true
  [[ -z "$MAX_RETRIES" ]] && MAX_RETRIES=3
  WITH_COVERAGE=true
  REPORT_FORMAT="${REPORT_FORMAT:-json}"
  log_info "Nightly mode: all tests, parallel, retries=$MAX_RETRIES, coverage=on"
fi

# =============================================================================
# LOAD CONFIGURATION
# =============================================================================

if [[ ! -f "$CONFIG_FILE" ]]; then
  log_error "Configuration file not found: $CONFIG_FILE"
  exit 2
fi

# Read timeouts from config using python3
read_config() {
  local key="$1"
  local default="$2"
  python3 -c "
import json
with open('$CONFIG_FILE') as f:
    data = json.load(f)
keys = '$key'.split('.')
val = data
for k in keys:
    val = val.get(k, {})
print(val if val != {} else '$default')
" 2>/dev/null || echo "$default"
}

TIMEOUT_BACKEND=$(read_config "timeouts.backend" "300000")
TIMEOUT_FRONTEND=$(read_config "timeouts.frontend" "600000")
TIMEOUT_E2E=$(read_config "timeouts.e2e" "1200000")
TIMEOUT_GLOBAL="${GLOBAL_TIMEOUT:-$(read_config "timeouts.global" "3600000")}"

# Convert ms to seconds for bash timeout command
TIMEOUT_BACKEND_S=$((TIMEOUT_BACKEND / 1000))
TIMEOUT_FRONTEND_S=$((TIMEOUT_FRONTEND / 1000))
TIMEOUT_E2E_S=$((TIMEOUT_E2E / 1000))
TIMEOUT_GLOBAL_S=$((TIMEOUT_GLOBAL / 1000))

RETRY_BACKEND="${MAX_RETRIES:-$(read_config "retries.backend" "2")}"
RETRY_FRONTEND="${MAX_RETRIES:-$(read_config "retries.frontend" "2")}"
RETRY_E2E="${MAX_RETRIES:-$(read_config "retries.e2e" "3")}"

# =============================================================================
# LAYER RESOLUTION
# =============================================================================

RUN_BACKEND_LAYER=false
RUN_FRONTEND_LAYER=false
RUN_E2E_LAYER=false

if [[ "$LAYER_FILTER" == "all" ]]; then
  RUN_BACKEND_LAYER=true
  RUN_FRONTEND_LAYER=true
  RUN_E2E_LAYER=true
else
  IFS=',' read -ra LAYERS <<< "$LAYER_FILTER"
  for layer in "${LAYERS[@]}"; do
    layer=$(echo "$layer" | xargs)
    case "$layer" in
      backend)  RUN_BACKEND_LAYER=true ;;
      frontend) RUN_FRONTEND_LAYER=true ;;
      e2e)      RUN_E2E_LAYER=true ;;
      *)        log_warn "Unknown layer: $layer" ;;
    esac
  done
fi

# =============================================================================
# PRIORITY FILTERING
# =============================================================================

resolve_priority_files() {
  local priority="$1"
  if [[ -z "$priority" || "$priority" == "all" ]]; then
    return
  fi

  local csv_file="$PROJECT_ROOT/test-infrastructure/test-cases/master-test-plan.csv"
  if [[ ! -f "$csv_file" ]]; then
    log_warn "Master test plan CSV not found. Priority filtering disabled."
    return
  fi

  # Extract test IDs and their sub-categories for the given priority
  # The CSV maps manual test cases; we use sub-categories to find matching automated test files
  PRIORITY_SUBCATS=$(python3 -c "
import csv
subcats = set()
with open('$csv_file', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row.get('Priority', '').strip() == '$priority':
            sub = row.get('Sub-Category', '').strip()
            if sub:
                subcats.add(sub.lower())
# Print unique sub-categories
for s in sorted(subcats):
    print(s)
" 2>/dev/null || echo "")

  if [[ -n "$PRIORITY_SUBCATS" ]]; then
    log_info "Priority $priority covers sub-categories: $(echo "$PRIORITY_SUBCATS" | tr '\n' ', ')"
  fi
}

if [[ -n "$PRIORITY_FILTER" ]]; then
  resolve_priority_files "$PRIORITY_FILTER"
fi

# =============================================================================
# SESSION MANAGEMENT
# =============================================================================

SESSION_ID=$(date +%Y%m%d_%H%M%S)_$$
SESSION_FILE="$SESSION_DIR/session_${SESSION_ID}.json"
REPORT_DIR="$REPORT_BASE_DIR/$(date +%Y-%m-%d_%H-%M-%S)"

mkdir -p "$SESSION_DIR" "$REPORT_DIR"

write_session() {
  local status="$1"
  local current_layer="${2:-none}"
  local details="${3:-{}}"

  local temp_file
  temp_file=$(mktemp)

  cat > "$temp_file" <<EOJSON
{
  "session_id": "$SESSION_ID",
  "status": "$status",
  "current_layer": "$current_layer",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "config": {
    "layers": "$LAYER_FILTER",
    "category": "$CATEGORY_FILTER",
    "priority": "$PRIORITY_FILTER",
    "parallel": $PARALLEL_MODE,
    "cloud": $CLOUD_MODE,
    "smoke": $SMOKE_MODE,
    "nightly": $NIGHTLY_MODE,
    "coverage": $WITH_COVERAGE
  },
  "results": {
    "backend": "$([ -f "$REPORT_DIR/backend-results.json" ] && echo "completed" || echo "pending")",
    "frontend": "$([ -f "$REPORT_DIR/frontend-results.json" ] && echo "completed" || echo "pending")",
    "e2e": "$([ -f "$REPORT_DIR/e2e-results.json" ] && echo "completed" || echo "pending")"
  },
  "report_dir": "$REPORT_DIR",
  "details": $details
}
EOJSON

  # Atomic write via mv
  mv "$temp_file" "$SESSION_FILE"

  # Also update the "latest" symlink
  ln -sf "$SESSION_FILE" "$SESSION_DIR/latest.json"
}

# =============================================================================
# RESUME LOGIC
# =============================================================================

if [[ "$RESUME_MODE" == "true" ]]; then
  LATEST_SESSION="$SESSION_DIR/latest.json"
  if [[ ! -f "$LATEST_SESSION" ]]; then
    log_error "No previous session found to resume."
    exit 2
  fi

  log_info "Resuming from previous session..."
  PREV_SESSION=$(cat "$LATEST_SESSION")

  # Determine which layers need to re-run
  PREV_BACKEND=$(echo "$PREV_SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['results']['backend'])" 2>/dev/null || echo "pending")
  PREV_FRONTEND=$(echo "$PREV_SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['results']['frontend'])" 2>/dev/null || echo "pending")
  PREV_E2E=$(echo "$PREV_SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['results']['e2e'])" 2>/dev/null || echo "pending")

  # Restore report directory
  PREV_REPORT_DIR=$(echo "$PREV_SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['report_dir'])" 2>/dev/null || echo "")
  if [[ -n "$PREV_REPORT_DIR" && -d "$PREV_REPORT_DIR" ]]; then
    REPORT_DIR="$PREV_REPORT_DIR"
    log_info "Resuming into report dir: $REPORT_DIR"
  fi

  # Restore config from previous session
  PREV_LAYER=$(echo "$PREV_SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['config']['layers'])" 2>/dev/null || echo "all")
  LAYER_FILTER="$PREV_LAYER"

  # Re-resolve layers but skip completed ones
  RUN_BACKEND_LAYER=false
  RUN_FRONTEND_LAYER=false
  RUN_E2E_LAYER=false

  if [[ "$LAYER_FILTER" == "all" || "$LAYER_FILTER" == *"backend"* ]]; then
    [[ "$PREV_BACKEND" != "completed" ]] && RUN_BACKEND_LAYER=true
  fi
  if [[ "$LAYER_FILTER" == "all" || "$LAYER_FILTER" == *"frontend"* ]]; then
    [[ "$PREV_FRONTEND" != "completed" ]] && RUN_FRONTEND_LAYER=true
  fi
  if [[ "$LAYER_FILTER" == "all" || "$LAYER_FILTER" == *"e2e"* ]]; then
    [[ "$PREV_E2E" != "completed" ]] && RUN_E2E_LAYER=true
  fi

  if [[ "$RUN_BACKEND_LAYER" == "false" && "$RUN_FRONTEND_LAYER" == "false" && "$RUN_E2E_LAYER" == "false" ]]; then
    log_ok "All layers from previous session already completed. Nothing to resume."
    exit 0
  fi

  log_info "Layers to resume: backend=$RUN_BACKEND_LAYER frontend=$RUN_FRONTEND_LAYER e2e=$RUN_E2E_LAYER"
fi

# =============================================================================
# BANNER
# =============================================================================

echo ""
echo -e "${BOLD}${MAGENTA}"
echo "  ================================================================"
echo "   Flent Secured - Unified Test Orchestrator"
echo "  ================================================================"
echo -e "${NC}"
echo -e "  ${DIM}Session:   $SESSION_ID${NC}"
echo -e "  ${DIM}Layers:    $([ "$RUN_BACKEND_LAYER" == "true" ] && echo -n "backend " )$([ "$RUN_FRONTEND_LAYER" == "true" ] && echo -n "frontend " )$([ "$RUN_E2E_LAYER" == "true" ] && echo -n "e2e" )${NC}"
[[ -n "$CATEGORY_FILTER" ]] && echo -e "  ${DIM}Category:  $CATEGORY_FILTER${NC}"
[[ -n "$PRIORITY_FILTER" ]] && echo -e "  ${DIM}Priority:  $PRIORITY_FILTER${NC}"
echo -e "  ${DIM}Parallel:  $PARALLEL_MODE${NC}"
echo -e "  ${DIM}Cloud E2E: $CLOUD_MODE${NC}"
echo -e "  ${DIM}Reports:   $REPORT_DIR${NC}"
echo ""

# =============================================================================
# DRY RUN
# =============================================================================

if [[ "$DRY_RUN" == "true" ]]; then
  log_header "DRY RUN - Execution Plan"

  echo "  1. Health check: $([ "$SKIP_HEALTH" == "true" ] && echo "SKIPPED" || echo "RUN")"
  echo ""

  STEP=2
  if [[ "$PARALLEL_MODE" == "true" && "$RUN_BACKEND_LAYER" == "true" && "$RUN_FRONTEND_LAYER" == "true" ]]; then
    echo "  $STEP. Run backend + frontend IN PARALLEL"
    echo "     Backend:  timeout=${TIMEOUT_BACKEND_S}s retries=$RETRY_BACKEND"
    echo "     Frontend: timeout=${TIMEOUT_FRONTEND_S}s retries=$RETRY_FRONTEND coverage=$WITH_COVERAGE"
    STEP=$((STEP + 1))
  else
    if [[ "$RUN_BACKEND_LAYER" == "true" ]]; then
      echo "  $STEP. Run backend tests"
      echo "     Timeout: ${TIMEOUT_BACKEND_S}s, Retries: $RETRY_BACKEND"
      [[ -n "$CATEGORY_FILTER" ]] && echo "     Category filter: $CATEGORY_FILTER"
      STEP=$((STEP + 1))
    fi
    if [[ "$RUN_FRONTEND_LAYER" == "true" ]]; then
      echo "  $STEP. Run frontend tests"
      echo "     Timeout: ${TIMEOUT_FRONTEND_S}s, Retries: $RETRY_FRONTEND, Coverage: $WITH_COVERAGE"
      [[ -n "$CATEGORY_FILTER" ]] && echo "     Category filter: $CATEGORY_FILTER"
      STEP=$((STEP + 1))
    fi
  fi

  if [[ "$RUN_E2E_LAYER" == "true" ]]; then
    echo "  $STEP. Run E2E tests ($( [ "$CLOUD_MODE" == "true" ] && echo "cloud" || echo "local"))"
    echo "     Timeout: ${TIMEOUT_E2E_S}s, Retries: $RETRY_E2E"
    [[ -n "$CATEGORY_FILTER" ]] && echo "     Category filter: $CATEGORY_FILTER"
    [[ -n "$E2E_SEED_STATE" ]] && echo "     Seed: $E2E_SEED_STATE $E2E_SEED_PHONE"
    STEP=$((STEP + 1))
  fi

  echo ""
  echo "  $STEP. Generate report ($REPORT_FORMAT)"
  echo ""
  echo "  Global timeout: ${TIMEOUT_GLOBAL_S}s"
  echo ""
  log_info "Dry run complete. Remove --dry-run to execute."
  exit 0
fi

# =============================================================================
# GLOBAL TIMEOUT TRAP
# =============================================================================

GLOBAL_START_TIME=$(date +%s)

# Cleanup function for traps
cleanup() {
  local exit_code=$?
  log_warn "Cleaning up (exit code: $exit_code)..."

  # Kill any background processes
  jobs -p 2>/dev/null | xargs kill 2>/dev/null || true

  # Write final session state
  write_session "interrupted" "cleanup" "{\"exit_code\": $exit_code}"

  exit "$exit_code"
}

trap cleanup SIGINT SIGTERM

# Background global timeout monitor
(
  sleep "$TIMEOUT_GLOBAL_S"
  log_error "GLOBAL TIMEOUT: ${TIMEOUT_GLOBAL_S}s exceeded. Killing orchestrator."
  kill -TERM $$ 2>/dev/null
) &
TIMEOUT_PID=$!

# Make sure the timeout process is cleaned up on exit
trap 'kill $TIMEOUT_PID 2>/dev/null; cleanup' EXIT

# =============================================================================
# PHASE 1: HEALTH CHECK
# =============================================================================

if [[ "$SKIP_HEALTH" == "false" ]]; then
  log_header "Phase 1: Pre-flight Health Check"
  write_session "running" "health-check"

  HEALTH_ARGS=()
  if [[ "$LAYER_FILTER" != "all" ]]; then
    HEALTH_ARGS+=("--layer" "$LAYER_FILTER")
  fi

  if "$HEALTH_CHECK" "${HEALTH_ARGS[@]}"; then
    log_ok "Health check passed"
  else
    HEALTH_EXIT=$?
    if [[ $HEALTH_EXIT -eq 2 ]]; then
      log_error "Health check failed: critical prerequisites missing"
      write_session "failed" "health-check" "{\"exit_code\": 2}"
      kill $TIMEOUT_PID 2>/dev/null
      exit 3
    else
      log_warn "Health check completed with warnings"
    fi
  fi

  # Copy health check results to report dir
  if [[ -f "$SESSION_DIR/health-check.json" ]]; then
    cp "$SESSION_DIR/health-check.json" "$REPORT_DIR/health-check.json"
  fi
else
  log_info "Skipping health check (--skip-health)"
fi

# =============================================================================
# CATEGORY RESOLUTION
# =============================================================================

# Build file filter arguments for each layer based on category
BACKEND_FILE_ARGS=""
FRONTEND_CATEGORY_ARGS=""
E2E_CATEGORY_ARGS=""

if [[ -n "$CATEGORY_FILTER" ]]; then
  if [[ -f "$CATEGORY_MAP_FILE" ]]; then
    # Backend files
    BACKEND_FILES=$(python3 -c "
import json
with open('$CATEGORY_MAP_FILE') as f:
    data = json.load(f)
categories = '$CATEGORY_FILTER'.split(',')
files = []
for cat in categories:
    cat = cat.strip()
    cat_data = data.get(cat, {})
    files.extend(cat_data.get('backend', []))
print(','.join(files) if files else '')
" 2>/dev/null)

    if [[ -n "$BACKEND_FILES" ]]; then
      BACKEND_FILE_ARGS="--files $BACKEND_FILES"
    fi

    # Frontend and E2E use --category directly
    FRONTEND_CATEGORY_ARGS="--category $CATEGORY_FILTER"
    E2E_CATEGORY_ARGS="--category $CATEGORY_FILTER"
  else
    log_warn "Category map not found. Running all tests."
  fi
fi

# =============================================================================
# PHASE 2: TEST EXECUTION
# =============================================================================

BACKEND_EXIT=0
FRONTEND_EXIT=0
E2E_EXIT=0

run_backend() {
  log_header "Phase 2a: Backend Tests (Deno)"
  write_session "running" "backend"

  local args=()
  args+=("--retry" "$RETRY_BACKEND")
  args+=("--timeout" "$TIMEOUT_BACKEND_S")
  args+=("--output" "$REPORT_DIR/backend-results.json")

  if [[ -n "$BACKEND_FILE_ARGS" ]]; then
    read -ra FILE_ARGS <<< "$BACKEND_FILE_ARGS"
    args+=("${FILE_ARGS[@]}")
  fi

  [[ "$VERBOSE" == "true" ]] && args+=("--verbose")

  "$RUN_BACKEND" "${args[@]}"
  return $?
}

run_frontend() {
  log_header "Phase 2b: Frontend Tests (Jest)"
  write_session "running" "frontend"

  local args=()
  args+=("--retry" "$RETRY_FRONTEND")
  args+=("--timeout" "$TIMEOUT_FRONTEND_S")
  args+=("--output" "$REPORT_DIR/frontend-results.json")

  if [[ -n "$FRONTEND_CATEGORY_ARGS" ]]; then
    read -ra CAT_ARGS <<< "$FRONTEND_CATEGORY_ARGS"
    args+=("${CAT_ARGS[@]}")
  fi

  [[ "$WITH_COVERAGE" == "true" ]] && args+=("--coverage")
  [[ "$VERBOSE" == "true" ]] && args+=("--verbose")

  "$RUN_FRONTEND" "${args[@]}"
  return $?
}

run_e2e() {
  log_header "Phase 2c: E2E Tests (Maestro)"
  write_session "running" "e2e"

  local args=()
  args+=("--retry" "$RETRY_E2E")
  args+=("--timeout" "$TIMEOUT_E2E_S")
  args+=("--output" "$REPORT_DIR/e2e-results.json")

  [[ "$CLOUD_MODE" == "true" ]] && args+=("--cloud")

  if [[ -n "$E2E_CATEGORY_ARGS" ]]; then
    read -ra CAT_ARGS <<< "$E2E_CATEGORY_ARGS"
    args+=("${CAT_ARGS[@]}")
  fi

  if [[ -n "$E2E_SEED_STATE" ]]; then
    args+=("--seed" "$E2E_SEED_STATE" "$E2E_SEED_PHONE")
  fi

  [[ "$VERBOSE" == "true" ]] && args+=("--verbose")

  "$RUN_E2E" "${args[@]}"
  return $?
}

# -- Execute layers --

if [[ "$PARALLEL_MODE" == "true" && "$RUN_BACKEND_LAYER" == "true" && "$RUN_FRONTEND_LAYER" == "true" ]]; then
  # ==========================================
  # PARALLEL: Backend + Frontend, then E2E
  # ==========================================
  log_info "Running backend and frontend in parallel..."

  BACKEND_LOG="$REPORT_DIR/backend-stdout.log"
  FRONTEND_LOG="$REPORT_DIR/frontend-stdout.log"

  # Launch backend in background
  (run_backend > "$BACKEND_LOG" 2>&1; echo $? > "$REPORT_DIR/.backend-exit") &
  BACKEND_PID=$!

  # Launch frontend in background
  (run_frontend > "$FRONTEND_LOG" 2>&1; echo $? > "$REPORT_DIR/.frontend-exit") &
  FRONTEND_PID=$!

  # Wait for both to complete
  log_info "Waiting for parallel execution (PIDs: backend=$BACKEND_PID frontend=$FRONTEND_PID)..."
  wait $BACKEND_PID 2>/dev/null || true
  wait $FRONTEND_PID 2>/dev/null || true

  # Read exit codes
  BACKEND_EXIT=$(cat "$REPORT_DIR/.backend-exit" 2>/dev/null || echo "1")
  FRONTEND_EXIT=$(cat "$REPORT_DIR/.frontend-exit" 2>/dev/null || echo "1")

  # Print captured output
  echo ""
  echo -e "${DIM}--- Backend output ---${NC}"
  cat "$BACKEND_LOG" 2>/dev/null
  echo ""
  echo -e "${DIM}--- Frontend output ---${NC}"
  cat "$FRONTEND_LOG" 2>/dev/null
  echo ""

  # Cleanup temp files
  rm -f "$REPORT_DIR/.backend-exit" "$REPORT_DIR/.frontend-exit"

  if [[ $BACKEND_EXIT -eq 0 ]]; then
    log_ok "Backend: PASSED"
  else
    log_error "Backend: FAILED (exit $BACKEND_EXIT)"
  fi

  if [[ $FRONTEND_EXIT -eq 0 ]]; then
    log_ok "Frontend: PASSED"
  else
    log_error "Frontend: FAILED (exit $FRONTEND_EXIT)"
  fi

else
  # ==========================================
  # SEQUENTIAL: Backend -> Frontend -> E2E
  # ==========================================

  if [[ "$RUN_BACKEND_LAYER" == "true" ]]; then
    if run_backend; then
      BACKEND_EXIT=0
      log_ok "Backend: PASSED"
    else
      BACKEND_EXIT=$?
      log_error "Backend: FAILED (exit $BACKEND_EXIT)"
    fi
  fi

  if [[ "$RUN_FRONTEND_LAYER" == "true" ]]; then
    if run_frontend; then
      FRONTEND_EXIT=0
      log_ok "Frontend: PASSED"
    else
      FRONTEND_EXIT=$?
      log_error "Frontend: FAILED (exit $FRONTEND_EXIT)"
    fi
  fi
fi

# E2E always runs after backend+frontend (even in parallel mode)
if [[ "$RUN_E2E_LAYER" == "true" ]]; then
  if run_e2e; then
    E2E_EXIT=0
    log_ok "E2E: PASSED"
  else
    E2E_EXIT=$?
    log_error "E2E: FAILED (exit $E2E_EXIT)"
  fi
fi

# =============================================================================
# PHASE 3: REPORT GENERATION
# =============================================================================

log_header "Phase 3: Results & Reporting"

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - GLOBAL_START_TIME))

# Aggregate results from layer JSON files
aggregate_results() {
  python3 -c "
import json, os, glob

report_dir = '$REPORT_DIR'
results = {'backend': None, 'frontend': None, 'e2e': None}

for layer in results:
    path = os.path.join(report_dir, f'{layer}-results.json')
    if os.path.exists(path):
        try:
            with open(path) as f:
                results[layer] = json.load(f)
        except:
            results[layer] = {'status': 'error', 'error': 'Failed to parse results'}

# Calculate totals
total_passed = 0
total_failed = 0
total_skipped = 0
total_tests = 0
layers_run = 0
layers_passed = 0

for layer, data in results.items():
    if data is None:
        continue
    layers_run += 1
    summary = data.get('summary', {})
    total_passed += summary.get('total_passed', summary.get('total_pass', 0))
    total_failed += summary.get('total_failed', summary.get('total_fail', 0))
    total_skipped += summary.get('total_skipped', 0)
    total_tests += summary.get('total_tests', summary.get('total_files', summary.get('total_flows', 0)))
    if data.get('status') == 'pass':
        layers_passed += 1

overall_status = 'pass' if layers_passed == layers_run and layers_run > 0 else 'fail'

aggregate = {
    'session_id': '$SESSION_ID',
    'timestamp': '$(date -u +"%Y-%m-%dT%H:%M:%SZ")',
    'duration_seconds': $TOTAL_DURATION,
    'overall_status': overall_status,
    'summary': {
        'layers_run': layers_run,
        'layers_passed': layers_passed,
        'total_tests': total_tests,
        'total_passed': total_passed,
        'total_failed': total_failed,
        'total_skipped': total_skipped,
        'pass_rate': round((total_passed / total_tests * 100), 2) if total_tests > 0 else 0
    },
    'config': {
        'layers': '$LAYER_FILTER',
        'category': '$CATEGORY_FILTER',
        'priority': '$PRIORITY_FILTER',
        'parallel': $PARALLEL_MODE,
        'cloud_e2e': $CLOUD_MODE,
        'smoke': $SMOKE_MODE,
        'nightly': $NIGHTLY_MODE,
        'coverage': $WITH_COVERAGE
    },
    'layer_results': {
        'backend': {
            'ran': $([ "$RUN_BACKEND_LAYER" == "true" ] && echo "true" || echo "false"),
            'exit_code': $BACKEND_EXIT,
            'status': results.get('backend', {}).get('status', 'skipped') if results.get('backend') else 'skipped'
        },
        'frontend': {
            'ran': $([ "$RUN_FRONTEND_LAYER" == "true" ] && echo "true" || echo "false"),
            'exit_code': $FRONTEND_EXIT,
            'status': results.get('frontend', {}).get('status', 'skipped') if results.get('frontend') else 'skipped'
        },
        'e2e': {
            'ran': $([ "$RUN_E2E_LAYER" == "true" ] && echo "true" || echo "false"),
            'exit_code': $E2E_EXIT,
            'status': results.get('e2e', {}).get('status', 'skipped') if results.get('e2e') else 'skipped'
        }
    },
    'report_dir': report_dir
}

print(json.dumps(aggregate, indent=2))
" 2>/dev/null
}

AGGREGATE=$(aggregate_results)

if [[ -n "$AGGREGATE" ]]; then
  echo "$AGGREGATE" > "$REPORT_DIR/summary.json"
  log_info "Aggregate summary written to: $REPORT_DIR/summary.json"
else
  log_warn "Failed to generate aggregate summary"
fi

# -- HTML Report --
if [[ "$REPORT_FORMAT" == "html" ]]; then
  generate_html_report() {
    python3 -c "
import json, os

report_dir = '$REPORT_DIR'
summary_path = os.path.join(report_dir, 'summary.json')

if not os.path.exists(summary_path):
    print('No summary.json found')
    exit(1)

with open(summary_path) as f:
    data = json.load(f)

s = data.get('summary', {})
lr = data.get('layer_results', {})

status_color = '#22c55e' if data.get('overall_status') == 'pass' else '#ef4444'
status_text = 'PASSED' if data.get('overall_status') == 'pass' else 'FAILED'

def layer_badge(name, info):
    if not info.get('ran'):
        return f'<span class=\"badge skip\">{name}: SKIPPED</span>'
    color = 'pass' if info.get('status') == 'pass' else 'fail'
    return f'<span class=\"badge {color}\">{name}: {info.get(\"status\", \"?\").upper()}</span>'

html = f'''<!DOCTYPE html>
<html lang=\"en\">
<head>
<meta charset=\"UTF-8\">
<title>Flent Secured - Test Report</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #0a0a0a; color: #e5e5e5; }}
  h1 {{ color: #FF9A6D; margin-bottom: 4px; }}
  .subtitle {{ color: #878787; margin-bottom: 32px; }}
  .status {{ font-size: 28px; font-weight: bold; color: {status_color}; margin: 24px 0; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; margin: 24px 0; }}
  .card {{ background: #202020; padding: 20px; border-radius: 12px; }}
  .card .label {{ color: #878787; font-size: 13px; margin-bottom: 4px; }}
  .card .value {{ font-size: 28px; font-weight: bold; }}
  .card .value.green {{ color: #22c55e; }}
  .card .value.red {{ color: #ef4444; }}
  .card .value.yellow {{ color: #eab308; }}
  .badge {{ display: inline-block; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-right: 8px; }}
  .badge.pass {{ background: #14532d; color: #22c55e; }}
  .badge.fail {{ background: #450a0a; color: #ef4444; }}
  .badge.skip {{ background: #1a1a1a; color: #878787; }}
  .layers {{ margin: 24px 0; }}
  .meta {{ color: #555; font-size: 12px; margin-top: 40px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 16px 0; }}
  th, td {{ text-align: left; padding: 10px 12px; border-bottom: 1px solid #333; }}
  th {{ color: #878787; font-size: 12px; text-transform: uppercase; }}
</style>
</head>
<body>
<h1>Flent Secured Test Report</h1>
<p class=\"subtitle\">Session: {data.get('session_id')} | {data.get('timestamp')}</p>

<div class=\"status\">{status_text}</div>

<div class=\"grid\">
  <div class=\"card\"><div class=\"label\">Total Tests</div><div class=\"value\">{s.get('total_tests', 0)}</div></div>
  <div class=\"card\"><div class=\"label\">Passed</div><div class=\"value green\">{s.get('total_passed', 0)}</div></div>
  <div class=\"card\"><div class=\"label\">Failed</div><div class=\"value red\">{s.get('total_failed', 0)}</div></div>
  <div class=\"card\"><div class=\"label\">Pass Rate</div><div class=\"value\">{s.get('pass_rate', 0)}%</div></div>
</div>

<div class=\"grid\">
  <div class=\"card\"><div class=\"label\">Duration</div><div class=\"value\">{data.get('duration_seconds', 0)}s</div></div>
  <div class=\"card\"><div class=\"label\">Layers Run</div><div class=\"value\">{s.get('layers_run', 0)}/3</div></div>
  <div class=\"card\"><div class=\"label\">Skipped</div><div class=\"value yellow\">{s.get('total_skipped', 0)}</div></div>
  <div class=\"card\"><div class=\"label\">Layers Passed</div><div class=\"value green\">{s.get('layers_passed', 0)}/{s.get('layers_run', 0)}</div></div>
</div>

<div class=\"layers\">
  <h2>Layer Results</h2>
  {layer_badge('Backend', lr.get('backend', {}))}
  {layer_badge('Frontend', lr.get('frontend', {}))}
  {layer_badge('E2E', lr.get('e2e', {}))}
</div>

<table>
  <tr><th>Config</th><th>Value</th></tr>
  <tr><td>Layers</td><td>{data.get('config', {}).get('layers', 'all')}</td></tr>
  <tr><td>Category</td><td>{data.get('config', {}).get('category', '-') or '-'}</td></tr>
  <tr><td>Priority</td><td>{data.get('config', {}).get('priority', '-') or '-'}</td></tr>
  <tr><td>Parallel</td><td>{data.get('config', {}).get('parallel', False)}</td></tr>
  <tr><td>Cloud E2E</td><td>{data.get('config', {}).get('cloud_e2e', False)}</td></tr>
  <tr><td>Coverage</td><td>{data.get('config', {}).get('coverage', False)}</td></tr>
</table>

<p class=\"meta\">Generated by Flent Secured Test Orchestrator v1.0.0</p>
</body>
</html>'''

print(html)
" 2>/dev/null
  }

  HTML_FILE="$REPORT_DIR/report.html"
  generate_html_report > "$HTML_FILE"

  if [[ -f "$HTML_FILE" ]]; then
    log_ok "HTML report: $HTML_FILE"
  else
    log_warn "Failed to generate HTML report"
  fi
fi

# =============================================================================
# FINAL SUMMARY
# =============================================================================

# Parse the aggregate for final display
OVERALL_STATUS=$(echo "$AGGREGATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('overall_status','unknown'))" 2>/dev/null || echo "unknown")
TOTAL_TESTS=$(echo "$AGGREGATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('summary',{}).get('total_tests',0))" 2>/dev/null || echo "0")
TOTAL_PASSED=$(echo "$AGGREGATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('summary',{}).get('total_passed',0))" 2>/dev/null || echo "0")
TOTAL_FAILED=$(echo "$AGGREGATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('summary',{}).get('total_failed',0))" 2>/dev/null || echo "0")
PASS_RATE=$(echo "$AGGREGATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('summary',{}).get('pass_rate',0))" 2>/dev/null || echo "0")

STATUS_COLOR=$GREEN
STATUS_ICON="PASSED"
FINAL_EXIT=0

if [[ "$OVERALL_STATUS" != "pass" ]]; then
  STATUS_COLOR=$RED
  STATUS_ICON="FAILED"
  FINAL_EXIT=1
fi

echo ""
echo -e "${BOLD}${MAGENTA}"
echo "  ================================================================"
echo "   ORCHESTRATOR COMPLETE"
echo "  ================================================================"
echo -e "${NC}"
echo -e "  Status:     ${STATUS_COLOR}${BOLD}${STATUS_ICON}${NC}"
echo -e "  Duration:   ${TOTAL_DURATION}s ($(( TOTAL_DURATION / 60 ))m $(( TOTAL_DURATION % 60 ))s)"
echo ""
echo -e "  Tests:      $TOTAL_TESTS"
echo -e "  Passed:     ${GREEN}${TOTAL_PASSED}${NC}"
echo -e "  Failed:     ${RED}${TOTAL_FAILED}${NC}"
echo -e "  Pass rate:  ${PASS_RATE}%"
echo ""

# Layer status line
echo -n "  Layers:     "
if [[ "$RUN_BACKEND_LAYER" == "true" ]]; then
  if [[ $BACKEND_EXIT -eq 0 ]]; then
    echo -n -e "${GREEN}backend:pass${NC}  "
  else
    echo -n -e "${RED}backend:fail${NC}  "
  fi
fi
if [[ "$RUN_FRONTEND_LAYER" == "true" ]]; then
  if [[ $FRONTEND_EXIT -eq 0 ]]; then
    echo -n -e "${GREEN}frontend:pass${NC}  "
  else
    echo -n -e "${RED}frontend:fail${NC}  "
  fi
fi
if [[ "$RUN_E2E_LAYER" == "true" ]]; then
  if [[ $E2E_EXIT -eq 0 ]]; then
    echo -n -e "${GREEN}e2e:pass${NC}  "
  else
    echo -n -e "${RED}e2e:fail${NC}  "
  fi
fi
echo ""

echo ""
echo -e "  ${DIM}Report:  $REPORT_DIR/summary.json${NC}"
[[ "$REPORT_FORMAT" == "html" ]] && echo -e "  ${DIM}HTML:    $REPORT_DIR/report.html${NC}"
echo -e "  ${DIM}Session: $SESSION_FILE${NC}"
echo ""

# Write final session state
write_session "completed" "done" "{\"overall_status\": \"$OVERALL_STATUS\", \"exit_code\": $FINAL_EXIT}"

# Kill timeout monitor
kill $TIMEOUT_PID 2>/dev/null

# Determine final exit code
# If any layer returned infra/config error (2 or 3), propagate that
if [[ $BACKEND_EXIT -ge 2 || $FRONTEND_EXIT -ge 2 || $E2E_EXIT -ge 2 ]]; then
  MAX_EXIT=$BACKEND_EXIT
  [[ $FRONTEND_EXIT -gt $MAX_EXIT ]] && MAX_EXIT=$FRONTEND_EXIT
  [[ $E2E_EXIT -gt $MAX_EXIT ]] && MAX_EXIT=$E2E_EXIT
  exit $MAX_EXIT
fi

exit $FINAL_EXIT
