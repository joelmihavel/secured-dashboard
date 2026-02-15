#!/bin/zsh
# =============================================================================
# Auto-Heal Pixel-Perfect Parity Loop
# =============================================================================
# Compares simulator screenshots against Figma baselines using ImageMagick.
# Crops status bar from both images to reduce false diffs.
# Generates thumbnails (<500KB) safe for Claude API analysis.
#
# Usage:
#   ./buildbot/scripts/auto-heal-parity.sh [screen_name]
#   ./buildbot/scripts/auto-heal-parity.sh           # All screens
#   ./buildbot/scripts/auto-heal-parity.sh home      # Single screen
#   ./buildbot/scripts/auto-heal-parity.sh --download-baselines [--force]
#   ./buildbot/scripts/auto-heal-parity.sh --compare-only       # Skip capture, just compare
# =============================================================================

set +e  # Don't exit on individual screen failures

# Configuration
APP_SCHEME="flentsecured"
APP_BUNDLE_ID="com.flent.secured"
FIGMA_FILE_KEY="HZaVuwWn6B6jOjrmxZ7Kzv"
FIGMA_TOKEN="${EXPO_PUBLIC_FIGMA_ACCESS_TOKEN:-figd_1_Jk4EZoz3wTA_C0lB7G_zrhgBAJd1WF8cuOQL2Z}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."
BASELINES_DIR="$PROJECT_DIR/data/baselines"
SCREENSHOTS_DIR="$PROJECT_DIR/data/screenshots/latest"
DIFFS_DIR="$PROJECT_DIR/data/diffs"
THUMBS_DIR="$PROJECT_DIR/data/thumbnails"
REPORT_FILE="$PROJECT_DIR/reports/parity-report.md"
THRESHOLD=8  # 8% default threshold
THRESHOLD_DOTTED=18  # 18% for DottedPattern screens (inherent 8-12% SVG-vs-bitmap rendering diff from 3 layered images at low opacity)

# Status bar crop: remove top 100px from simulator screenshots (3x retina = ~33pt status bar)
STATUS_BAR_CROP_PX=100
# Baseline crop: remove top portion proportionally (Figma renders at 2x)
BASELINE_CROP_PX=66

# Screen registry: name|route|figma_node|delay_seconds
# delay_seconds: extra wait after navigation (default 2s)
SCREENS=(
  "splash|/(auth)/splash|1:28055|3"
  "carousel|/(auth)/carousel|1:28985|3"
  "sign-up|/(auth)/sign-up|1:29108|3"
  "otp|/(auth)/otp|1:31175|4"
  "home|/(main)|243:2762|4"
  "select-method|/(payment)/select-method|41:8901|3"
  "processing|/(payment)/processing|41:9460|3"
  "success|/(payment)/success|41:9388|3"
  "failed|/(payment)/failed|41:9511|3"
  "profile|/(profile)|41:8760|3"
  "setup|/(setup)|41:10712|4"
  "waitlist|/(waitlist)|41:11206|4"
  "transactions|/(transactions)|243:5870|3"
  "add-upi|/(payment)/add-upi|41:8369|3"
  "add-card|/(payment)/add-card|41:8529|3"
  "add-netbanking|/(payment)/add-netbanking|41:9224|3"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo "${BLUE}[INFO]${NC} $1" }
log_success() { echo "${GREEN}[PASS]${NC} $1" }
log_warn()    { echo "${YELLOW}[WARN]${NC} $1" }
log_fail()    { echo "${RED}[FAIL]${NC} $1" }

get_field() {
  echo "$1" | cut -d'|' -f"$2"
}

find_screen() {
  local target=$1
  for entry in "${SCREENS[@]}"; do
    local name=$(get_field "$entry" 1)
    if [[ "$name" == "$target" ]]; then
      echo "$entry"
      return 0
    fi
  done
  return 1
}

# DottedPattern screens get higher threshold due to inherent SVG vs bitmap rendering diff
get_screen_threshold() {
  local name=$1
  case "$name" in
    splash|carousel|sign-up|setup|waitlist)
      echo "$THRESHOLD_DOTTED"
      ;;
    *)
      echo "$THRESHOLD"
      ;;
  esac
}

