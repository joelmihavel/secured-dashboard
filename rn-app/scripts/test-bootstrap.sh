#!/bin/bash
# test-bootstrap.sh
#
# Prepares and validates the full test environment for Flent Secured.
# Checks prerequisites, runs type checking, tests, and optionally
# boots the simulator and installs the app.
#
# Steps:
#   1. Validate prerequisites (node, npx, xcodebuild, xcrun simctl)
#   2. npx expo doctor (warn only)
#   3. npx tsc --noEmit (TypeScript check)
#   4. npm test -- --passWithNoTests (Jest sanity)
#   5. Check simulator availability (iPhone 16 Pro)
#   6. Optionally boot simulator (--boot)
#   7. Optionally install app (--install <build_path>)
#
# Usage:
#   bash scripts/test-bootstrap.sh [--boot] [--install <path_to_app>] [--verbose]
#
# Exit codes:
#   0 = all checks passed
#   1 = blocking failure

set -euo pipefail

# -------------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SIMULATOR_NAME="iPhone 16 Pro"
SIMULATOR_UDID="EA52887A-365C-495B-8618-16FBEE0E0990"
BUNDLE_ID="com.flent.secured"

BOOT_SIMULATOR=false
INSTALL_APP=false
INSTALL_PATH=""
VERBOSE=false

# Parse flags
while [[ $# -gt 0 ]]; do
  case $1 in
    --boot)
      BOOT_SIMULATOR=true
      shift
      ;;
    --install)
      INSTALL_APP=true
      INSTALL_PATH="${2:-}"
      if [ -z "$INSTALL_PATH" ]; then
        echo "ERROR: --install requires a path argument"
        echo "Usage: --install <path_to_.app>"
        exit 1
      fi
      shift 2
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: bash scripts/test-bootstrap.sh [--boot] [--install <path>] [--verbose]"
      echo ""
      echo "Options:"
      echo "  --boot             Boot iPhone 16 Pro simulator if not running"
      echo "  --install <path>   Install .app bundle to simulator"
      echo "  --verbose          Show detailed output"
      echo "  --help             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown flag: $1"
      exit 1
      ;;
  esac
done

# -------------------------------------------------------------------------
# Colors and formatting
# -------------------------------------------------------------------------

RESET='\033[0m'
BOLD='\033[1m'
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
CYAN='\033[36m'
DIM='\033[2m'

check_num=0
pass_count=0
warn_count=0
fail_count=0

timestamp() {
  date "+%H:%M:%S"
}

check() {
  check_num=$((check_num + 1))
  echo ""
  echo -e "${BOLD}${BLUE}[$(timestamp)] Check ${check_num}: $1${RESET}"
  echo -e "${DIM}$(printf '%.0s-' {1..60})${RESET}"
}

ok() {
  echo -e "${GREEN}  [PASS] $1${RESET}"
  pass_count=$((pass_count + 1))
}

warn() {
  echo -e "${YELLOW}  [WARN] $1${RESET}"
  warn_count=$((warn_count + 1))
}

fail() {
  echo -e "${RED}  [FAIL] $1${RESET}"
  fail_count=$((fail_count + 1))
}

info() {
  echo -e "${CYAN}  [INFO] $1${RESET}"
}

# -------------------------------------------------------------------------
# Trap for cleanup
# -------------------------------------------------------------------------

cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ] && [ $exit_code -ne 130 ]; then
    echo ""
    fail "Test bootstrap exited with code $exit_code"
  fi
}

trap cleanup EXIT

# -------------------------------------------------------------------------
# Start
# -------------------------------------------------------------------------

echo ""
echo -e "${BOLD}${CYAN}===============================================${RESET}"
echo -e "${BOLD}${CYAN}  Flent Secured -- Test Bootstrap${RESET}"
echo -e "${BOLD}${CYAN}===============================================${RESET}"
echo -e "${DIM}  Project root: $PROJECT_ROOT${RESET}"
echo -e "${DIM}  Timestamp:    $(date '+%Y-%m-%d %H:%M:%S')${RESET}"

# -------------------------------------------------------------------------
# Check 1: Prerequisites
# -------------------------------------------------------------------------

check "Prerequisites"

# node
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version)
  ok "node: $NODE_VERSION"
else
  fail "node not found in PATH"
fi

# npx
if command -v npx &>/dev/null; then
  NPX_VERSION=$(npx --version 2>/dev/null || echo "unknown")
  ok "npx: $NPX_VERSION"
else
  fail "npx not found in PATH"
