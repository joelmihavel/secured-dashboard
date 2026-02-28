#!/bin/bash
# =============================================================================
# Trend Tracker for Flent Secured Test Reports
#
# Records session metrics and exports trend data for chart generation.
#
# Usage:
#   ./trend-tracker.sh record --session-dir /path/to/session/
#   ./trend-tracker.sh export --format json --last 30
#   ./trend-tracker.sh export --format csv --last 90
#   ./trend-tracker.sh prune --keep 90
#   ./trend-tracker.sh status
#
# The trend history is stored in:
#   test-infrastructure/reporting/.trend-history.json
#
# Exit codes:
#   0 - Success
#   1 - Error
#   2 - Configuration error
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"
HISTORY_FILE="$SCRIPT_DIR/.trend-history.json"
CATEGORY_MAP_FILE="$SCRIPT_DIR/../orchestrator/category-map.json"

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[TREND]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[TREND]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[TREND]${NC} $*"; }
log_error() { echo -e "${RED}[TREND]${NC} $*"; }

# -- Read max history from config --
MAX_HISTORY=90
if [[ -f "$CONFIG_FILE" ]]; then
  MAX_HISTORY=$(PYCONF="$CONFIG_FILE" python3 -c '
import json, os
with open(os.environ["PYCONF"]) as f:
    print(json.load(f).get("trend_history_max", 90))
' 2>/dev/null || echo "90")
fi

# -- Ensure history file exists --
ensure_history_file() {
  if [[ ! -f "$HISTORY_FILE" ]]; then
    echo '{"version":"1.0.0","entries":[]}' > "$HISTORY_FILE"
    log_info "Created new trend history file: $HISTORY_FILE"
  fi
}

# -- Validate history file is valid JSON --
validate_history() {
  if ! PYHISTORY="$HISTORY_FILE" python3 -c '
import json, os
json.load(open(os.environ["PYHISTORY"]))
' 2>/dev/null; then
    log_error "Trend history file is corrupted. Backing up and creating new."
    cp "$HISTORY_FILE" "${HISTORY_FILE}.bak.$(date +%s)"
    echo '{"version":"1.0.0","entries":[]}' > "$HISTORY_FILE"
  fi
}

# =============================================================================
# COMMAND: record
# =============================================================================

cmd_record() {
  local session_dir=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --session-dir)
        session_dir="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  if [[ -z "$session_dir" ]]; then
    log_error "Usage: $0 record --session-dir /path/to/session/"
    exit 2
  fi

  if [[ ! -d "$session_dir" ]]; then
    log_error "Session directory not found: $session_dir"
    exit 1
  fi

  local summary_file="$session_dir/summary.json"
  if [[ ! -f "$summary_file" ]]; then
    log_error "summary.json not found in session directory: $session_dir"
    exit 1
  fi

  ensure_history_file
  validate_history

  # Extract metrics and record to trend history.
  # Pass all paths via environment variables to handle spaces safely.
  TREND_SESSION_DIR="$session_dir" \
  TREND_HISTORY_FILE="$HISTORY_FILE" \
  TREND_CATEGORY_MAP="$CATEGORY_MAP_FILE" \
  TREND_MAX_HISTORY="$MAX_HISTORY" \
  python3 -c '
import json, os, sys

session_dir = os.environ["TREND_SESSION_DIR"]
history_file = os.environ["TREND_HISTORY_FILE"]
category_map_file = os.environ.get("TREND_CATEGORY_MAP", "")
max_history = int(os.environ.get("TREND_MAX_HISTORY", "90"))

# Load summary
with open(os.path.join(session_dir, "summary.json")) as f:
    summary = json.load(f)

# Load layer results
layer_data = {}
for layer in ["backend", "frontend", "e2e"]:
    path = os.path.join(session_dir, f"{layer}-results.json")
    if os.path.exists(path):
        try:
            with open(path) as f:
                layer_data[layer] = json.load(f)
        except Exception:
            layer_data[layer] = None

# Compute per-layer metrics
layer_metrics = {}
for layer_name, data in layer_data.items():
    if data is None:
        continue
    s = data.get("summary", {})
    layer_metrics[layer_name] = {
        "passed": s.get("total_passed", s.get("total_pass", 0)),
        "failed": s.get("total_failed", s.get("total_fail", 0)),
        "skipped": s.get("total_skipped", 0),
        "total": s.get("total_tests", s.get("total_files", s.get("total_flows", 0))),
        "duration": data.get("duration_seconds", 0),
        "pass_rate": s.get("pass_rate", 0)
    }

# Compute flaky count (tests that failed on first attempt but passed on retry)
flaky_count = 0
backend = layer_data.get("backend")
if backend and "files" in backend:
    for f in backend["files"]:
        if f.get("status") == "pass" and f.get("attempts", 1) > 1:
            flaky_count += 1
e2e = layer_data.get("e2e")
if e2e and "flows" in e2e:
    for f in e2e["flows"]:
        if f.get("status") == "pass" and f.get("attempts", 1) > 1:
            flaky_count += 1

# Coverage percentage (from frontend if available)
coverage_pct = 0
frontend = layer_data.get("frontend")
if frontend:
    cov = frontend.get("coverage", {})
    if isinstance(cov, dict) and cov.get("available"):
        coverage_pct = cov.get("lines", {}).get("pct", 0)

# Git info
git_branch = summary.get("git_branch", os.environ.get("GIT_BRANCH", ""))
git_commit = summary.get("git_commit", os.environ.get("GIT_COMMIT", ""))

# Build the trend entry
s = summary.get("summary", {})
entry = {
    "session_id": summary.get("session_id", "unknown"),
    "timestamp": summary.get("timestamp", ""),
    "overall_status": summary.get("overall_status", "unknown"),
    "duration_seconds": summary.get("duration_seconds", 0),
    "total_tests": s.get("total_tests", 0),
    "total_passed": s.get("total_passed", 0),
    "total_failed": s.get("total_failed", 0),
    "total_skipped": s.get("total_skipped", 0),
    "pass_rate": s.get("pass_rate", 0),
    "layers_run": s.get("layers_run", 0),
    "layers_passed": s.get("layers_passed", 0),
    "layer_metrics": layer_metrics,
    "flaky_count": flaky_count,
    "coverage_pct": coverage_pct,
    "git_branch": git_branch,
    "git_commit": git_commit
}

# Load existing history
with open(history_file) as f:
    history = json.load(f)

# Deduplicate by session_id
existing_ids = {e.get("session_id") for e in history.get("entries", [])}
if entry["session_id"] in existing_ids:
    sid = entry["session_id"]
    print(f"Session {sid} already recorded. Skipping.")
    sys.exit(0)

# Append and trim
history["entries"].append(entry)
if len(history["entries"]) > max_history:
    history["entries"] = history["entries"][-max_history:]

# Write atomically
tmp_file = history_file + ".tmp"
with open(tmp_file, "w") as f:
    json.dump(history, f, indent=2)
os.replace(tmp_file, history_file)

sid = entry["session_id"]
tt = entry["total_tests"]
pr = entry["pass_rate"]
print(f"Recorded session {sid}: {tt} tests, {pr}% pass rate, {flaky_count} flaky")
'

  local exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    log_ok "Session metrics recorded to trend history"
  else
    log_error "Failed to record session metrics"
    return 1
  fi
}