ensure_dirs() {
  mkdir -p "$BASELINES_DIR" "$SCREENSHOTS_DIR" "$DIFFS_DIR"
  mkdir -p "$THUMBS_DIR/baselines" "$THUMBS_DIR/screenshots/latest" "$THUMBS_DIR/screenshots/diffs" "$THUMBS_DIR/composites"
}

download_baseline() {
  local name=$1
  local node_id=$2
  local output="$BASELINES_DIR/${name}.png"

  if [[ -f "$output" ]] && [[ "$FORCE_DOWNLOAD" != "true" ]]; then
    log_info "Baseline exists: $name (use --force to re-download)"
    return 0
  fi

  log_info "Downloading Figma baseline: $name (node $node_id)..."

  local encoded_node_id="${node_id//:/%3A}"
  local response
  response=$(curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
    "https://api.figma.com/v1/images/$FIGMA_FILE_KEY?ids=$encoded_node_id&scale=2&format=png")

  local image_url
  image_url=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
images = data.get('images', {})
for key, url in images.items():
    if url:
        print(url)
        break
" 2>/dev/null)

  if [[ -z "$image_url" ]] || [[ "$image_url" == "null" ]]; then
    log_warn "Could not get image URL for $name"
    return 1
  fi

  curl -s -o "$output" "$image_url"
  log_success "Downloaded: $output"
}

capture_screenshot() {
  local name=$1
  local route=$2
  local delay=${3:-2}
  local output="$SCREENSHOTS_DIR/${name}.png"

  # Route-specific pre-navigation to clear stale state without terminating the app
  # (Terminating resets auth state and triggers Expo dev client deep link dialog)
  # NOTE: Sibling Stack groups (main, setup, waitlist, etc.) can't cross-navigate via deep link
  case "$name" in
    splash|carousel|sign-up)
      # Auth screens: navigate to carousel first to dismiss any OTP modals
      xcrun simctl openurl booted "${APP_SCHEME}:///(auth)/carousel" 2>/dev/null || true
      sleep 1.5
      ;;
    otp)
      # OTP: navigate to sign-up first (OTP presents as modal on top)
      xcrun simctl openurl booted "${APP_SCHEME}:///(auth)/sign-up" 2>/dev/null || true
      sleep 1.5
      ;;
    setup|waitlist)
      # Root-level sibling groups: skip pre-navigation (can't cross-navigate from main)
      # Just deep link directly - app will route based on current state
      ;;
    *)
      # All other screens: navigate to home first
      xcrun simctl openurl booted "${APP_SCHEME}:///(main)" 2>/dev/null || true
      sleep 1
      ;;
  esac

  log_info "Navigating to $name ($route) [wait ${delay}s]..."
  xcrun simctl openurl booted "${APP_SCHEME}://${route}" 2>/dev/null || true
  sleep "$delay"
  xcrun simctl io booted screenshot "$output" 2>/dev/null
  log_success "Captured: $output"
}

# Crop status bar from an image and save to a temp file
crop_status_bar() {
  local input=$1
  local output=$2
  local crop_px=$3

  local img_h
  img_h=$(magick identify -format "%h" "$input")
  local new_h=$((img_h - crop_px))
  local img_w
  img_w=$(magick identify -format "%w" "$input")

  magick "$input" -crop "${img_w}x${new_h}+0+${crop_px}" +repage "$output"
}

# Generate thumbnail (max 600px wide) for Claude API
generate_thumbnail() {
  local input=$1
  local output=$2
  magick "$input" -resize 600x -quality 85 "$output" 2>/dev/null
}

# Generate side-by-side composite thumbnail
generate_composite() {
  local name=$1
  local baseline_thumb="$THUMBS_DIR/baselines/${name}.png"
  local screenshot_thumb="$THUMBS_DIR/screenshots/latest/${name}.png"
  local composite="$THUMBS_DIR/composites/${name}.png"

  if [[ -f "$baseline_thumb" ]] && [[ -f "$screenshot_thumb" ]]; then
    magick "$baseline_thumb" "$screenshot_thumb" +append "$composite" 2>/dev/null
    # Cap composite at 500KB
    local size=$(stat -f%z "$composite" 2>/dev/null || echo 0)
    if [[ "$size" -gt 500000 ]]; then
      magick "$composite" -resize 800x -quality 75 "$composite"
    fi
  fi
}

