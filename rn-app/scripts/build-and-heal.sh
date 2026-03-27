#!/bin/bash
# build-and-heal.sh
#
# Self-healing iOS build pipeline for the Flent Secured React Native/Expo app.
# Handles the spaces-in-path problem and known CocoaPods/Xcode pitfalls.
#
# Steps:
#   1. npx expo prebuild --clean
#   2. Run fix-spaces-in-path.js (Node patch script)
#   3. cd ios && pod install
#   4. xcodebuild verify compilation
#   5. On failure: capture error, attempt known fix patterns, retry once
#
# Usage:
#   bash scripts/build-and-heal.sh [--skip-prebuild] [--skip-pods] [--verbose]
#
# Exit codes:
#   0 = success
#   1 = build failed after retry

set -euo pipefail

# -------------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$PROJECT_ROOT/ios"
PATCH_SCRIPT="$SCRIPT_DIR/patches/fix-spaces-in-path.js"
FIX_IOS_SPACES_SH="$SCRIPT_DIR/fix-ios-spaces.sh"
LOG_DIR="$PROJECT_ROOT/scripts/.build-logs"
SIMULATOR_NAME="iPhone 16 Pro"
SCHEME="FlentSecured"
WORKSPACE="$IOS_DIR/FlentSecured.xcworkspace"

SKIP_PREBUILD=false
SKIP_PODS=false
VERBOSE=false

# Parse flags
for arg in "$@"; do
  case $arg in
    --skip-prebuild) SKIP_PREBUILD=true ;;
    --skip-pods)     SKIP_PODS=true ;;
    --verbose)       VERBOSE=true ;;
    --help|-h)
      echo "Usage: bash scripts/build-and-heal.sh [--skip-prebuild] [--skip-pods] [--verbose]"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg"
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

step_num=0

timestamp() {
  date "+%H:%M:%S"
}

step() {
  step_num=$((step_num + 1))
  echo ""
  echo -e "${BOLD}${BLUE}[$(timestamp)] Step ${step_num}: $1${RESET}"
  echo -e "${DIM}$(printf '%.0s-' {1..60})${RESET}"
}

ok() {
  echo -e "${GREEN}  [OK] $1${RESET}"
}

warn() {
  echo -e "${YELLOW}  [WARN] $1${RESET}"
}

fail() {
  echo -e "${RED}  [FAIL] $1${RESET}"
}

info() {
  echo -e "${CYAN}  [INFO] $1${RESET}"
}

# -------------------------------------------------------------------------
# Trap for cleanup
# -------------------------------------------------------------------------

cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo ""
    fail "Build pipeline exited with code $exit_code"
    if [ -d "$LOG_DIR" ]; then
      info "Build logs saved to: $LOG_DIR/"
    fi
  fi
}

trap cleanup EXIT

# -------------------------------------------------------------------------
# Ensure log directory exists
# -------------------------------------------------------------------------

mkdir -p "$LOG_DIR"

# -------------------------------------------------------------------------
# Start
# -------------------------------------------------------------------------

echo ""
echo -e "${BOLD}${CYAN}===============================================${RESET}"
echo -e "${BOLD}${CYAN}  Flent Secured -- Self-Healing iOS Build${RESET}"
echo -e "${BOLD}${CYAN}===============================================${RESET}"
echo -e "${DIM}  Project root: $PROJECT_ROOT${RESET}"
echo -e "${DIM}  Timestamp:    $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo -e "${DIM}  Simulator:    $SIMULATOR_NAME${RESET}"

# -------------------------------------------------------------------------
# Step 1: Expo Prebuild
# -------------------------------------------------------------------------

if [ "$SKIP_PREBUILD" = true ]; then
  step "Expo Prebuild (SKIPPED via --skip-prebuild)"
  info "Using existing ios/ directory"