# =============================================================================
# COMMAND: export
# =============================================================================

cmd_export() {
  local format="json"
  local last=30
  local output=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --format)
        format="$2"
        shift 2
        ;;
      --last)
        last="$2"
        shift 2
        ;;
      --output)
        output="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  ensure_history_file
  validate_history

  local result
  result=$(PYHISTORY="$HISTORY_FILE" PYFMT="$format" PYLAST="$last" python3 -c '
import json, sys, csv, os

history_file = os.environ["PYHISTORY"]
fmt = os.environ.get("PYFMT", "json")
last = int(os.environ.get("PYLAST", "30"))

with open(history_file) as f:
    history = json.load(f)

entries = history.get("entries", [])[-last:]

if fmt == "json":
    output = {
        "period": f"last {last} sessions",
        "count": len(entries),
        "entries": entries
    }
    print(json.dumps(output, indent=2))

elif fmt == "csv":
    if not entries:
        print("session_id,timestamp,status,total,passed,failed,skipped,pass_rate,duration,flaky,coverage")
        sys.exit(0)

    writer = csv.writer(sys.stdout)
    writer.writerow([
        "session_id", "timestamp", "status", "total", "passed",
        "failed", "skipped", "pass_rate", "duration", "flaky", "coverage"
    ])
    for e in entries:
        writer.writerow([
            e.get("session_id", ""),
            e.get("timestamp", ""),
            e.get("overall_status", ""),
            e.get("total_tests", 0),
            e.get("total_passed", 0),
            e.get("total_failed", 0),
            e.get("total_skipped", 0),
            e.get("pass_rate", 0),
            e.get("duration_seconds", 0),
            e.get("flaky_count", 0),
            e.get("coverage_pct", 0)
        ])

elif fmt == "summary":
    if not entries:
        print(json.dumps({"message": "No trend data available"}))
        sys.exit(0)

    pass_rates = [e.get("pass_rate", 0) for e in entries]
    durations = [e.get("duration_seconds", 0) for e in entries]
    flaky_counts = [e.get("flaky_count", 0) for e in entries]

    n = len(entries)
    output = {
        "period": f"last {n} sessions",
        "avg_pass_rate": round(sum(pass_rates) / len(pass_rates), 2) if pass_rates else 0,
        "min_pass_rate": min(pass_rates) if pass_rates else 0,
        "max_pass_rate": max(pass_rates) if pass_rates else 0,
        "avg_duration": round(sum(durations) / len(durations), 1) if durations else 0,
        "total_flaky": sum(flaky_counts),
        "sessions_passed": sum(1 for e in entries if e.get("overall_status") == "pass"),
        "sessions_failed": sum(1 for e in entries if e.get("overall_status") != "pass"),
        "latest_pass_rate": pass_rates[-1] if pass_rates else 0,
        "trend_direction": "up" if len(pass_rates) >= 2 and pass_rates[-1] >= pass_rates[-2] else "down" if len(pass_rates) >= 2 else "stable"
    }
    print(json.dumps(output, indent=2))

else:
    print(f"Unknown format: {fmt}", file=sys.stderr)
    sys.exit(1)
' 2>/dev/null)

  if [[ -n "$output" ]]; then
    echo "$result" > "$output"
    log_ok "Trend data exported to: $output"
  else
    echo "$result"
  fi
}