## Validate a PNG file: exists, non-empty, has valid PNG header
validate_png() {
  local file_path="$1"
  local label="${2:-$(basename "$file_path")}"

  if [[ ! -f "$file_path" ]]; then
    echo "INVALID: $label does not exist"
    return 1
  fi

  local file_size
  file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null || echo "0")
  if [[ "$file_size" -eq 0 ]]; then
    echo "INVALID: $label is empty (0 bytes)"
    return 1
  fi

  if [[ "$file_size" -lt 67 ]]; then
    echo "INVALID: $label too small (${file_size} bytes)"
    return 1
  fi

  # Check PNG magic bytes using magick identify
  if ! magick identify "$file_path" >/dev/null 2>&1; then
    echo "INVALID: $label failed magick identify (corrupt or not an image)"
    return 1
  fi

  return 0
}

compare_screen() {
  local name=$1
  local baseline="$BASELINES_DIR/${name}.png"
  local screenshot="$SCREENSHOTS_DIR/${name}.png"
  local diff_output="$DIFFS_DIR/${name}-diff.png"

  if [[ ! -f "$baseline" ]]; then
    log_warn "No baseline for $name"
    return 1
  fi

  if [[ ! -f "$screenshot" ]]; then
    log_warn "No screenshot for $name"
    return 1
  fi

  # Validate both images are valid PNGs before processing
  local baseline_check screenshot_check
  baseline_check=$(validate_png "$baseline" "baseline:$name")
  if [[ $? -ne 0 ]]; then
    log_warn "$name: baseline corrupt — $baseline_check"
    return 1
  fi
  screenshot_check=$(validate_png "$screenshot" "screenshot:$name")
  if [[ $? -ne 0 ]]; then
    log_warn "$name: screenshot corrupt — $screenshot_check"
    return 1
  fi

  # Crop status bar from both images
  local cropped_baseline="/tmp/cropped_baseline_${name}.png"
  local cropped_screenshot="/tmp/cropped_screenshot_${name}.png"
  crop_status_bar "$baseline" "$cropped_baseline" "$BASELINE_CROP_PX"
  crop_status_bar "$screenshot" "$cropped_screenshot" "$STATUS_BAR_CROP_PX"

  # Resize cropped screenshot to match cropped baseline dimensions
  local baseline_size
  baseline_size=$(magick identify -format "%wx%h" "$cropped_baseline")
  magick "$cropped_screenshot" -resize "${baseline_size}!" "/tmp/resized_screenshot_${name}.png"

  # Get per-screen threshold (DottedPattern screens get higher threshold)
  local screen_threshold
  screen_threshold=$(get_screen_threshold "$name")

  # Pixel comparison using per-screen threshold for fuzz
  local raw_diff
  raw_diff=$(magick compare -metric AE -fuzz "${screen_threshold}%" \
    "$cropped_baseline" "/tmp/resized_screenshot_${name}.png" "$diff_output" 2>&1) || true

  local pixel_diff
  pixel_diff=$(echo "$raw_diff" | awk '{print int($1)}')

  local img_w img_h total_pixels
  img_w=$(magick identify -format "%w" "$cropped_baseline")
  img_h=$(magick identify -format "%h" "$cropped_baseline")
  total_pixels=$((img_w * img_h))

  local diff_pct="N/A"
  if [[ "$total_pixels" -gt 0 ]] && [[ "$pixel_diff" =~ ^[0-9]+$ ]]; then
    diff_pct=$(echo "scale=2; $pixel_diff * 100 / $total_pixels" | bc 2>/dev/null || echo "N/A")
  fi

  # Generate thumbnails for Claude API analysis
  generate_thumbnail "$baseline" "$THUMBS_DIR/baselines/${name}.png"
  generate_thumbnail "$screenshot" "$THUMBS_DIR/screenshots/latest/${name}.png"
  generate_thumbnail "$diff_output" "$THUMBS_DIR/screenshots/diffs/${name}-diff.png"
  generate_composite "$name"

  # Cleanup temp files
  rm -f "$cropped_baseline" "$cropped_screenshot" "/tmp/resized_screenshot_${name}.png"

  if [[ "$diff_pct" == "N/A" ]]; then
    log_warn "$name: pixels=$pixel_diff, pct=N/A (threshold=${screen_threshold}%)"
    echo "| $name | $pixel_diff px | N/A | ${screen_threshold}% | WARN |" >> "$REPORT_FILE"
  elif (( $(echo "$diff_pct < $screen_threshold" | bc -l 2>/dev/null || echo 0) )); then
    log_success "$name: ${diff_pct}% diff ($pixel_diff px) threshold=${screen_threshold}% - PASS"
    echo "| $name | $pixel_diff px | ${diff_pct}% | ${screen_threshold}% | PASS |" >> "$REPORT_FILE"
    return 0
  else
    log_fail "$name: ${diff_pct}% diff ($pixel_diff px) threshold=${screen_threshold}% - FAIL"
    echo "| $name | $pixel_diff px | ${diff_pct}% | ${screen_threshold}% | **FAIL** |" >> "$REPORT_FILE"
    return 1
  fi
}

