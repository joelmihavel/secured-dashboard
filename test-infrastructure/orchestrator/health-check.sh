#!/bin/bash
# =============================================================================
# Pre-flight Health Check for Flent Secured Test Orchestrator
#
# Verifies all prerequisites before a test run. Returns structured JSON.
# Compatible with bash 3.2+ (macOS default).
#
# Usage:
#   ./test-infrastructure/orchestrator/health-check.sh               # Check all
#   ./test-infrastructure/orchestrator/health-check.sh --layer backend   # Backend only
#   ./test-infrastructure/orchestrator/health-check.sh --layer frontend  # Frontend only
#   ./test-infrastructure/orchestrator/health-check.sh --layer e2e       # E2E only
#   ./test-infrastructure/orchestrator/health-check.sh --json            # JSON output only
#   ./test-infrastructure/orchestrator/health-check.sh --strict          # Fail on any warning
#
# Exit codes:
#   0 - All required checks pass
#   2 - Critical prerequisite missing
#   3 - Infrastructure issue detected
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RN_APP_DIR="$PROJECT_ROOT/rn-app"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# -- Parse arguments --
LAYER_FILTER="all"
JSON_ONLY=false
STRICT_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --layer)
      LAYER_FILTER="$2"
      shift 2
      ;;
    --json)
      JSON_ONLY=true
      shift
      ;;
    --strict)
      STRICT_MODE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--layer backend|frontend|e2e] [--json] [--strict]"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

# -- Logging (suppressed in JSON mode) --
log_info()  { [[ "$JSON_ONLY" == "false" ]] && echo -e "${BLUE}[CHECK]${NC} $*"; return 0; }
log_ok()    { [[ "$JSON_ONLY" == "false" ]] && echo -e "${GREEN}  [OK]${NC} $*"; return 0; }
log_warn()  { [[ "$JSON_ONLY" == "false" ]] && echo -e "${YELLOW}  [WARN]${NC} $*"; return 0; }
log_fail()  { [[ "$JSON_ONLY" == "false" ]] && echo -e "${RED}  [FAIL]${NC} $*"; return 0; }
log_skip()  { [[ "$JSON_ONLY" == "false" ]] && echo -e "${CYAN}  [SKIP]${NC} $*"; return 0; }

# -- Result accumulator (bash 3.2 compatible: parallel arrays) --
CHECK_NAMES=()
CHECK_STATUSES=()
CHECK_DETAILS=()
CHECK_VERSIONS=()
ERRORS=0
WARNINGS=0
TOTAL_CHECKS=0

record_check() {
  local name="$1"
  local status="$2"
  local detail="${3:-}"
  local version="${4:-}"

  CHECK_NAMES+=("$name")
  CHECK_STATUSES+=("$status")
  CHECK_DETAILS+=("$detail")
  CHECK_VERSIONS+=("$version")
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if [[ "$status" == "fail" ]]; then
    ERRORS=$((ERRORS + 1))
  elif [[ "$status" == "warn" ]]; then
    WARNINGS=$((WARNINGS + 1))
  fi
}

needs_layer() {
  local layer="$1"
  [[ "$LAYER_FILTER" == "all" || "$LAYER_FILTER" == *"$layer"* ]]
}

# =============================================================================
# CHECK: Project structure
# =============================================================================
log_info "Checking project structure..."

if [[ -d "$PROJECT_ROOT" ]]; then
  record_check "project_root" "ok" "$PROJECT_ROOT"
  log_ok "Project root: $PROJECT_ROOT"
else
  record_check "project_root" "fail" "Project root not found"
  log_fail "Project root not found: $PROJECT_ROOT"
fi

if [[ -f "$CONFIG_FILE" ]]; then
  record_check "config_file" "ok" "$CONFIG_FILE"
  log_ok "Config file: $CONFIG_FILE"
else
  record_check "config_file" "fail" "Config file not found"
  log_fail "Config file not found: $CONFIG_FILE"
fi

