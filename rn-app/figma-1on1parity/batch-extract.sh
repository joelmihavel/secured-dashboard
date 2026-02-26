#!/usr/bin/env bash
# batch-extract.sh — Batch runner for extract-screen.ts
#
# Runs extraction in batches of 5 with 60s pauses between batches.
# Skips screens that already have blueprint files.
# Tracks progress in extraction-progress.json.
#
# Usage:
#   bash figma-1on1parity/batch-extract.sh
#   bash figma-1on1parity/batch-extract.sh --batch 5        # Start from batch 5
#   bash figma-1on1parity/batch-extract.sh --dry-run         # Print plan only
#   bash figma-1on1parity/batch-extract.sh --batch 3 --dry-run

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RN_APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
PROGRESS_FILE="$SCRIPT_DIR/extraction-progress.json"
LOG_DIR="$SCRIPT_DIR/logs"
PAUSE_SECONDS=60

# ---------------------------------------------------------------------------
# Batch definitions (priority-ordered, trust-critical first)
# Node IDs in colon format — converted to dash for file names
# ---------------------------------------------------------------------------

BATCH_1="41:9388 41:9563 41:9460 41:9511 41:9635"
BATCH_2="41:8695 41:9681 41:9746 243:7398 243:6731"
BATCH_3="246:8416 41:8901 41:9004 41:9114 41:8369"
BATCH_4="41:8529 41:9224 1:28985 1:29025 1:29065"
BATCH_5="1:29108 1:31073 1:31590 1:31671 1:31175"
BATCH_6="1:31277 1:31380 1:31485 1:28055 1:28071"
BATCH_7="1:29914 1:30001 1:30090 1:30178 1:30268"
BATCH_8="1:30358 1:30448 1:30820 41:11206 41:11825"
BATCH_9="41:11506 41:11613 41:11720 41:11313 41:11410"
BATCH_10="41:10712 41:10859 41:11006 1:33737 597:2833"
BATCH_11="1:34343 597:2922 1:34150 1:34236 41:8760"
BATCH_12="41:8880 41:8450 41:8612 41:9307 41:9811"
BATCH_13="243:2967 243:7185 243:3170 243:3378 243:3586"
BATCH_14="243:2762 243:6971 243:3797 243:4006 243:7613"
BATCH_15="243:4062 243:6490 243:2681 243:7463 243:5277"
BATCH_16="243:5870 243:5689 243:6296 243:5483 243:6083"
BATCH_17="243:6731 243:4258 243:4462 243:4666 243:4870"
BATCH_18="243:5074 243:4052 243:3794 243:3838 243:4008"
BATCH_19="243:3816 243:3923 243:4030 243:3750 243:3772"
BATCH_20="243:7823 243:8033 243:8243 243:8453 243:8663"
BATCH_21="243:8873 243:9083 243:4855 243:5066"

TOTAL_BATCHES=21

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

START_BATCH=1
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch)
      START_BATCH="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo "Usage: batch-extract.sh [--batch N] [--dry-run]"
      echo "  --batch N   Start from batch N (default: 1)"
      echo "  --dry-run   Print extraction plan without running"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Convert colon-format node ID to dash-format file name
node_to_file_id() {
  echo "$1" | tr ':' '-'
}

# Check if a blueprint already exists for a node ID
blueprint_exists() {
  local file_id
  file_id="$(node_to_file_id "$1")"
  [[ -f "$DATA_DIR/${file_id}-blueprint.json" ]]
}

# Get batch variable by number
get_batch() {
  local batch_num="$1"
  local var_name="BATCH_${batch_num}"
  echo "${!var_name}"
}

# Initialize progress file if it doesn't exist
init_progress() {
  if [[ ! -f "$PROGRESS_FILE" ]]; then
    cat > "$PROGRESS_FILE" <<EOF
{
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "lastBatch": 0,
  "totalBatches": $TOTAL_BATCHES,
  "extracted": [],
  "skipped": [],
  "failed": []
}
EOF
  fi
}