else
  step "Expo Prebuild --clean"
  info "Regenerating native ios/ and android/ directories..."

  PREBUILD_LOG="$LOG_DIR/prebuild.log"
  set +e
  (cd "$PROJECT_ROOT" && npx expo prebuild --clean --platform ios 2>&1) | tee "$PREBUILD_LOG"
  PREBUILD_EXIT=${PIPESTATUS[0]}
  set -e

  if [ $PREBUILD_EXIT -ne 0 ]; then
    fail "expo prebuild failed (exit $PREBUILD_EXIT)"
    info "Log: $PREBUILD_LOG"
    exit 1
  fi
  ok "Prebuild complete"
fi

# -------------------------------------------------------------------------
# Step 2: Run spaces-in-path patches (Node script)
# -------------------------------------------------------------------------

step "Apply spaces-in-path patches"

if [ -f "$PATCH_SCRIPT" ]; then
  info "Running fix-spaces-in-path.js..."
  set +e
  node "$PATCH_SCRIPT" 2>&1 | tee "$LOG_DIR/patch-spaces.log"
  PATCH_EXIT=${PIPESTATUS[0]}
  set -e

  if [ $PATCH_EXIT -ne 0 ]; then
    warn "Node patch script reported errors (non-fatal, continuing)"
  else
    ok "Node patches applied"
  fi
else
  warn "Patch script not found at: $PATCH_SCRIPT"
fi

# Also run the legacy bash patch script if available (covers extra patterns)
if [ -f "$FIX_IOS_SPACES_SH" ]; then
  info "Running legacy fix-ios-spaces.sh..."
  set +e
  bash "$FIX_IOS_SPACES_SH" 2>&1 | tee "$LOG_DIR/patch-ios-spaces-sh.log"
  set -e
  ok "Legacy patches applied"
fi

# -------------------------------------------------------------------------
# Step 3: Pod Install
# -------------------------------------------------------------------------

if [ "$SKIP_PODS" = true ]; then
  step "Pod Install (SKIPPED via --skip-pods)"
  info "Using existing Pods/"
else
  step "Pod Install"
  info "Installing CocoaPods dependencies..."

  POD_LOG="$LOG_DIR/pod-install.log"
  set +e
  (cd "$IOS_DIR" && pod install 2>&1) | tee "$POD_LOG"
  POD_EXIT=${PIPESTATUS[0]}
  set -e

  if [ $POD_EXIT -ne 0 ]; then
    warn "pod install failed -- attempting recovery..."

    # Known fix 1: clean DerivedData and Pods, retry
    info "Cleaning Pods/ and retrying..."
    rm -rf "$IOS_DIR/Pods" "$IOS_DIR/Podfile.lock"
    set +e
    (cd "$IOS_DIR" && pod install --repo-update 2>&1) | tee "$POD_LOG"
    POD_EXIT=${PIPESTATUS[0]}
    set -e

    if [ $POD_EXIT -ne 0 ]; then
      fail "pod install failed after retry (exit $POD_EXIT)"
      info "Log: $POD_LOG"
      exit 1
    fi
  fi
  ok "Pod install complete"
fi

# -------------------------------------------------------------------------
# Step 4: Xcode Build
# -------------------------------------------------------------------------

run_xcodebuild() {
  local attempt=$1
  local build_log="$LOG_DIR/xcodebuild-attempt-${attempt}.log"

  info "xcodebuild attempt $attempt..."

  local xcode_args=(
    -workspace "$WORKSPACE"
    -scheme "$SCHEME"
    -configuration Debug
    -sdk iphonesimulator
    -destination "platform=iOS Simulator,name=$SIMULATOR_NAME"
    build
  )

  if [ "$VERBOSE" = true ]; then
    xcode_args+=(-verbose)
  fi

  set +e
  xcodebuild "${xcode_args[@]}" 2>&1 | tee "$build_log"
  local exit_code=${PIPESTATUS[0]}
  set -e

  echo "$exit_code" > "$LOG_DIR/xcodebuild-attempt-${attempt}-exit.txt"
  return $exit_code
}

