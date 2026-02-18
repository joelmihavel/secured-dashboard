#!/usr/bin/env bash
# =============================================================================
# TE-122: Maestro Cloud Pipeline Runner
#
# Triggers Maestro Cloud test runs for the Flent Secured app.
# Supports both iOS (.app/.ipa) and Android (.apk) binaries.
#
# Usage:
#   ./maestro/run-cloud.sh                     # Auto-detect app binary
#   ./maestro/run-cloud.sh path/to/app.ipa     # Explicit binary path
#   ./maestro/run-cloud.sh --local             # Run locally (not cloud)
#   ./maestro/run-cloud.sh --flows-only        # Run screen flows only
#   ./maestro/run-cloud.sh --journeys-only     # Run journey flows only
#
# Environment variables:
#   MAESTRO_CLOUD_API_KEY  - API key for Maestro Cloud (required for cloud)
#   APP_BINARY             - Path to app binary (optional, auto-detected)
#   MAESTRO_TIMEOUT        - Per-flow timeout in seconds (default: 120)
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
APP_ID="com.flent.secured"
TIMEOUT="${MAESTRO_TIMEOUT:-120}"

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# -- Parse arguments --
MODE="cloud"
FLOW_SCOPE="all"
APP_BINARY="${APP_BINARY:-}"

for arg in "$@"; do
  case "$arg" in
    --local)
      MODE="local"
      ;;
    --flows-only)
      FLOW_SCOPE="flows"
      ;;
    --journeys-only)
      FLOW_SCOPE="journeys"
      ;;
    --help|-h)
      echo "Usage: $0 [app-binary] [--local] [--flows-only] [--journeys-only]"
      echo ""
      echo "Options:"
      echo "  --local           Run tests locally instead of Maestro Cloud"
      echo "  --flows-only      Run only screen-level functional flows"
      echo "  --journeys-only   Run only end-to-end journey flows"
      echo "  --help            Show this help message"
      echo ""
      echo "Environment variables:"
      echo "  MAESTRO_CLOUD_API_KEY  API key for Maestro Cloud"
      echo "  APP_BINARY             Path to app binary"
      echo "  MAESTRO_TIMEOUT        Per-flow timeout (default: 120s)"
      exit 0
      ;;
    *)
      # Treat as app binary path if it looks like a file
      if [[ -f "$arg" ]]; then
        APP_BINARY="$arg"
      fi
      ;;
  esac
done

# -- Check prerequisites --
log_info "Checking prerequisites..."

if ! command -v maestro &> /dev/null; then
  log_error "Maestro CLI not found. Install with: curl -Ls 'https://get.maestro.mobile.dev' | bash"
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
fi

# -- Determine which flows to run --
declare -a TEST_DIRS=()

case "$FLOW_SCOPE" in
  flows)
    TEST_DIRS=("$FLOW_DIR")
    log_info "Running screen-level functional flows only"
    ;;
  journeys)
    TEST_DIRS=("$JOURNEY_DIR")
    log_info "Running end-to-end journey flows only"
    ;;
  all)
    TEST_DIRS=("$FLOW_DIR" "$JOURNEY_DIR")
    log_info "Running all flows (screens + journeys)"
    ;;
esac

# -- Count flows --
TOTAL_FLOWS=0
for dir in "${TEST_DIRS[@]}"; do
  COUNT=$(find "$dir" -name "*.yaml" -type f 2>/dev/null | wc -l | tr -d ' ')
  TOTAL_FLOWS=$((TOTAL_FLOWS + COUNT))
done
log_info "Total flows to execute: $TOTAL_FLOWS"

# -- Execute tests --
if [[ "$MODE" == "local" ]]; then
  # ==========================================
  # LOCAL EXECUTION
  # ==========================================
  log_info "Running Maestro tests locally..."

  PASS=0
  FAIL=0
  ERRORS=()

  for dir in "${TEST_DIRS[@]}"; do
    for flow in $(find "$dir" -name "*.yaml" -type f | sort); do
      FLOW_NAME=$(basename "$flow" .yaml)
      FLOW_REL=$(echo "$flow" | sed "s|$MAESTRO_DIR/||")
      log_info "Running: $FLOW_REL"

      if maestro test "$flow" --env APP_ID="$APP_ID" --env TEST_PHONE="9876543210" --env TEST_NAME="Test User" --env TEST_OTP="123456" 2>&1; then
        log_ok "PASS: $FLOW_REL"
        PASS=$((PASS + 1))
      else
        log_error "FAIL: $FLOW_REL"
        FAIL=$((FAIL + 1))
        ERRORS+=("$FLOW_REL")
      fi
    done
  done

  # -- Results summary --
  echo ""
  echo "============================================"
  echo "  Maestro E2E Test Results"
  echo "============================================"
  echo "  Total:  $TOTAL_FLOWS"
  echo "  Passed: $PASS"
  echo "  Failed: $FAIL"
  echo "============================================"

  if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo ""
    log_error "Failed flows:"
    for err in "${ERRORS[@]}"; do
      echo "  - $err"
    done
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
    log_info "Get your API key at https://cloud.mobile.dev/"
    log_info "Or run locally with: $0 --local"
    exit 2
  fi

  if [[ -z "$APP_BINARY" ]]; then
    log_error "No app binary found. Provide a path or set APP_BINARY."
    log_info "Build with: cd rn-app && npx expo run:ios"
    log_info "Or: cd rn-app && eas build --platform ios --profile preview"
    exit 2
  fi

  log_info "Uploading to Maestro Cloud..."
  log_info "App binary: $APP_BINARY"

  # Build the flow arguments
  FLOW_ARGS=""
  for dir in "${TEST_DIRS[@]}"; do
    FLOW_ARGS="$FLOW_ARGS $dir"
  done

  # Execute on Maestro Cloud
  maestro cloud \
    --apiKey "$MAESTRO_CLOUD_API_KEY" \
    --app-file "$APP_BINARY" \
    --timeout "$TIMEOUT" \
    --env APP_ID="$APP_ID" \
    --env TEST_PHONE="9876543210" \
    --env TEST_NAME="Test User" \
    --env TEST_OTP="123456" \
    --env CI="true" \
    $FLOW_ARGS

  EXIT_CODE=$?

  if [[ $EXIT_CODE -eq 0 ]]; then
    log_ok "Maestro Cloud run completed successfully."
  else
    log_error "Maestro Cloud run completed with failures (exit code: $EXIT_CODE)."
  fi

  exit $EXIT_CODE
fi
