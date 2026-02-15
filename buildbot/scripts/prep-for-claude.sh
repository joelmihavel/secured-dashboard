#!/bin/bash
# prep-for-claude.sh — Resize images to Claude API-safe dimensions
#
# Claude API limits:
#   - Max: 8000x8000px (2000x2000 if >20 images per request)
#   - Optimal: 1568px longest side, ~1.15 megapixels
#   - Min recommended: 200px on any edge
#   - Max file size: 5MB
#
# This script creates Claude-safe copies in data/claude-ready/
# Original files are never modified.
#
# Usage:
#   cd buildbot && bash scripts/prep-for-claude.sh [screenId]
#   cd buildbot && bash scripts/prep-for-claude.sh 41-8760
#   cd buildbot && bash scripts/prep-for-claude.sh              # all screens

set -euo pipefail

BUILDBOT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$BUILDBOT_ROOT/data/claude-ready"
MAX_DIM=1568
MIN_DIM=200

mkdir -p "$OUTPUT_DIR"

prep_image() {
  local src="$1"
  local dst="$2"
  local label="$3"

  if [ ! -f "$src" ]; then
    echo "  SKIP $label — not found: $src"
    return 1
  fi

  # Validate image is not corrupted (magick identify exits non-zero for corrupt PNGs)
  if ! magick identify "$src" >/dev/null 2>&1; then
    echo "  WARN $label — CORRUPTED image detected: $src"
    echo "  WARN $label — This file will cause Claude API 'Could not process image' errors!"
    echo "  WARN $label — Regenerate with: npx odiff (or re-export from Figma)"
    return 1
  fi

  # Get dimensions
  local dims
  dims=$(magick identify -format "%wx%h" "$src" 2>/dev/null || echo "0x0")
  local w="${dims%x*}"
  local h="${dims#*x}"

  if [ "$w" -eq 0 ] || [ "$h" -eq 0 ]; then
    echo "  SKIP $label — could not read dimensions"
    return 1
  fi

  # Check if either dimension is under minimum
  if [ "$w" -lt "$MIN_DIM" ] || [ "$h" -lt "$MIN_DIM" ]; then
    echo "  WARN $label — ${w}x${h} is under ${MIN_DIM}px minimum, upscaling"
    magick "$src" -resize "${MIN_DIM}x${MIN_DIM}>" -quality 95 "$dst" 2>/dev/null
    local new_dims
    new_dims=$(magick identify -format "%wx%h" "$dst" 2>/dev/null)
    echo "  OK   $label — upscaled to $new_dims"
    return 0
  fi

  # Check if longest side exceeds optimal max
  local longest=$w
  [ "$h" -gt "$longest" ] && longest=$h

  if [ "$longest" -gt "$MAX_DIM" ]; then
    magick "$src" -resize "${MAX_DIM}x${MAX_DIM}>" -quality 95 "$dst" 2>/dev/null
    local new_dims
    new_dims=$(magick identify -format "%wx%h" "$dst" 2>/dev/null)
    local new_size
    new_size=$(du -h "$dst" | cut -f1)
    echo "  OK   $label — ${w}x${h} -> $new_dims ($new_size)"
  else
    # Already within limits, just copy
    cp "$src" "$dst"
    local size
    size=$(du -h "$dst" | cut -f1)
    echo "  OK   $label — ${w}x${h} already safe ($size)"
  fi

  # Final size check (must be under 5MB)
  local bytes
  bytes=$(stat -f%z "$dst" 2>/dev/null || stat -c%s "$dst" 2>/dev/null || echo 0)
  if [ "$bytes" -gt 5242880 ]; then
    echo "  WARN $label — ${bytes} bytes exceeds 5MB, re-compressing"
    magick "$dst" -quality 80 "$dst" 2>/dev/null
    bytes=$(stat -f%z "$dst" 2>/dev/null || stat -c%s "$dst" 2>/dev/null || echo 0)
    echo "  OK   $label — recompressed to ${bytes} bytes"
  fi
}

process_screen() {
  local screen_id="$1"
  echo "Processing screen: $screen_id"

  local screen_dir="$OUTPUT_DIR/$screen_id"
  mkdir -p "$screen_dir"

  # Screenshot
  prep_image \
    "$BUILDBOT_ROOT/data/screenshots/${screen_id}.png" \
    "$screen_dir/screenshot.png" \
    "screenshot"

  # Baseline
  prep_image \
    "$BUILDBOT_ROOT/data/baselines/${screen_id}-baseline.png" \
    "$screen_dir/baseline.png" \
    "baseline"

  # Diff (if exists)
  if [ -f "$BUILDBOT_ROOT/data/diffs/${screen_id}-diff.png" ]; then
    prep_image \
      "$BUILDBOT_ROOT/data/diffs/${screen_id}-diff.png" \
      "$screen_dir/diff.png" \
      "diff"
  fi

  echo ""
}

# Main
echo "========================================"
echo "  Claude Image Prep"
echo "  Max: ${MAX_DIM}px | Min: ${MIN_DIM}px"
echo "========================================"
echo ""

if [ -n "${1:-}" ]; then
  # Single screen
  process_screen "$1"
else
  # All screens with screenshots
  for f in "$BUILDBOT_ROOT"/data/screenshots/*.png; do
    [ -f "$f" ] || continue
    screen_id=$(basename "$f" .png)
    process_screen "$screen_id"
  done
fi

echo "Claude-ready images saved to: $OUTPUT_DIR/"
echo "Use these paths when asking Claude to view images."