fi

# xcodebuild
if command -v xcodebuild &>/dev/null; then
  XCODE_VERSION=$(xcodebuild -version 2>/dev/null | head -1 || echo "unknown")
  ok "xcodebuild: $XCODE_VERSION"
else
  fail "xcodebuild not found (install Xcode Command Line Tools)"
fi

# xcrun simctl
if xcrun simctl list devices &>/dev/null; then
  ok "xcrun simctl: available"
else
  fail "xcrun simctl not functional"
fi

# Check node_modules exist
if [ -d "$PROJECT_ROOT/node_modules" ]; then
  ok "node_modules: present"
else
  fail "node_modules not found -- run npm install first"
fi

# -------------------------------------------------------------------------
# Check 2: Expo Doctor
# -------------------------------------------------------------------------

check "Expo Doctor"

set +e
EXPO_DOCTOR_OUTPUT=$(cd "$PROJECT_ROOT" && npx expo doctor 2>&1)
EXPO_DOCTOR_EXIT=$?
set -e

if [ $EXPO_DOCTOR_EXIT -eq 0 ]; then
  ok "expo doctor: no issues"
else
  warn "expo doctor reported issues (non-blocking)"
  if [ "$VERBOSE" = true ]; then
    echo "$EXPO_DOCTOR_OUTPUT" | head -20 | while IFS= read -r line; do
      echo -e "${DIM}    $line${RESET}"
    done
  fi
fi

# -------------------------------------------------------------------------
# Check 3: TypeScript
# -------------------------------------------------------------------------

check "TypeScript (tsc --noEmit)"

set +e
TSC_OUTPUT=$(cd "$PROJECT_ROOT" && npx tsc --noEmit 2>&1)
TSC_EXIT=$?
set -e

if [ $TSC_EXIT -eq 0 ]; then
  ok "TypeScript: no errors"
else
  ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep -c "error TS" || echo "0")
  fail "TypeScript: $ERROR_COUNT error(s)"
  if [ "$VERBOSE" = true ]; then
    echo "$TSC_OUTPUT" | grep "error TS" | head -20 | while IFS= read -r line; do
      echo -e "${DIM}    $line${RESET}"
    done
    if [ "$ERROR_COUNT" -gt 20 ]; then
      info "... and $((ERROR_COUNT - 20)) more (run npx tsc --noEmit to see all)"
    fi
  else
    echo "$TSC_OUTPUT" | grep "error TS" | head -5 | while IFS= read -r line; do
      echo -e "${DIM}    $line${RESET}"
    done
    if [ "$ERROR_COUNT" -gt 5 ]; then
      info "... ($ERROR_COUNT total -- use --verbose to see more)"
    fi
  fi
fi

# -------------------------------------------------------------------------
# Check 4: Jest
# -------------------------------------------------------------------------

check "Jest (npm test -- --passWithNoTests)"

set +e
JEST_OUTPUT=$(cd "$PROJECT_ROOT" && npm test -- --passWithNoTests --forceExit 2>&1)
JEST_EXIT=$?
set -e

if [ $JEST_EXIT -eq 0 ]; then
  # Extract test summary if available
  SUMMARY=$(echo "$JEST_OUTPUT" | grep -E "Tests:|Test Suites:" | tail -2)
  if [ -n "$SUMMARY" ]; then
    ok "Jest: passed"
    echo "$SUMMARY" | while IFS= read -r line; do
      echo -e "${DIM}    $line${RESET}"
    done
  else
    ok "Jest: passed (no output summary)"
  fi
else
  FAILED_TESTS=$(echo "$JEST_OUTPUT" | grep -c "FAIL " || echo "0")
  fail "Jest: $FAILED_TESTS suite(s) failed"
  if [ "$VERBOSE" = true ]; then
    echo "$JEST_OUTPUT" | grep -A2 "FAIL " | head -30 | while IFS= read -r line; do
      echo -e "${DIM}    $line${RESET}"
    done
  fi
fi

# -------------------------------------------------------------------------
# Check 5: Simulator Availability
# -------------------------------------------------------------------------

check "Simulator Availability ($SIMULATOR_NAME)"

SIMCTL_OUTPUT=$(xcrun simctl list devices 2>/dev/null)
SIMULATOR_ENTRY=$(echo "$SIMCTL_OUTPUT" | grep "$SIMULATOR_NAME" | head -1)

