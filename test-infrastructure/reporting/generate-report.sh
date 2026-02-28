#!/bin/bash
# =============================================================================
# Report Generator for Flent Secured Test Suite
#
# Reads test results from a session directory and generates a self-contained
# HTML report or JSON summary for CI consumption.
#
# Usage:
#   ./generate-report.sh --input /path/to/reports/session/ --output /path/to/report.html
#   ./generate-report.sh --input /path/to/reports/session/ --format json
#   ./generate-report.sh --input /path/to/reports/session/ --format json --output summary.json
#   ./generate-report.sh --input /path/to/reports/session/ --trend
#   ./generate-report.sh --input /path/to/reports/session/ --trend --trend-last 30
#   ./generate-report.sh --input /path/to/reports/session/ --open
#
# Options:
#   --input DIR       Session directory containing result JSON files (required)
#   --output FILE     Output file path (default: <input>/report.html or report.json)
#   --format FORMAT   Output format: html (default) or json
#   --trend           Include historical trend data in the report
#   --trend-last N    Number of past sessions to include in trends (default: 30)
#   --open            Open the generated report in the default browser
#   --quiet           Suppress informational output
#
# Exit codes:
#   0 - Success
#   1 - Error
#   2 - Configuration error
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/report-template.html"
CONFIG_FILE="$SCRIPT_DIR/config.json"
CATEGORY_MAP_FILE="$SCRIPT_DIR/../orchestrator/category-map.json"
TREND_TRACKER="$SCRIPT_DIR/trend-tracker.sh"
TREND_HISTORY="$SCRIPT_DIR/.trend-history.json"

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { [[ "$QUIET" == "true" ]] && return; echo -e "${BLUE}[REPORT]${NC} $*"; }
log_ok()    { [[ "$QUIET" == "true" ]] && return; echo -e "${GREEN}[REPORT]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[REPORT]${NC} $*"; }
log_error() { echo -e "${RED}[REPORT]${NC} $*"; }

# -- Parse arguments --
INPUT_DIR=""
OUTPUT_FILE=""
FORMAT="html"
INCLUDE_TREND=false
TREND_LAST=30
OPEN_AFTER=false
QUIET=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      INPUT_DIR="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --format)
      FORMAT="$2"
      shift 2
      ;;
    --trend)
      INCLUDE_TREND=true
      shift
      ;;
    --trend-last)
      TREND_LAST="$2"
      shift 2
      ;;
    --open)
      OPEN_AFTER=true
      shift
      ;;
    --quiet|-q)
      QUIET=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 --input /path/to/session/ [--output /path/to/report.html] [--format html|json] [--trend] [--open]"
      exit 0
      ;;
    *)
      log_warn "Unknown argument: $1"
      shift
      ;;
  esac
done

# =============================================================================
# VALIDATION
# =============================================================================

if [[ -z "$INPUT_DIR" ]]; then
  log_error "Missing required argument: --input"
  echo "Usage: $0 --input /path/to/session/ [--output file] [--format html|json] [--trend]"
  exit 2
fi

if [[ ! -d "$INPUT_DIR" ]]; then
  log_error "Input directory not found: $INPUT_DIR"
  exit 2
fi

# Default output path
if [[ -z "$OUTPUT_FILE" ]]; then
  if [[ "$FORMAT" == "json" ]]; then
    OUTPUT_FILE="$INPUT_DIR/report.json"
  else
    OUTPUT_FILE="$INPUT_DIR/report.html"
  fi
fi

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT_FILE")"

log_info "Input:  $INPUT_DIR"
log_info "Output: $OUTPUT_FILE"
log_info "Format: $FORMAT"

# =============================================================================
# COLLECT DATA FILES
# =============================================================================

SUMMARY_FILE="$INPUT_DIR/summary.json"
BACKEND_FILE="$INPUT_DIR/backend-results.json"
FRONTEND_FILE="$INPUT_DIR/frontend-results.json"
FRONTEND_RAW_FILE="$INPUT_DIR/frontend-jest-raw.json"
E2E_FILE="$INPUT_DIR/e2e-results.json"