# =============================================================================
# CHECK: Node.js / npm
# =============================================================================
if needs_layer "frontend"; then
  log_info "Checking Node.js and npm..."

  if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
    record_check "node" "ok" "Node.js available" "$NODE_VERSION"
    log_ok "Node.js: $NODE_VERSION"
  else
    record_check "node" "fail" "Node.js not installed"
    log_fail "Node.js not found. Install via: https://nodejs.org/"
  fi

  if command -v npm &>/dev/null; then
    NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
    record_check "npm" "ok" "npm available" "$NPM_VERSION"
    log_ok "npm: $NPM_VERSION"
  else
    record_check "npm" "fail" "npm not installed"
    log_fail "npm not found"
  fi

  # Check node_modules exist
  if [[ -d "$RN_APP_DIR/node_modules" ]]; then
    record_check "node_modules" "ok" "Dependencies installed"
    log_ok "node_modules present"
  else
    record_check "node_modules" "fail" "Run: cd rn-app && npm install"
    log_fail "node_modules missing. Run: cd rn-app && npm install"
  fi

  # Check Jest is available
  if [[ -f "$RN_APP_DIR/node_modules/.bin/jest" ]]; then
    JEST_VERSION=$("$RN_APP_DIR/node_modules/.bin/jest" --version 2>/dev/null || echo "unknown")
    record_check "jest" "ok" "Jest available" "$JEST_VERSION"
    log_ok "Jest: $JEST_VERSION"
  else
    record_check "jest" "fail" "Jest not found in node_modules"
    log_fail "Jest not found. Run: cd rn-app && npm install"
  fi

  # Check jest.config.js
  if [[ -f "$RN_APP_DIR/jest.config.js" ]]; then
    record_check "jest_config" "ok" "jest.config.js found"
    log_ok "jest.config.js present"
  else
    record_check "jest_config" "fail" "jest.config.js not found"
    log_fail "jest.config.js not found in rn-app/"
  fi
fi