if [ -n "$SIMULATOR_ENTRY" ]; then
  ok "Simulator found: $SIMULATOR_ENTRY"

  # Check if it is the expected UDID
  if echo "$SIMULATOR_ENTRY" | grep -q "$SIMULATOR_UDID"; then
    ok "UDID matches: $SIMULATOR_UDID"
  else
    warn "UDID does not match expected: $SIMULATOR_UDID"
    ACTUAL_UDID=$(echo "$SIMULATOR_ENTRY" | grep -oE '[A-F0-9-]{36}' | head -1)
    if [ -n "$ACTUAL_UDID" ]; then
      info "Actual UDID: $ACTUAL_UDID"
    fi
  fi

  # Check boot status
  if echo "$SIMULATOR_ENTRY" | grep -q "(Booted)"; then
    ok "Simulator is booted"
  else
    info "Simulator is not booted"
  fi
else
  fail "Simulator '$SIMULATOR_NAME' not found"
  info "Available simulators:"
  echo "$SIMCTL_OUTPUT" | grep "iPhone" | head -5 | while IFS= read -r line; do
    echo -e "${DIM}    $line${RESET}"
  done
fi

# -------------------------------------------------------------------------
# Optional: Boot Simulator
# -------------------------------------------------------------------------

if [ "$BOOT_SIMULATOR" = true ]; then
  check "Boot Simulator"

  # Check if already booted
  if echo "$SIMULATOR_ENTRY" | grep -q "(Booted)" 2>/dev/null; then
    ok "Simulator already booted"
  else
    info "Booting $SIMULATOR_NAME ($SIMULATOR_UDID)..."
    set +e
    xcrun simctl boot "$SIMULATOR_UDID" 2>&1
    BOOT_EXIT=$?
    set -e

    if [ $BOOT_EXIT -eq 0 ]; then
      ok "Simulator booted successfully"
    elif [ $BOOT_EXIT -eq 149 ]; then
      # Exit code 149 = "Unable to boot device in current state: Booted"
      ok "Simulator was already booted"
    else
      fail "Failed to boot simulator (exit $BOOT_EXIT)"
    fi

    # Open Simulator.app for visibility
    open -a Simulator 2>/dev/null || true
    info "Waiting 3 seconds for simulator to initialize..."
    sleep 3
  fi
fi

# -------------------------------------------------------------------------
# Optional: Install App
# -------------------------------------------------------------------------

if [ "$INSTALL_APP" = true ]; then
  check "Install App to Simulator"

  if [ ! -d "$INSTALL_PATH" ] && [ ! -f "$INSTALL_PATH" ]; then
    # Try default build path
    DEFAULT_APP="$PROJECT_ROOT/ios/build/Build/Products/Debug-iphonesimulator/FlentSecured.app"
    if [ -d "$DEFAULT_APP" ]; then
      info "Provided path not found, using default: $DEFAULT_APP"
      INSTALL_PATH="$DEFAULT_APP"
    else
      fail "App bundle not found at: $INSTALL_PATH"
      fail "Default path also missing: $DEFAULT_APP"
    fi
  fi

  if [ -d "$INSTALL_PATH" ] || [ -f "$INSTALL_PATH" ]; then
    info "Installing to $SIMULATOR_UDID..."
    set +e
    xcrun simctl install "$SIMULATOR_UDID" "$INSTALL_PATH" 2>&1
    INSTALL_EXIT=$?
    set -e

    if [ $INSTALL_EXIT -eq 0 ]; then
      ok "App installed successfully"
      info "Launch with: xcrun simctl launch $SIMULATOR_UDID $BUNDLE_ID"
    else
      fail "App installation failed (exit $INSTALL_EXIT)"
    fi
  fi
fi

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------

echo ""
echo -e "${BOLD}${CYAN}===============================================${RESET}"
echo -e "${BOLD}${CYAN}  Test Bootstrap Summary${RESET}"
echo -e "${BOLD}${CYAN}===============================================${RESET}"
echo -e "${DIM}  Finished: $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo ""

if [ $fail_count -eq 0 ]; then
  echo -e "${GREEN}  ${BOLD}ALL CHECKS PASSED${RESET}"
else
  echo -e "${RED}  ${BOLD}$fail_count CHECK(S) FAILED${RESET}"
fi

echo -e "${DIM}  Passed:   $pass_count${RESET}"
echo -e "${DIM}  Warnings: $warn_count${RESET}"
echo -e "${DIM}  Failed:   $fail_count${RESET}"
echo ""

if [ $fail_count -gt 0 ]; then
  exit 1
fi
exit 0