process_screen() {
  local entry=$1
  local skip_capture=${2:-false}
  local name=$(get_field "$entry" 1)
  local route=$(get_field "$entry" 2)
  local node_id=$(get_field "$entry" 3)
  local delay=$(get_field "$entry" 4)
  [[ -z "$delay" ]] && delay=2

  log_info "=== $name ==="
  download_baseline "$name" "$node_id" || return 1
  if [[ "$skip_capture" != "true" ]]; then
    capture_screenshot "$name" "$route" "$delay"
  fi
  compare_screen "$name"
}

run_all() {
  local skip_capture=${1:-false}
  ensure_dirs

  cat > "$REPORT_FILE" << EOF
# Pixel-Perfect Parity Report

Generated: $(date)
Threshold: ${THRESHOLD}% | Status bar cropped: ${STATUS_BAR_CROP_PX}px

| Screen | Diff Pixels | Diff % | Threshold | Status |
|--------|------------|--------|-----------|--------|
EOF

  local total=0 passed=0 failed=0

  for entry in "${SCREENS[@]}"; do
    total=$((total + 1))
    if process_screen "$entry" "$skip_capture"; then
      passed=$((passed + 1))
    else
      failed=$((failed + 1))
    fi
    echo ""
  done

  cat >> "$REPORT_FILE" << EOF

## Summary
- Total: $total | Passed: $passed | Failed: $failed
- Pass rate: $(( passed * 100 / (total > 0 ? total : 1) ))%
- Thumbnails: $THUMBS_DIR/composites/
EOF

  log_info "Report: $REPORT_FILE"
  log_info "Thumbnails: $THUMBS_DIR/composites/"
  echo ""
  echo "=== Summary ==="
  echo "  Total: $total | Passed: $passed | Failed: $failed"
}

# =============================================================================
# Main
# =============================================================================

case "${1:-}" in
  --download-baselines)
    FORCE_DOWNLOAD="${2:-false}"
    [[ "$2" == "--force" ]] && FORCE_DOWNLOAD="true"
    ensure_dirs
    for entry in "${SCREENS[@]}"; do
      _name=$(get_field "$entry" 1)
      _node_id=$(get_field "$entry" 3)
      download_baseline "$_name" "$_node_id"
    done
    ;;
  --compare-only)
    run_all "true"
    ;;
  --help|-h)
    echo "Usage: $0 [screen_name | --download-baselines [--force] | --compare-only | --help]"
    echo ""
    echo "Options:"
    echo "  (no args)            Run full loop: download baselines, capture, compare"
    echo "  screen_name          Run for a single screen"
    echo "  --download-baselines Download Figma baselines (use --force to re-download)"
    echo "  --compare-only       Skip capture, just compare existing screenshots"
    echo ""
    echo "Available screens:"
    for entry in "${SCREENS[@]}"; do
      echo "  $(get_field "$entry" 1)"
    done
    ;;
  "")
    run_all
    ;;
  *)
    entry=$(find_screen "$1")
    if [[ -z "$entry" ]]; then
      log_fail "Unknown screen: $1"
      echo "Run $0 --help for available screens"
      exit 1
    fi
    ensure_dirs
    cat > "$REPORT_FILE" << EOF
# Pixel-Perfect Parity Report (Single Screen)

Generated: $(date)

| Screen | Diff Pixels | Diff % | Threshold | Status |
|--------|------------|--------|-----------|--------|
EOF
    process_screen "$entry"
    ;;
esac