# =============================================================================
# CHECK: Deno
# =============================================================================
if needs_layer "backend"; then
  log_info "Checking Deno..."

  if command -v deno &>/dev/null; then
    DENO_VERSION=$(deno --version 2>/dev/null | head -1 || echo "unknown")
    record_check "deno" "ok" "Deno available" "$DENO_VERSION"
    log_ok "Deno: $DENO_VERSION"
  else
    record_check "deno" "fail" "Deno not installed. Install via: https://deno.land/"
    log_fail "Deno not found. Install via: curl -fsSL https://deno.land/install.sh | sh"
  fi

  # Check backend test directory
  BACKEND_TEST_DIR="$PROJECT_ROOT/supabase/functions/_tests"
  if [[ -d "$BACKEND_TEST_DIR" ]]; then
    BACKEND_TEST_COUNT=$(find "$BACKEND_TEST_DIR" -name "*.test.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
    record_check "backend_tests" "ok" "$BACKEND_TEST_COUNT test files found"
    log_ok "Backend test files: $BACKEND_TEST_COUNT"
  else
    record_check "backend_tests" "fail" "Backend test directory not found"
    log_fail "Backend test directory not found: $BACKEND_TEST_DIR"
  fi
fi

# =============================================================================
# CHECK: Supabase local instance
# =============================================================================
if needs_layer "backend"; then
  log_info "Checking Supabase local instance..."

  SUPABASE_LOCAL_URL="http://127.0.0.1:54321"

  # Check if Supabase CLI is installed
  if command -v supabase &>/dev/null; then
    SUPABASE_VERSION=$(supabase --version 2>/dev/null || echo "unknown")
    record_check "supabase_cli" "ok" "Supabase CLI available" "$SUPABASE_VERSION"
    log_ok "Supabase CLI: $SUPABASE_VERSION"
  else
    record_check "supabase_cli" "warn" "Supabase CLI not installed"
    log_warn "Supabase CLI not found. Backend tests may use env vars directly."
  fi

  # Check if local Supabase is running
  HTTP_STATUS=""
  if HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$SUPABASE_LOCAL_URL/rest/v1/" 2>/dev/null); then
    : # curl succeeded
  fi
  HTTP_STATUS=$(echo "$HTTP_STATUS" | tr -d '[:space:]')
  [[ -z "$HTTP_STATUS" ]] && HTTP_STATUS="000"

  if [[ "$HTTP_STATUS" != "000" ]]; then
    record_check "supabase_local" "ok" "$SUPABASE_LOCAL_URL" "HTTP $HTTP_STATUS"
    log_ok "Supabase local running: $SUPABASE_LOCAL_URL (HTTP $HTTP_STATUS)"
  else
    record_check "supabase_local" "warn" "Supabase local not running. Start with: supabase start"
    log_warn "Supabase local not responding. Start with: supabase start"
  fi

  # Check env vars for backend tests
  if [[ -n "${SUPABASE_URL:-}" ]]; then
    record_check "env_supabase_url" "ok" "$SUPABASE_URL"
    log_ok "SUPABASE_URL: set"
  else
    record_check "env_supabase_url" "warn" "Not set; will default to local"
    log_warn "SUPABASE_URL not set; backend tests will default to $SUPABASE_LOCAL_URL"
  fi
fi

# =============================================================================
# CHECK: Maestro CLI
# =============================================================================
if needs_layer "e2e"; then
  log_info "Checking Maestro CLI..."

  if command -v maestro &>/dev/null; then
    MAESTRO_VERSION=$(maestro --version 2>/dev/null || echo "unknown")
    record_check "maestro" "ok" "Maestro CLI available" "$MAESTRO_VERSION"
    log_ok "Maestro CLI: $MAESTRO_VERSION"
  else
    record_check "maestro" "fail" "Maestro CLI not installed"
    log_fail "Maestro CLI not found. Install: curl -Ls 'https://get.maestro.mobile.dev' | bash"
  fi

  # Check E2E flow directory
  E2E_FLOW_DIR="$PROJECT_ROOT/maestro/flows"
  if [[ -d "$E2E_FLOW_DIR" ]]; then
    E2E_FLOW_COUNT=$(find "$E2E_FLOW_DIR" -name "*.yaml" -type f 2>/dev/null | wc -l | tr -d ' ')
    E2E_JOURNEY_COUNT=$(find "$PROJECT_ROOT/maestro/journeys" -name "*.yaml" -type f 2>/dev/null | wc -l | tr -d ' ')
    TOTAL_E2E=$((E2E_FLOW_COUNT + E2E_JOURNEY_COUNT))
    record_check "e2e_flows" "ok" "$E2E_FLOW_COUNT flows + $E2E_JOURNEY_COUNT journeys"
    log_ok "E2E flows: $E2E_FLOW_COUNT flows + $E2E_JOURNEY_COUNT journeys = $TOTAL_E2E total"
  else
    record_check "e2e_flows" "fail" "E2E flow directory not found"
    log_fail "E2E flow directory not found: $E2E_FLOW_DIR"
  fi
fi

# =============================================================================
# CHECK: iOS Simulator (for E2E)
# =============================================================================
if needs_layer "e2e"; then
  log_info "Checking iOS Simulator..."

  if command -v xcrun &>/dev/null; then
    # Check if any simulator is booted
    BOOTED_DEVICE=$(xcrun simctl list devices 2>/dev/null | grep -i "booted" | head -1 || echo "")
    if [[ -n "$BOOTED_DEVICE" ]]; then
      DEVICE_NAME=$(echo "$BOOTED_DEVICE" | sed 's/^[[:space:]]*//' | sed 's/ (.*//')
      record_check "simulator" "ok" "$DEVICE_NAME" "Booted"
      log_ok "iOS Simulator: $DEVICE_NAME (Booted)"
    else
      record_check "simulator" "warn" "No simulator booted. Boot with: xcrun simctl boot <device>"
      log_warn "No iOS simulator booted. Boot one before running E2E tests."
    fi
  else
    record_check "simulator" "warn" "Xcode command line tools not found"
    log_warn "xcrun not found. iOS simulator checks skipped."
  fi
fi

# =============================================================================
# CHECK: App installed on simulator (for E2E)
# =============================================================================
if needs_layer "e2e"; then
  log_info "Checking app installation..."

  APP_BUNDLE_ID="com.flent.secured"

  if command -v xcrun &>/dev/null; then
    BOOTED_UDID=$(xcrun simctl list devices 2>/dev/null | grep -i "booted" | grep -oE '[A-F0-9-]{36}' | head -1 || echo "")
    if [[ -n "$BOOTED_UDID" ]]; then
      # Check if the app is installed
      APP_CONTAINER=$(xcrun simctl get_app_container "$BOOTED_UDID" "$APP_BUNDLE_ID" 2>/dev/null || echo "")
      if [[ -n "$APP_CONTAINER" ]]; then
        record_check "app_installed" "ok" "$APP_BUNDLE_ID" "$APP_CONTAINER"
        log_ok "App installed: $APP_BUNDLE_ID"
      else
        record_check "app_installed" "warn" "App not installed. Build and install first."
        log_warn "App ($APP_BUNDLE_ID) not installed on booted simulator."
      fi
    else
      record_check "app_installed" "skip" "No booted simulator to check"
      log_skip "App install check skipped: no booted simulator."
    fi
  else
    record_check "app_installed" "skip" "Xcode tools not available"
    log_skip "App install check skipped: xcrun not available."
  fi
fi

# =============================================================================
# CHECK: Disk space
# =============================================================================
log_info "Checking disk space..."

AVAILABLE_KB=$(df -k "$PROJECT_ROOT" 2>/dev/null | tail -1 | awk '{print $4}')
if [[ -n "$AVAILABLE_KB" ]]; then
  AVAILABLE_GB=$(echo "scale=1; $AVAILABLE_KB / 1048576" | bc 2>/dev/null || echo "unknown")
  if [[ "$AVAILABLE_KB" -gt 1048576 ]]; then
    record_check "disk_space" "ok" "${AVAILABLE_GB}GB available"
    log_ok "Disk space: ${AVAILABLE_GB}GB available"
  else
    record_check "disk_space" "warn" "Low disk space: ${AVAILABLE_GB}GB"
    log_warn "Low disk space: ${AVAILABLE_GB}GB available (recommend >1GB)"
  fi
else
  record_check "disk_space" "warn" "Could not determine disk space"
  log_warn "Could not determine available disk space"
fi

# =============================================================================
# OUTPUT: JSON result (using python3 for reliable JSON generation)
# =============================================================================
generate_json() {
  python3 -c "
import json, sys

names = $(printf '%s\n' "${CHECK_NAMES[@]}" | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))")
statuses = $(printf '%s\n' "${CHECK_STATUSES[@]}" | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))")
details = $(printf '%s\n' "${CHECK_DETAILS[@]}" | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))")
versions = $(printf '%s\n' "${CHECK_VERSIONS[@]}" | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))")