# At minimum we need summary.json or at least one layer result
HAS_DATA=false
for f in "$SUMMARY_FILE" "$BACKEND_FILE" "$FRONTEND_FILE" "$E2E_FILE"; do
  if [[ -f "$f" && -s "$f" ]]; then
    HAS_DATA=true
    break
  fi
done

if [[ "$HAS_DATA" == "false" ]]; then
  log_error "No result files found in: $INPUT_DIR"
  log_error "Expected at least one of: summary.json, backend-results.json, frontend-results.json, e2e-results.json"
  exit 1
fi

# =============================================================================
# RECORD TREND DATA
# =============================================================================

if [[ -f "$SUMMARY_FILE" && -x "$TREND_TRACKER" ]]; then
  log_info "Recording session to trend history..."
  "$TREND_TRACKER" record --session-dir "$INPUT_DIR" 2>/dev/null || log_warn "Trend recording failed (non-fatal)"
fi

# =============================================================================
# COLLECT GIT INFORMATION
# =============================================================================

GIT_BRANCH=""
GIT_COMMIT=""
if command -v git &>/dev/null; then
  GIT_BRANCH=$(cd "$PROJECT_ROOT" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  GIT_COMMIT=$(cd "$PROJECT_ROOT" && git rev-parse HEAD 2>/dev/null || echo "")
fi

# =============================================================================
# FIND E2E SCREENSHOTS AND ENCODE AS BASE64
# =============================================================================

SCREENSHOT_DIR="$SCRIPT_DIR/../orchestrator/.session/e2e-screenshots"
SCREENSHOT_JSON="{}"

if [[ -d "$SCREENSHOT_DIR" ]]; then
  SCREENSHOT_JSON=$(python3 -c "
import os, base64, json, sys

screenshot_dir = '$SCREENSHOT_DIR'
screenshots = {}

for fname in sorted(os.listdir(screenshot_dir)):
    if not fname.lower().endswith('.png'):
        continue
    fpath = os.path.join(screenshot_dir, fname)
    try:
        with open(fpath, 'rb') as f:
            data = f.read()
        # Validate PNG header
        if data[:4] == b'\\x89PNG':
            b64 = base64.b64encode(data).decode('ascii')
            # Extract flow name from filename pattern: flowname_attemptN_timestamp.png
            parts = fname.rsplit('_attempt', 1)
            flow_key = parts[0] if parts else fname
            screenshots[flow_key] = 'data:image/png;base64,' + b64
    except Exception:
        pass

print(json.dumps(screenshots))
" 2>/dev/null || echo "{}")
fi

# =============================================================================
# JSON FORMAT
# =============================================================================

if [[ "$FORMAT" == "json" ]]; then
  log_info "Generating JSON report..."

  python3 -c "
import json, os, sys

input_dir = '$INPUT_DIR'
git_branch = '$GIT_BRANCH'
git_commit = '$GIT_COMMIT'

report = {
    'format': 'json',
    'version': '1.0.0',
    'generator': 'Flent Test Orchestrator',
    'git': {
        'branch': git_branch,
        'commit': git_commit
    }
}

# Load each file
for key, filename in [('summary', 'summary.json'), ('backend', 'backend-results.json'),
                       ('frontend', 'frontend-results.json'), ('e2e', 'e2e-results.json')]:
    path = os.path.join(input_dir, filename)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        try:
            with open(path) as f:
                report[key] = json.load(f)
        except Exception as e:
            report[key] = {'error': str(e)}

# Inject git info into summary
if 'summary' in report:
    report['summary']['git_branch'] = git_branch
    report['summary']['git_commit'] = git_commit

print(json.dumps(report, indent=2))
" > "$OUTPUT_FILE" 2>/dev/null

  if [[ -f "$OUTPUT_FILE" && -s "$OUTPUT_FILE" ]]; then
    log_ok "JSON report generated: $OUTPUT_FILE"
    log_info "Size: $(wc -c < "$OUTPUT_FILE" | tr -d ' ') bytes"
  else
    log_error "Failed to generate JSON report"
    exit 1
  fi

  exit 0
fi

# =============================================================================
# HTML FORMAT
# =============================================================================

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  log_error "HTML template not found: $TEMPLATE_FILE"
  exit 2
fi

log_info "Generating HTML report..."

# Build the REPORT_DATA JavaScript object using Python
REPORT_DATA_JS=$(python3 -c "
import json, os, sys

input_dir = '$INPUT_DIR'
git_branch = '$GIT_BRANCH'
git_commit = '$GIT_COMMIT'
include_trend = '$INCLUDE_TREND' == 'true'
trend_last = $TREND_LAST
trend_history_file = '$TREND_HISTORY'
category_map_file = '$CATEGORY_MAP_FILE'
config_file = '$CONFIG_FILE'
screenshots_json = '''$SCREENSHOT_JSON'''

data = {}

# Load summary
summary_path = os.path.join(input_dir, 'summary.json')
if os.path.exists(summary_path) and os.path.getsize(summary_path) > 0:
    try:
        with open(summary_path) as f:
            data['summary'] = json.load(f)
    except Exception:
        data['summary'] = {}
else:
    data['summary'] = {}

# Inject git info
data['summary']['git_branch'] = git_branch
data['summary']['git_commit'] = git_commit

# Load backend results
backend_path = os.path.join(input_dir, 'backend-results.json')
if os.path.exists(backend_path) and os.path.getsize(backend_path) > 0:
    try:
        with open(backend_path) as f:
            data['backend'] = json.load(f)
    except Exception:
        data['backend'] = None
else:
    data['backend'] = None

# Load frontend results
frontend_path = os.path.join(input_dir, 'frontend-results.json')
if os.path.exists(frontend_path) and os.path.getsize(frontend_path) > 0:
    try:
        with open(frontend_path) as f:
            data['frontend'] = json.load(f)
    except Exception:
        data['frontend'] = None
else:
    data['frontend'] = None

# Load raw Jest data if available
jest_raw_path = os.path.join(input_dir, 'frontend-jest-raw.json')
if os.path.exists(jest_raw_path) and os.path.getsize(jest_raw_path) > 0:
    try:
        with open(jest_raw_path) as f:
            jest_raw = json.load(f)
        if data['frontend'] is None:
            data['frontend'] = {}
        data['frontend']['jest_raw'] = jest_raw

        # Extract coverage if available
        if 'coverageMap' in jest_raw:
            # Calculate overall line coverage from coverageMap
            total_lines = 0
            covered_lines = 0
            for file_path, cov in jest_raw.get('coverageMap', {}).items():
                s = cov.get('s', {})
                for key, count in s.items():
                    total_lines += 1
                    if count > 0:
                        covered_lines += 1
            pct = round((covered_lines / total_lines * 100), 1) if total_lines > 0 else 0
            data['coverage'] = {
                'available': True,
                'lines': {'pct': pct, 'total': total_lines, 'covered': covered_lines}
            }
    except Exception:
        pass

# Load E2E results
e2e_path = os.path.join(input_dir, 'e2e-results.json')
if os.path.exists(e2e_path) and os.path.getsize(e2e_path) > 0:
    try:
        with open(e2e_path) as f:
            data['e2e'] = json.load(f)

        # Attach screenshots to flows
        try:
            screenshots = json.loads(screenshots_json) if screenshots_json else {}
        except Exception:
            screenshots = {}

        if data['e2e'] and 'flows' in data['e2e'] and screenshots:
            for flow in data['e2e']['flows']:
                flow_name = os.path.splitext(os.path.basename(flow.get('flow', '')))[0]
                if flow_name in screenshots:
                    flow['screenshot'] = screenshots[flow_name]
    except Exception:
        data['e2e'] = None
else:
    data['e2e'] = None

# Load category map
if os.path.exists(category_map_file) and os.path.getsize(category_map_file) > 0:
    try:
        with open(category_map_file) as f:
            data['category_map'] = json.load(f)
    except Exception:
        data['category_map'] = {}
else:
    data['category_map'] = {}

# Load config
if os.path.exists(config_file) and os.path.getsize(config_file) > 0:
    try:
        with open(config_file) as f:
            data['config'] = json.load(f)
    except Exception:
        data['config'] = {}
else:
    data['config'] = {}

# Load trend data
if include_trend and os.path.exists(trend_history_file) and os.path.getsize(trend_history_file) > 0:
    try:
        with open(trend_history_file) as f:
            history = json.load(f)
        entries = history.get('entries', [])[-trend_last:]
        if len(entries) > 1:
            data['trend'] = {'entries': entries, 'count': len(entries)}
    except Exception:
        pass

# Output as JS variable assignment — using json.dumps for safety
js_data = json.dumps(data, separators=(',', ':'))

# Wrap carefully to avoid breaking the script tag
print(js_data)
" 2>/dev/null)

if [[ -z "$REPORT_DATA_JS" ]]; then
  log_error "Failed to build report data. Check that Python 3 is available and result files are valid JSON."
  exit 1
fi

# Inject the data into the template
# We read the template, replace the data injection block, and write the output
python3 -c "
import sys, re

template_path = '$TEMPLATE_FILE'
output_path = '$OUTPUT_FILE'
data_js = sys.stdin.read()

with open(template_path, 'r') as f:
    template = f.read()

# Replace the data injection block
marker_start = '// %%REPORT_DATA_START%%'
marker_end = '// %%REPORT_DATA_END%%'

start_idx = template.find(marker_start)
end_idx = template.find(marker_end)

if start_idx == -1 or end_idx == -1:
    print('ERROR: Data injection markers not found in template', file=sys.stderr)
    sys.exit(1)

# Build the replacement
replacement = marker_start + '\nvar REPORT_DATA = ' + data_js + ';\n' + marker_end

html = template[:start_idx] + replacement + template[end_idx + len(marker_end):]

with open(output_path, 'w') as f:
    f.write(html)

print(f'HTML report written: {len(html)} bytes')
" <<< "$REPORT_DATA_JS"

INJECT_EXIT=$?

if [[ $INJECT_EXIT -ne 0 ]]; then
  log_error "Failed to inject data into HTML template"
  exit 1
fi

if [[ -f "$OUTPUT_FILE" && -s "$OUTPUT_FILE" ]]; then
  FILE_SIZE=$(wc -c < "$OUTPUT_FILE" | tr -d ' ')
  FILE_SIZE_KB=$((FILE_SIZE / 1024))
  log_ok "HTML report generated: $OUTPUT_FILE"
  log_info "Size: ${FILE_SIZE_KB}KB (${FILE_SIZE} bytes)"

  # Warn if over 100KB template budget (data will add more, that is expected)
  TEMPLATE_SIZE=$(wc -c < "$TEMPLATE_FILE" | tr -d ' ')
  TEMPLATE_SIZE_KB=$((TEMPLATE_SIZE / 1024))
  log_info "Template size: ${TEMPLATE_SIZE_KB}KB"
else
  log_error "Failed to generate HTML report"
  exit 1
fi

# =============================================================================
# OPEN IN BROWSER
# =============================================================================

if [[ "$OPEN_AFTER" == "true" ]]; then
  if command -v open &>/dev/null; then
    open "$OUTPUT_FILE"
    log_ok "Opened report in browser"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$OUTPUT_FILE"
    log_ok "Opened report in browser"
  else
    log_warn "Cannot auto-open report. Open manually: $OUTPUT_FILE"
  fi
fi

exit 0