analyze_and_heal() {
  local build_log="$1"

  info "Analyzing build failure..."

  # Known pattern 1: "No such file or directory" caused by unquoted spaces
  if grep -q "No such file or directory" "$build_log" 2>/dev/null; then
    warn "Detected path-with-spaces issue -- re-running patches"

    # Re-run all patches (they are idempotent)
    [ -f "$PATCH_SCRIPT" ] && node "$PATCH_SCRIPT" 2>&1 || true
    [ -f "$FIX_IOS_SPACES_SH" ] && bash "$FIX_IOS_SPACES_SH" 2>&1 || true
    return 0
  fi

  # Known pattern 2: "Sandbox not in sync with Podfile.lock"
  if grep -qi "sandbox is not in sync" "$build_log" 2>/dev/null; then
    warn "Detected Pods sandbox mismatch -- running pod install"
    (cd "$IOS_DIR" && pod install 2>&1) || true
    return 0
  fi

  # Known pattern 3: Missing module (framework not found)
  if grep -qi "module .* not found\|framework not found\|No such module" "$build_log" 2>/dev/null; then
    warn "Detected missing module -- cleaning and reinstalling pods"
    rm -rf "$IOS_DIR/Pods" "$IOS_DIR/Podfile.lock"
    (cd "$IOS_DIR" && pod install --repo-update 2>&1) || true
    return 0
  fi

  # Known pattern 4: DerivedData stale artifacts
  if grep -qi "Command .* failed with a nonzero exit code\|Build input file .* missing" "$build_log" 2>/dev/null; then
    warn "Detected stale build artifacts -- cleaning DerivedData"
    # Clean the build folder for this workspace
    xcodebuild -workspace "$WORKSPACE" \
      -scheme "$SCHEME" \
      -configuration Debug \
      -sdk iphonesimulator \
      clean 2>/dev/null || true
    return 0
  fi

  # Known pattern 5: Signing issues in simulator build
  if grep -qi "Signing for .* requires a development team\|No profiles for" "$build_log" 2>/dev/null; then
    warn "Detected code signing issue -- this should not affect simulator builds"
    warn "Check your Xcode signing settings if this persists"
    return 0
  fi

  # Unknown failure
  fail "No known fix pattern matched"
  fail "Last 30 lines of build log:"
  echo ""
  tail -30 "$build_log" | while IFS= read -r line; do
    echo -e "${DIM}    $line${RESET}"
  done
  return 1
}

step "Xcode Build (Debug, iphonesimulator)"

if run_xcodebuild 1; then
  ok "Build succeeded on first attempt"
else
  warn "Build failed on attempt 1"

  # Analyze and attempt self-healing
  if analyze_and_heal "$LOG_DIR/xcodebuild-attempt-1.log"; then
    step "Xcode Build (Retry after healing)"

    if run_xcodebuild 2; then
      ok "Build succeeded on retry"
    else
      fail "Build failed on retry"
      fail "Check logs in: $LOG_DIR/"
      exit 1
    fi
  else
    fail "No automated fix available"
    fail "Check logs in: $LOG_DIR/"
    exit 1
  fi
fi

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------

echo ""
echo -e "${BOLD}${GREEN}===============================================${RESET}"
echo -e "${BOLD}${GREEN}  Build Complete${RESET}"
echo -e "${BOLD}${GREEN}===============================================${RESET}"
echo -e "${DIM}  Finished: $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo -e "${DIM}  Logs:     $LOG_DIR/${RESET}"
echo ""
echo -e "${CYAN}  Next steps:${RESET}"
echo -e "${DIM}    Install to simulator:${RESET}"
echo -e "${DIM}      xcrun simctl install EA52887A-365C-495B-8618-16FBEE0E0990 \\${RESET}"
echo -e "${DIM}        ios/build/Build/Products/Debug-iphonesimulator/FlentSecured.app${RESET}"
echo -e "${DIM}    Launch:${RESET}"
echo -e "${DIM}      xcrun simctl launch EA52887A-365C-495B-8618-16FBEE0E0990 in.flent.secured${RESET}"
echo ""
exit 0