# =============================================================================
# COMMAND: prune
# =============================================================================

cmd_prune() {
  local keep=$MAX_HISTORY

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --keep)
        keep="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  ensure_history_file
  validate_history

  PYHISTORY="$HISTORY_FILE" PYKEEP="$keep" python3 -c '
import json, os

history_file = os.environ["PYHISTORY"]
keep = int(os.environ.get("PYKEEP", "90"))

with open(history_file) as f:
    history = json.load(f)

original_count = len(history.get("entries", []))
history["entries"] = history.get("entries", [])[-keep:]
pruned_count = original_count - len(history["entries"])

tmp_file = history_file + ".tmp"
with open(tmp_file, "w") as f:
    json.dump(history, f, indent=2)
os.replace(tmp_file, history_file)

remaining = len(history["entries"])
print(f"Pruned {pruned_count} entries. {remaining} remaining.")
'

  log_ok "Trend history pruned (keeping last $keep entries)"
}

# =============================================================================
# COMMAND: status
# =============================================================================

cmd_status() {
  ensure_history_file
  validate_history

  PYHISTORY="$HISTORY_FILE" python3 -c '
import json, os

history_file = os.environ["PYHISTORY"]

with open(history_file) as f:
    history = json.load(f)

entries = history.get("entries", [])
count = len(entries)

if count == 0:
    print("Trend history: empty (no sessions recorded)")
else:
    latest = entries[-1]
    oldest = entries[0]
    file_size = os.path.getsize(history_file)
    print(f"Trend history: {count} sessions")
    print(f"  Oldest: {oldest.get(chr(34) + chr(34), oldest.get('session_id', '?'))} ({oldest.get('timestamp', '?')})"
          if False else f"  Oldest: {oldest.get('session_id', '?')} ({oldest.get('timestamp', '?')})")
    print(f"  Latest: {latest.get('session_id', '?')} ({latest.get('timestamp', '?')})")
    print(f"  File:   {history_file}")
    print(f"  Size:   {file_size} bytes")

    pass_rates = [e.get("pass_rate", 0) for e in entries]
    if pass_rates:
        avg = sum(pass_rates) / len(pass_rates)
        print(f"  Avg pass rate: {avg:.1f}%")
        print(f"  Latest pass rate: {pass_rates[-1]}%")
'
}

# =============================================================================
# MAIN DISPATCH
# =============================================================================

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <command> [options]"
  echo ""
  echo "Commands:"
  echo "  record   Record a session's metrics into trend history"
  echo "  export   Export trend data as JSON, CSV, or summary"
  echo "  prune    Remove old entries beyond the retention limit"
  echo "  status   Show trend history status"
  echo ""
  echo "Examples:"
  echo "  $0 record --session-dir /path/to/session/"
  echo "  $0 export --format json --last 30"
  echo "  $0 export --format csv --last 90 --output trends.csv"
  echo "  $0 export --format summary --last 10"
  echo "  $0 prune --keep 90"
  echo "  $0 status"
  exit 2
fi

COMMAND="$1"
shift

case "$COMMAND" in
  record)
    cmd_record "$@"
    ;;
  export)
    cmd_export "$@"
    ;;
  prune)
    cmd_prune "$@"
    ;;
  status)
    cmd_status "$@"
    ;;
  *)
    log_error "Unknown command: $COMMAND"
    echo "Run '$0' without arguments for usage."
    exit 2
    ;;
esac
