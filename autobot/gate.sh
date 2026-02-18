#!/usr/bin/env bash
# =============================================================================
# gate.sh — Pre-flight input validator for Ralph iterations
# =============================================================================
# Purpose:  Validates all inputs needed for a given story before execution.
#           Reads story from autobot/prd.json, checks dependencies are met,
#           then runs track-specific pre-flight checks.
#
# Usage:    bash autobot/gate.sh <storyId>
# Exit:     0 if all gates pass, 1 if any fail (prints reason)
# =============================================================================
set -euo pipefail

# ── Globals ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PRD_FILE="$PROJECT_ROOT/autobot/prd.json"
VALIDATE_SCRIPT="$PROJECT_ROOT/autobot/validate-assets.sh"
ERRORS=()

# ── Helpers ──────────────────────────────────────────────────────────────────
fail() {
  ERRORS+=("$1")
}

print_result() {
  if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo ""
    echo "GATE FAILED for story $STORY_ID (${#ERRORS[@]} issue(s)):"
    for err in "${ERRORS[@]}"; do
      echo "  - $err"
    done
    exit 1
  else
    echo ""
    echo "GATE PASSED: all pre-flight checks OK for story $STORY_ID"
    exit 0
  fi
}

# ── Usage ────────────────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  echo "Usage: bash autobot/gate.sh <storyId>"
  echo ""
  echo "  <storyId>   Story ID from autobot/prd.json (e.g., UI-01a, B03, C05)"
  exit 1
fi

STORY_ID="$1"

# ── Validate prd.json exists ─────────────────────────────────────────────────
if [[ ! -f "$PRD_FILE" ]]; then
  echo "ERROR: prd.json not found at $PRD_FILE"
  exit 1
fi

# ── Read story from prd.json ─────────────────────────────────────────────────
STORY_JSON=$(node -e "
  const prd = JSON.parse(require('fs').readFileSync('$PRD_FILE','utf8'));
  const stories = prd.stories || [];
  const found = stories.find(s => s.id === '$STORY_ID');
  if (!found) {
    // Fallback: search workStreams (old format)
    for (const [key, stream] of Object.entries(prd.workStreams || {})) {
      const s = (stream.stories || []).find(s => s.id === '$STORY_ID');
      if (s) { console.log(JSON.stringify({ ...s, track: key })); process.exit(0); }
    }
    process.stderr.write('Story not found: $STORY_ID\n');
    process.exit(1);
  }
  console.log(JSON.stringify(found));
" 2>&1) || {
  echo "ERROR: Story '$STORY_ID' not found in $PRD_FILE"
  exit 1
}

# ── Extract fields ───────────────────────────────────────────────────────────
TRACK=$(echo "$STORY_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.track)")
TITLE=$(echo "$STORY_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.title)")
TITLE_LOWER=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]')

echo "Gate check: story=$STORY_ID track=$TRACK"
echo "  Title: $TITLE"
echo "─────────────────────────────────────────────────────"

# ── Check dependsOn stories have passes: true ────────────────────────────────
DEP_CHECK=$(echo "$STORY_JSON" | node -e "
  const story = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const deps = story.dependsOn || [];
  if (deps.length === 0) { process.exit(0); }
  const prd = JSON.parse(require('fs').readFileSync('$PRD_FILE','utf8'));
  const allStories = prd.stories || [];
  const failures = [];
  for (const depId of deps) {
    const s = allStories.find(s => s.id === depId);
    if (!s) { failures.push(depId + ' (NOT FOUND)'); }
    else if (!s.passes) { failures.push(depId + ' (passes=' + (s.passes || false) + ')'); }
  }
  if (failures.length > 0) {
    console.log(failures.join('|'));
    process.exit(1);
  }
" 2>/dev/null) || {
  if [[ -n "$DEP_CHECK" ]]; then
    IFS='|' read -ra DEP_FAILURES <<< "$DEP_CHECK"
    for dep_fail in "${DEP_FAILURES[@]}"; do
      fail "Dependency not met: $dep_fail"
    done
  fi
}
echo "  Dependencies checked."

# ── Track-specific checks ───────────────────────────────────────────────────

case "$TRACK" in

  # ────────────────────────────────────────────────────────────────────────────
  # UI TRACK
  # ────────────────────────────────────────────────────────────────────────────
  ui)
    echo "  Running UI track checks..."

    # Check buildbot/node_modules exists
    if [[ ! -d "$PROJECT_ROOT/buildbot/node_modules" ]]; then
      fail "buildbot/node_modules not found. Run: cd buildbot && npm install"
    else
      echo "    buildbot/node_modules: OK"
    fi

    # Validate blueprints via validate-assets.sh if it exists
    if [[ -f "$VALIDATE_SCRIPT" ]]; then
      if ! bash "$VALIDATE_SCRIPT" "$PROJECT_ROOT/buildbot/data/blueprints" > /dev/null 2>&1; then
        fail "Blueprint validation failed. Run: bash autobot/validate-assets.sh buildbot/data/blueprints --verbose"
      else
        echo "    Blueprint validation: PASSED"
      fi
    fi

    # Check rn-app/node_modules exists
    if [[ ! -d "$PROJECT_ROOT/rn-app/node_modules" ]]; then
      fail "rn-app/node_modules not found. Run: cd rn-app && npm install"
    else
      echo "    rn-app/node_modules: OK"
    fi
    ;;

  # ────────────────────────────────────────────────────────────────────────────
  # BACKEND TRACK
  # ────────────────────────────────────────────────────────────────────────────
  backend)
    echo "  Running backend track checks..."

    # Check supabase CLI is available
    if ! command -v supabase &>/dev/null; then
      fail "supabase CLI not found. Install: brew install supabase/tap/supabase"
    else
      echo "    supabase CLI: OK"
    fi
    ;;

  # ────────────────────────────────────────────────────────────────────────────
  # STATE TRACK
  # ────────────────────────────────────────────────────────────────────────────
  state)
    echo "  Running state track checks..."

    # Check rn-app/node_modules exists (for tsc)
    if [[ ! -d "$PROJECT_ROOT/rn-app/node_modules" ]]; then
      fail "rn-app/node_modules not found. Run: cd rn-app && npm install"
    else
      echo "    rn-app/node_modules: OK"
    fi
    ;;

  # ────────────────────────────────────────────────────────────────────────────
  # TESTING TRACK
  # ────────────────────────────────────────────────────────────────────────────
  testing|test)
    echo "  Running testing track checks..."

    # Check rn-app/node_modules for test runner
    if [[ ! -d "$PROJECT_ROOT/rn-app/node_modules" ]]; then
      fail "rn-app/node_modules not found. Run: cd rn-app && npm install"
    else
      echo "    rn-app/node_modules: OK"
    fi
    ;;

  # ────────────────────────────────────────────────────────────────────────────
  # PRODUCTION TRACK
  # ────────────────────────────────────────────────────────────────────────────
  production)
    echo "  Running production track checks..."

    if [[ ! -d "$PROJECT_ROOT/rn-app/node_modules" ]]; then
      fail "rn-app/node_modules not found. Run: cd rn-app && npm install"
    else
      echo "    rn-app/node_modules: OK"
    fi
    ;;

  # ────────────────────────────────────────────────────────────────────────────
  # UNKNOWN TRACK
  # ────────────────────────────────────────────────────────────────────────────
  *)
    fail "Unknown track: $TRACK (expected: ui, backend, state, testing, production)"
    ;;
esac

# ── Print result ─────────────────────────────────────────────────────────────
print_result
