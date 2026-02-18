#!/usr/bin/env bash
# =============================================================================
# validate-assets.sh — Recursive PNG/JSON validator
# =============================================================================
# Purpose:  Validates all PNG and JSON files in a directory tree.
#           PNGs are checked for magic bytes, minimum size, and corruption.
#           JSONs are checked for valid parse, and blueprint JSONs are checked
#           for a non-empty nodes array.
#
# Usage:    bash autobot/validate-assets.sh <directory> [--verbose]
# Exit:     0 if all files valid, 1 if any invalid (prints list of failures)
# =============================================================================
set -euo pipefail

# ── Globals ──────────────────────────────────────────────────────────────────
INVALID_FILES=()
TOTAL_PNG=0
TOTAL_JSON=0
VALID_PNG=0
VALID_JSON=0
VERBOSE=false

# ── Usage ────────────────────────────────────────────────────────────────────
usage() {
  echo "Usage: bash autobot/validate-assets.sh <directory> [--verbose]"
  echo ""
  echo "  <directory>   Path to directory containing PNG/JSON files to validate"
  echo "  --verbose     Print status for every file, not just failures"
  exit 1
}

# ── Argument parsing ─────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  usage
fi

TARGET_DIR="$1"
shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verbose) VERBOSE=true ;;
    *) echo "ERROR: Unknown option '$1'"; usage ;;
  esac
  shift
done

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "ERROR: Directory not found: $TARGET_DIR"
  exit 1
fi

# ── PNG validation ───────────────────────────────────────────────────────────
# Valid PNG starts with 8 magic bytes: 89 50 4E 47 0D 0A 1A 0A
PNG_MAGIC="89504e470d0a1a0a"

validate_png() {
  local file="$1"
  TOTAL_PNG=$((TOTAL_PNG + 1))

  # Check file is not empty
  local size
  size=$(wc -c < "$file" | tr -d ' ')
  if [[ "$size" -eq 0 ]]; then
    INVALID_FILES+=("$file  [EMPTY: 0 bytes]")
    return
  fi

  # Check minimum size for a valid PNG (8-byte header + IHDR chunk minimum)
  if [[ "$size" -lt 67 ]]; then
    INVALID_FILES+=("$file  [TOO SMALL: ${size} bytes, minimum 67]")
    return
  fi

  # Read first 8 bytes as hex
  local header
  header=$(xxd -p -l 8 "$file" 2>/dev/null || true)

  # Detect JSON masquerading as PNG (first byte 0x7B = '{')
  if [[ "${header:0:2}" == "7b" ]]; then
    INVALID_FILES+=("$file  [JSON MASQUERADING AS PNG: starts with 0x7B '{']")
    return
  fi

  # Check PNG magic bytes
  if [[ "$header" != "$PNG_MAGIC" ]]; then
    INVALID_FILES+=("$file  [BAD MAGIC: got $header, expected $PNG_MAGIC]")
    return
  fi

  VALID_PNG=$((VALID_PNG + 1))
  if $VERBOSE; then
    echo "  OK  $file  (${size} bytes)"
  fi
}

# ── JSON validation ──────────────────────────────────────────────────────────
validate_json() {
  local file="$1"
  TOTAL_JSON=$((TOTAL_JSON + 1))

  # Check file is not empty
  local size
  size=$(wc -c < "$file" | tr -d ' ')
  if [[ "$size" -eq 0 ]]; then
    INVALID_FILES+=("$file  [EMPTY: 0 bytes]")
    return
  fi

  # Try to parse JSON
  if ! node -e "JSON.parse(require('fs').readFileSync('$file','utf8'))" 2>/dev/null; then
    INVALID_FILES+=("$file  [INVALID JSON: parse failed]")
    return
  fi

  # Blueprint-specific check: nodes array must have length > 0
  local basename
  basename=$(basename "$file")
  if [[ "$basename" == *-blueprint.json ]]; then
    local node_count
    node_count=$(node -e "
      const d = JSON.parse(require('fs').readFileSync('$file','utf8'));
      const nodes = d.nodes || d.componentTree || [];
      console.log(Array.isArray(nodes) ? nodes.length : 0);
    " 2>/dev/null || echo "0")

    if [[ "$node_count" -eq 0 ]]; then
      INVALID_FILES+=("$file  [BLUEPRINT EMPTY: nodes/componentTree array is empty or missing]")
      return
    fi

    if $VERBOSE; then
      echo "  OK  $file  (blueprint, ${node_count} nodes)"
    fi
  else
    if $VERBOSE; then
      echo "  OK  $file"
    fi
  fi

  VALID_JSON=$((VALID_JSON + 1))
}

# ── Main scan ────────────────────────────────────────────────────────────────
echo "Validating assets in: $TARGET_DIR"
echo "─────────────────────────────────────────────────────"

# Find and validate all PNG files
while IFS= read -r -d '' file; do
  validate_png "$file"
done < <(find "$TARGET_DIR" -type f -name '*.png' -print0 2>/dev/null)

# Find and validate all JSON files
while IFS= read -r -d '' file; do
  validate_json "$file"
done < <(find "$TARGET_DIR" -type f -name '*.json' -print0 2>/dev/null)

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "Results:"
echo "  PNG files:  ${VALID_PNG}/${TOTAL_PNG} valid"
echo "  JSON files: ${VALID_JSON}/${TOTAL_JSON} valid"

if [[ ${#INVALID_FILES[@]} -gt 0 ]]; then
  echo ""
  echo "INVALID FILES (${#INVALID_FILES[@]}):"
  for entry in "${INVALID_FILES[@]}"; do
    echo "  FAIL  $entry"
  done
  echo ""
  echo "Validation FAILED: ${#INVALID_FILES[@]} invalid file(s) found."
  exit 1
else
  echo ""
  echo "Validation PASSED: all files valid."
  exit 0
fi