# Update progress file (append to a JSON array field)
update_progress() {
  local field="$1"
  local value="$2"
  local batch_num="$3"

  # Use a temp file for atomic update
  local tmp="$PROGRESS_FILE.tmp"

  if command -v python3 &>/dev/null; then
    python3 -c "
import json, sys
with open('$PROGRESS_FILE', 'r') as f:
    data = json.load(f)
entry = {'nodeId': '$value', 'batch': $batch_num, 'at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)'}
data['$field'].append(entry)
data['lastBatch'] = $batch_num
data['updatedAt'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
with open('$tmp', 'w') as f:
    json.dump(data, f, indent=2)
"
    mv "$tmp" "$PROGRESS_FILE"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

echo "========================================"
echo "  Figma 1:1 Parity — Batch Extractor"
echo "========================================"
echo ""
echo "  Start batch: $START_BATCH / $TOTAL_BATCHES"
echo "  Dry run:     $DRY_RUN"
echo "  Data dir:    $DATA_DIR"
echo ""

mkdir -p "$DATA_DIR" "$LOG_DIR"
init_progress

# Count totals for summary
total_screens=0
skip_count=0
extract_count=0
fail_count=0

for batch_num in $(seq "$START_BATCH" "$TOTAL_BATCHES"); do
  batch_nodes="$(get_batch "$batch_num")"

  echo "----------------------------------------"
  echo "  Batch $batch_num / $TOTAL_BATCHES"
  echo "----------------------------------------"

  batch_extracted=0
  batch_skipped=0

  for node_id in $batch_nodes; do
    total_screens=$((total_screens + 1))
    file_id="$(node_to_file_id "$node_id")"

    if blueprint_exists "$node_id"; then
      echo "  [SKIP] $node_id  (${file_id}-blueprint.json exists)"
      batch_skipped=$((batch_skipped + 1))
      skip_count=$((skip_count + 1))

      if [[ "$DRY_RUN" == false ]]; then
        update_progress "skipped" "$node_id" "$batch_num"
      fi
      continue
    fi

    if [[ "$DRY_RUN" == true ]]; then
      echo "  [PLAN] $node_id  -> ${file_id}-blueprint.json"
      extract_count=$((extract_count + 1))
      continue
    fi

    echo "  [EXTRACT] $node_id ..."
    log_file="$LOG_DIR/${file_id}.log"

    # Run extraction from rn-app/ directory
    if (cd "$RN_APP_DIR" && npx tsx figma-1on1parity/extract-screen.ts "$node_id" > "$log_file" 2>&1); then
      echo "  [OK]      $node_id  -> ${file_id}-blueprint.json"
      batch_extracted=$((batch_extracted + 1))
      extract_count=$((extract_count + 1))
      update_progress "extracted" "$node_id" "$batch_num"
    else
      echo "  [FAIL]    $node_id  (see $log_file)"
      fail_count=$((fail_count + 1))
      update_progress "failed" "$node_id" "$batch_num"
    fi
  done

  echo ""
  echo "  Batch $batch_num complete: $batch_extracted extracted, $batch_skipped skipped"

  # Pause between batches (skip pause after last batch or in dry-run)
  if [[ "$DRY_RUN" == false ]] && [[ "$batch_num" -lt "$TOTAL_BATCHES" ]] && [[ "$batch_extracted" -gt 0 ]]; then
    echo "  Pausing ${PAUSE_SECONDS}s before next batch (rate limiting)..."
    sleep "$PAUSE_SECONDS"
  fi
done

echo ""
echo "========================================"
echo "  Extraction Complete"
echo "========================================"
echo "  Total screens:  $total_screens"
echo "  Extracted:      $extract_count"
echo "  Skipped:        $skip_count"
echo "  Failed:         $fail_count"
echo "  Progress file:  $PROGRESS_FILE"
echo "========================================"