checks = {}
for i in range(len(names)):
    entry = {'status': statuses[i], 'detail': details[i]}
    if versions[i]:
        entry['version'] = versions[i]
    checks[names[i]] = entry

errors = $ERRORS
warnings = $WARNINGS
strict = '$STRICT_MODE' == 'true'

verdict = 'pass'
if errors > 0:
    verdict = 'fail'
elif warnings > 0 and strict:
    verdict = 'fail'

import datetime
result = {
    'timestamp': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    'layer_filter': '$LAYER_FILTER',
    'errors': errors,
    'warnings': warnings,
    'checks': checks,
    'verdict': verdict
}

print(json.dumps(result, indent=2))
" 2>/dev/null
}

# =============================================================================
# SUMMARY
# =============================================================================
PASSED_CHECKS=$((TOTAL_CHECKS - ERRORS - WARNINGS))

if [[ "$JSON_ONLY" == "false" ]]; then
  echo ""
  echo -e "${BOLD}========================================${NC}"
  echo -e "${BOLD}  Health Check Summary${NC}"
  echo -e "${BOLD}========================================${NC}"
  echo -e "  Checks passed: ${GREEN}${PASSED_CHECKS}${NC}"
  echo -e "  Warnings:      ${YELLOW}$WARNINGS${NC}"
  echo -e "  Errors:        ${RED}$ERRORS${NC}"
  echo -e "${BOLD}========================================${NC}"
fi

JSON_OUTPUT=$(generate_json)

if [[ "$JSON_ONLY" == "true" ]]; then
  echo "$JSON_OUTPUT"
else
  # Write JSON to session directory for other scripts to consume
  mkdir -p "$SCRIPT_DIR/.session"
  HEALTH_FILE="$SCRIPT_DIR/.session/health-check.json"
  echo "$JSON_OUTPUT" > "$HEALTH_FILE"
  echo ""
  echo -e "${BLUE}[INFO]${NC} Health check JSON written to: $HEALTH_FILE"
fi

# =============================================================================
# EXIT CODE
# =============================================================================
if [[ $ERRORS -gt 0 ]]; then
  exit 2
fi

if [[ $WARNINGS -gt 0 && "$STRICT_MODE" == "true" ]]; then
  exit 3
fi

exit 0
