#!/bin/bash
# =============================================================================
# session-manager.sh -- Session Persistence & Recovery
# Manages test session state for crash recovery, enabling long test runs to
# resume from where they left off after an unexpected interruption.
#
# Usage:
#   ./resilience/session-manager.sh init --layers backend,frontend,e2e
#   ./resilience/session-manager.sh checkpoint --layer backend --test auth-otp.test.ts --result pass
#   ./resilience/session-manager.sh checkpoint --layer backend --test auth-otp.test.ts --result fail --error "timeout" --retries 2 --duration 4200
#   ./resilience/session-manager.sh progress --layer frontend --current usePaymentFlow.test.ts --completed 45 --total 76
#   ./resilience/session-manager.sh resume [--session SESSION_ID]
#   ./resilience/session-manager.sh list
#   ./resilience/session-manager.sh status [--session SESSION_ID]
#   ./resilience/session-manager.sh clean --older-than 7d
#   ./resilience/session-manager.sh finalize [--session SESSION_ID]
#
# Exit codes:
#   0  Success
#   1  Operation failed
#   2  Usage error
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/test-infrastructure"
SESSION_BASE="$INFRA_DIR/orchestrator/.session"

# ---------------------------------------------------------------------------
# ANSI colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# Ensure session base directory exists
# ---------------------------------------------------------------------------
mkdir -p "$SESSION_BASE"

# ---------------------------------------------------------------------------
# JSON safety helpers
# ---------------------------------------------------------------------------

# Validate that a file contains valid JSON; restore from backup if corrupt
validate_json() {
    local file="$1"
    if [ ! -f "$file" ]; then return 1; fi
    if ! python3 -c "import json; json.load(open('$file'))" > /dev/null 2>&1; then
        echo -e "${YELLOW}WARNING: Corrupt JSON detected in $file${RESET}"
        if [ -f "${file}.bak" ]; then
            echo -e "${CYAN}Restoring from backup...${RESET}"
            cp "${file}.bak" "$file"
            # Verify the backup is also valid
            if ! python3 -c "import json; json.load(open('$file'))" > /dev/null 2>&1; then
                echo -e "${RED}ERROR: Backup is also corrupt${RESET}"
                return 1
            fi
            return 0
        fi
        return 1
    fi
    return 0
}

# Write JSON to a file, creating a .bak backup first, then atomic write
safe_json_write() {
    local file="$1"
    local content="$2"
    if [ -f "$file" ]; then
        cp "$file" "${file}.bak"
    fi
    local tmp="${file}.tmp"
    echo "$content" > "$tmp"
    mv "$tmp" "$file"
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Atomic JSON write: write to .tmp, then mv
atomic_write() {
    local target="$1"
    local content="$2"
    local tmp="${target}.tmp"
    echo "$content" > "$tmp"
    mv "$tmp" "$target"
}

# Get the latest session ID (most recent directory that contains state.json)
get_latest_session() {
    local session
    for dir in $(ls -1t "$SESSION_BASE" 2>/dev/null); do
        if [ -d "$SESSION_BASE/$dir" ] && [ -f "$SESSION_BASE/$dir/state.json" ]; then
            echo "$dir"
            return
        fi
    done
}

# Get session directory for a session ID
get_session_dir() {
    local session_id="$1"
    echo "$SESSION_BASE/$session_id"
}

# Get the state file path for a session
get_state_file() {
    local session_id="$1"
    echo "$(get_session_dir "$session_id")/state.json"
}

# Read the state JSON for a session
read_state() {
    local session_id="$1"
    local state_file
    state_file="$(get_state_file "$session_id")"
    if [ -f "$state_file" ]; then
        cat "$state_file"
    else
        echo ""
    fi
}

# Validate a session exists
require_session() {
    local session_id="$1"
    local state_file
    state_file="$(get_state_file "$session_id")"
    if [ ! -f "$state_file" ]; then
        echo -e "${RED}Error: Session '$session_id' not found${RESET}"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  init         Create a new test session"
    echo "  checkpoint   Record a test result within a session"
    echo "  progress     Update layer progress (current test, counts)"
    echo "  resume       Output remaining tests from a session for re-execution"
    echo "  list         Show all sessions with summary"
    echo "  status       Show detailed status of a session"
    echo "  finalize     Mark a session as completed"
    echo "  clean        Remove old sessions"
    echo ""
    echo "Run '$0 COMMAND --help' for command-specific help."
    exit 2
}

# ---------------------------------------------------------------------------
# Command: init
# ---------------------------------------------------------------------------
cmd_init() {
    local layers=""
    local session_id=""
    local test_counts="{}"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --layers)
                layers="${2:?'--layers requires comma-separated layer names'}"
                shift 2
                ;;
            --session-id)
                session_id="${2:?'--session-id requires an ID'}"
                shift 2
                ;;
            --test-counts)
                test_counts="${2:?'--test-counts requires JSON'}"
                shift 2
                ;;
            --help)
                echo "Usage: $0 init --layers backend,frontend,e2e [--session-id ID] [--test-counts '{\"backend\":20,\"frontend\":76}']"
                exit 0
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${RESET}"
                exit 2
                ;;
        esac
    done

    if [ -z "$layers" ]; then
        echo -e "${RED}Error: --layers is required${RESET}"
        exit 2
    fi

    # Generate session ID if not provided
    if [ -z "$session_id" ]; then
        session_id="$(date +%Y%m%d-%H%M%S)"
    fi

    local session_dir
    session_dir="$(get_session_dir "$session_id")"
    mkdir -p "$session_dir"

    # Build initial state JSON
    local state
    state=$(python3 -c "
import json, sys
from datetime import datetime, timezone

layers_str = '$layers'
test_counts_str = '''$test_counts'''
layer_names = [l.strip() for l in layers_str.split(',')]

try:
    counts = json.loads(test_counts_str)
except:
    counts = {}

layers = {}
for i, name in enumerate(layer_names):
    total = counts.get(name, 0)
    layers[name] = {
        'status': 'pending',
        'total': total,
        'passed': 0,
        'failed': 0,
        'skipped': 0,
        'tests': {},
        'order': i
    }

state = {
    'session_id': '$session_id',
    'started_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'updated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'status': 'in_progress',
    'layers': layers
}

print(json.dumps(state, indent=2))
")

    local state_file
    state_file="$(get_state_file "$session_id")"
    safe_json_write "$state_file" "$state"

    echo -e "${GREEN}Session initialized${RESET}"
    echo -e "  ID:     ${CYAN}$session_id${RESET}"
    echo -e "  Layers: $layers"
    echo -e "  Dir:    ${DIM}$session_dir${RESET}"

    # Output session ID for piping
    echo "$session_id"
}

# ---------------------------------------------------------------------------
# Command: checkpoint
# ---------------------------------------------------------------------------
cmd_checkpoint() {
    local session_id=""
    local layer=""
    local test_name=""
    local result=""
    local error=""
    local retries=0
    local duration_ms=0

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --session)
                session_id="${2:?'--session requires a session ID'}"
                shift 2
                ;;
            --layer)
                layer="${2:?'--layer requires a layer name'}"
                shift 2
                ;;
            --test)
                test_name="${2:?'--test requires a test name'}"
                shift 2
                ;;
            --result)
                result="${2:?'--result requires pass|fail|skip'}"
                shift 2
                ;;
            --error)
                error="${2:-}"
                shift 2
                ;;
            --retries)
                retries="${2:?'--retries requires a number'}"
                shift 2
                ;;
            --duration)
                duration_ms="${2:?'--duration requires milliseconds'}"
                shift 2
                ;;
            --help)
                echo "Usage: $0 checkpoint --layer LAYER --test TEST --result pass|fail|skip [--session ID] [--error MSG] [--retries N] [--duration MS]"
                exit 0
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${RESET}"
                exit 2
                ;;
        esac
    done

    # Validate required params
    if [ -z "$layer" ] || [ -z "$test_name" ] || [ -z "$result" ]; then
        echo -e "${RED}Error: --layer, --test, and --result are required${RESET}"
        exit 2
    fi
    if [[ ! "$result" =~ ^(pass|fail|skip)$ ]]; then
        echo -e "${RED}Error: --result must be pass, fail, or skip${RESET}"
        exit 2
    fi

    # Use latest session if not specified
    if [ -z "$session_id" ]; then
        session_id="$(get_latest_session)"
        if [ -z "$session_id" ]; then
            echo -e "${RED}Error: No sessions found. Run 'init' first.${RESET}"
            exit 1
        fi
    fi

    require_session "$session_id"

    local state_file
    state_file="$(get_state_file "$session_id")"

    # Validate JSON before reading
    if ! validate_json "$state_file"; then
        echo -e "${RED}Error: Cannot read session state (corrupt JSON)${RESET}"
        exit 1
    fi

    local current_state
    current_state="$(cat "$state_file")"

    # Update state with Python for safe JSON manipulation
    local new_state
    new_state=$(python3 -c "
import json, sys
from datetime import datetime, timezone

state = json.loads(sys.stdin.read())
layer = '$layer'
test_name = '$test_name'
result = '$result'
error = '''$error'''
retries = $retries
duration_ms = $duration_ms

if layer not in state['layers']:
    print(json.dumps({'error': f'Layer {layer} not found'}))
    sys.exit(0)

layer_data = state['layers'][layer]

# Update layer status if it was pending
if layer_data['status'] == 'pending':
    layer_data['status'] = 'in_progress'

# Record the test result
test_entry = {
    'status': result,
    'duration_ms': duration_ms,
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
if result == 'fail' and error:
    test_entry['error'] = error
if retries > 0:
    test_entry['retries'] = retries

layer_data['tests'][test_name] = test_entry

# Recount from test results for accuracy
layer_data['passed'] = sum(1 for t in layer_data['tests'].values() if t['status'] == 'pass')
layer_data['failed'] = sum(1 for t in layer_data['tests'].values() if t['status'] == 'fail')
layer_data['skipped'] = sum(1 for t in layer_data['tests'].values() if t['status'] == 'skip')

# Check if layer is completed (all tests recorded and total is known)
total_recorded = layer_data['passed'] + layer_data['failed'] + layer_data['skipped']
if layer_data['total'] > 0 and total_recorded >= layer_data['total']:
    layer_data['status'] = 'completed'

# Remove current_test if it was set and matches
if 'current_test' in layer_data and layer_data['current_test'] == test_name:
    del layer_data['current_test']

state['updated_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

print(json.dumps(state, indent=2))
" <<< "$current_state")

    # Check for Python error: if the output JSON contains an "error" key, report and exit
    local has_error
    has_error=$(echo "$new_state" | python3 -c "import json,sys; d=json.load(sys.stdin); print('yes' if 'error' in d else 'no')" 2>/dev/null || echo "no")
    if [ "$has_error" = "yes" ]; then
        local err_msg
        err_msg=$(echo "$new_state" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','unknown'))")
        echo -e "${RED}Error: $err_msg${RESET}"
        exit 1
    fi

    safe_json_write "$state_file" "$new_state"

    # Print status indicator
    case "$result" in
        pass) echo -e "  ${GREEN}PASS${RESET} ${layer}/${test_name} (${duration_ms}ms)" ;;
        fail) echo -e "  ${RED}FAIL${RESET} ${layer}/${test_name} (${duration_ms}ms) ${error:+-- $error}" ;;
        skip) echo -e "  ${YELLOW}SKIP${RESET} ${layer}/${test_name}" ;;
    esac
}

# ---------------------------------------------------------------------------
# Command: progress
# ---------------------------------------------------------------------------
cmd_progress() {
    local session_id=""
    local layer=""
    local current_test=""
    local completed=""
    local total=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --session)     session_id="${2:?'--session requires a session ID'}"; shift 2 ;;
            --layer)       layer="${2:?'--layer requires a layer name'}"; shift 2 ;;
            --current)     current_test="${2:?'--current requires a test name'}"; shift 2 ;;
            --completed)   completed="${2:?'--completed requires a number'}"; shift 2 ;;
            --total)       total="${2:?'--total requires a number'}"; shift 2 ;;
            --help)
                echo "Usage: $0 progress --layer LAYER [--current TEST] [--completed N] [--total N] [--session ID]"
                exit 0
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${RESET}"
                exit 2
                ;;
        esac
    done

    if [ -z "$layer" ]; then
        echo -e "${RED}Error: --layer is required${RESET}"
        exit 2
    fi

    if [ -z "$session_id" ]; then
        session_id="$(get_latest_session)"
        if [ -z "$session_id" ]; then
            echo -e "${RED}Error: No sessions found${RESET}"
            exit 1
        fi
    fi

    require_session "$session_id"

    local state_file
    state_file="$(get_state_file "$session_id")"

    # Validate JSON before reading
    if ! validate_json "$state_file"; then
        echo -e "${RED}Error: Cannot read session state (corrupt JSON)${RESET}"
        exit 1
    fi

    local current_state
    current_state="$(cat "$state_file")"

    local new_state
    new_state=$(python3 -c "
import json, sys
from datetime import datetime, timezone

state = json.loads(sys.stdin.read())
layer = '$layer'

if layer not in state['layers']:
    print(json.dumps(state, indent=2))
    sys.exit(0)

layer_data = state['layers'][layer]

if layer_data['status'] == 'pending':
    layer_data['status'] = 'in_progress'

current_test = '''$current_test'''
completed = '''$completed'''
total = '''$total'''

if current_test:
    layer_data['current_test'] = current_test
if completed:
    layer_data['completed_count'] = int(completed)
if total:
    layer_data['total'] = int(total)

state['updated_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
print(json.dumps(state, indent=2))
" <<< "$current_state")

    safe_json_write "$state_file" "$new_state"
    echo -e "  ${DIM}Progress: $layer${current_test:+ -> $current_test}${completed:+ ($completed done)}${RESET}"
}

# ---------------------------------------------------------------------------
# Command: resume
# ---------------------------------------------------------------------------
cmd_resume() {
    local session_id=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --session)
                session_id="${2:?'--session requires a session ID'}"
                shift 2
                ;;
            --help)
                echo "Usage: $0 resume [--session ID]"
                echo "Outputs remaining tests as JSON for re-execution."
                exit 0
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${RESET}"
                exit 2
                ;;
        esac
    done

    if [ -z "$session_id" ]; then
        session_id="$(get_latest_session)"
        if [ -z "$session_id" ]; then
            echo -e "${RED}Error: No sessions found${RESET}"
            exit 1
        fi
    fi

    require_session "$session_id"

    local state_file
    state_file="$(get_state_file "$session_id")"

    # Validate JSON before reading
    if ! validate_json "$state_file"; then
        echo -e "${RED}Error: Cannot read session state (corrupt JSON)${RESET}"
        exit 1
    fi

    local current_state
    current_state="$(cat "$state_file")"

    # Output remaining work as JSON
    python3 -c "
import json, sys

state = json.loads(sys.stdin.read())

remaining = {
    'session_id': state['session_id'],
    'started_at': state['started_at'],
    'layers': {}
}

for layer_name, layer_data in sorted(state['layers'].items(), key=lambda x: x[1].get('order', 0)):
    if layer_data['status'] == 'completed':
        continue

    completed_tests = set(layer_data.get('tests', {}).keys())
    failed_tests = [name for name, info in layer_data.get('tests', {}).items() if info['status'] == 'fail']

    remaining['layers'][layer_name] = {
        'status': layer_data['status'],
        'completed_tests': list(completed_tests),
        'failed_tests': failed_tests,
        'total': layer_data.get('total', 0),
        'remaining_count': max(0, layer_data.get('total', 0) - len(completed_tests)),
        'current_test': layer_data.get('current_test', None)
    }

print(json.dumps(remaining, indent=2))
" <<< "$current_state"
}

# ---------------------------------------------------------------------------
# Command: list
# ---------------------------------------------------------------------------
cmd_list() {
    local sessions
    sessions=$(ls -1t "$SESSION_BASE" 2>/dev/null)

    if [ -z "$sessions" ]; then
        echo -e "${YELLOW}No sessions found${RESET}"
        exit 0
    fi

    echo -e "${BOLD}Test Sessions${RESET}"
    echo -e "${DIM}$(printf '%.0s-' {1..72})${RESET}"
    printf "%-20s %-12s %-10s %-10s %-10s %-10s\n" "SESSION ID" "STATUS" "PASS" "FAIL" "SKIP" "LAYERS"
    echo -e "${DIM}$(printf '%.0s-' {1..72})${RESET}"

    while IFS= read -r session_id; do
        local state_file
        state_file="$(get_state_file "$session_id")"
        if [ ! -f "$state_file" ]; then
            continue
        fi

        # Skip sessions with corrupt JSON
        if ! validate_json "$state_file"; then
            printf "%-20s %-12s %-10s %-10s %-10s %-10s\n" "$session_id" "CORRUPT" "-" "-" "-" "-"
            continue
        fi

        python3 -c "
import json, sys

state = json.loads(sys.stdin.read())
status = state.get('status', 'unknown')

total_pass = sum(l.get('passed', 0) for l in state.get('layers', {}).values())
total_fail = sum(l.get('failed', 0) for l in state.get('layers', {}).values())
total_skip = sum(l.get('skipped', 0) for l in state.get('layers', {}).values())

layer_statuses = []
for name, layer in sorted(state.get('layers', {}).items(), key=lambda x: x[1].get('order', 0)):
    s = layer.get('status', '?')
    icon = {'completed': '+', 'in_progress': '~', 'pending': '.', 'failed': 'x'}.get(s, '?')
    layer_statuses.append(f'{icon}{name}')

layers_str = ' '.join(layer_statuses)

print(f\"{'$session_id':<20} {status:<12} {total_pass:<10} {total_fail:<10} {total_skip:<10} {layers_str}\")
" < "$state_file"
    done <<< "$sessions"

    echo ""
}

# ---------------------------------------------------------------------------
# Command: status
# ---------------------------------------------------------------------------
cmd_status() {
    local session_id=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --session)
                session_id="${2:?'--session requires a session ID'}"
                shift 2
                ;;
            --json)
                # Output raw JSON
                if [ -z "$session_id" ]; then session_id="$(get_latest_session)"; fi
                if [ -z "$session_id" ]; then echo "{}"; exit 0; fi
                local json_file
                json_file="$(get_state_file "$session_id")"
                if validate_json "$json_file"; then
                    cat "$json_file"
                else
                    echo "{}"
                fi
                exit 0
                ;;
            --help)
                echo "Usage: $0 status [--session ID] [--json]"
                exit 0
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${RESET}"
                exit 2
                ;;
        esac
    done

    if [ -z "$session_id" ]; then
        session_id="$(get_latest_session)"
        if [ -z "$session_id" ]; then
            echo -e "${YELLOW}No sessions found${RESET}"
            exit 0
        fi
    fi

    require_session "$session_id"

    local state_file
    state_file="$(get_state_file "$session_id")"

    # Validate JSON before reading
    if ! validate_json "$state_file"; then
        echo -e "${RED}Error: Cannot read session state (corrupt JSON)${RESET}"
        exit 1
    fi

    python3 -c "
import json, sys

state = json.loads(sys.stdin.read())
sid = state.get('session_id', 'unknown')
status = state.get('status', 'unknown')
started = state.get('started_at', 'unknown')
updated = state.get('updated_at', 'unknown')

# Colors (ANSI)
GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
CYAN = '\033[0;36m'
DIM = '\033[2m'
BOLD = '\033[1m'
RESET = '\033[0m'

print(f'{BOLD}Session: {CYAN}{sid}{RESET}')
print(f'  Status:  {status}')
print(f'  Started: {started}')
print(f'  Updated: {updated}')
print()

for name, layer in sorted(state.get('layers', {}).items(), key=lambda x: x[1].get('order', 0)):
    ls = layer.get('status', 'unknown')
    color = {
        'completed': GREEN,
        'in_progress': YELLOW,
        'pending': DIM,
        'failed': RED
    }.get(ls, RESET)

    passed = layer.get('passed', 0)
    failed = layer.get('failed', 0)
    skipped = layer.get('skipped', 0)
    total = layer.get('total', 0)
    recorded = passed + failed + skipped

    print(f'  {BOLD}{name}{RESET}: {color}{ls}{RESET}')
    if total > 0:
        pct = int(recorded / total * 100)
        bar_len = 30
        filled = int(bar_len * recorded / total)
        bar = '=' * filled + '-' * (bar_len - filled)
        print(f'    [{bar}] {recorded}/{total} ({pct}%)')
    print(f'    pass={GREEN}{passed}{RESET}  fail={RED}{failed}{RESET}  skip={YELLOW}{skipped}{RESET}')

    current = layer.get('current_test')
    if current:
        print(f'    Current: {DIM}{current}{RESET}')

    # Show failed tests
    failed_tests = [n for n, t in layer.get('tests', {}).items() if t['status'] == 'fail']
    if failed_tests:
        print(f'    {RED}Failed:{RESET}')
        for ft in failed_tests[:10]:
            err = layer['tests'][ft].get('error', '')
            err_str = f' -- {err[:60]}' if err else ''
            print(f'      - {ft}{err_str}')
        if len(failed_tests) > 10:
            print(f'      ... and {len(failed_tests) - 10} more')
    print()
" < "$state_file"
}

# ---------------------------------------------------------------------------
# Command: finalize
# ---------------------------------------------------------------------------
cmd_finalize() {
    local session_id=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --session)
                session_id="${2:?'--session requires a session ID'}"
                shift 2
                ;;
            --help)
                echo "Usage: $0 finalize [--session ID]"
                exit 0
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${RESET}"
                exit 2
                ;;
        esac
    done

    if [ -z "$session_id" ]; then
        session_id="$(get_latest_session)"
        if [ -z "$session_id" ]; then
            echo -e "${RED}Error: No sessions found${RESET}"
            exit 1
        fi
    fi

    require_session "$session_id"

    local state_file
    state_file="$(get_state_file "$session_id")"

    # Validate JSON before reading
    if ! validate_json "$state_file"; then
        echo -e "${RED}Error: Cannot read session state (corrupt JSON)${RESET}"
        exit 1
    fi

    local current_state
    current_state="$(cat "$state_file")"

    local new_state
    new_state=$(python3 -c "
import json, sys
from datetime import datetime, timezone

state = json.loads(sys.stdin.read())

# Finalize all layers
any_failures = False
for name, layer in state['layers'].items():
    if layer['status'] == 'in_progress':
        if layer.get('failed', 0) > 0:
            layer['status'] = 'completed'
            any_failures = True
        else:
            layer['status'] = 'completed'
    elif layer['status'] == 'pending':
        layer['status'] = 'skipped'
    elif layer.get('failed', 0) > 0:
        any_failures = True

    # Clean up transient fields
    if 'current_test' in layer:
        del layer['current_test']
    if 'completed_count' in layer:
        del layer['completed_count']

state['status'] = 'completed_with_failures' if any_failures else 'completed'
state['finished_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
state['updated_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

# Calculate totals
state['summary'] = {
    'total_passed': sum(l.get('passed', 0) for l in state['layers'].values()),
    'total_failed': sum(l.get('failed', 0) for l in state['layers'].values()),
    'total_skipped': sum(l.get('skipped', 0) for l in state['layers'].values()),
}
state['summary']['total_tests'] = state['summary']['total_passed'] + state['summary']['total_failed'] + state['summary']['total_skipped']

print(json.dumps(state, indent=2))
" <<< "$current_state")

    safe_json_write "$state_file" "$new_state"
    echo -e "${GREEN}Session $session_id finalized${RESET}"

    # Print summary
    python3 -c "
import json, sys
state = json.loads(sys.stdin.read())
s = state.get('summary', {})
total = s.get('total_tests', 0)
passed = s.get('total_passed', 0)
failed = s.get('total_failed', 0)
skipped = s.get('total_skipped', 0)
print(f'  Total: {total}  Passed: {passed}  Failed: {failed}  Skipped: {skipped}')
" <<< "$new_state"
}

# ---------------------------------------------------------------------------
# Command: clean
# ---------------------------------------------------------------------------
cmd_clean() {
    local older_than=""
    local dry_run=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --older-than)
                older_than="${2:?'--older-than requires a duration like 7d, 24h'}"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                echo "Usage: $0 clean --older-than 7d [--dry-run]"
                echo "Duration formats: Nd (days), Nh (hours)"
                exit 0
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${RESET}"
                exit 2
                ;;
        esac
    done

    if [ -z "$older_than" ]; then
        echo -e "${RED}Error: --older-than is required${RESET}"
        exit 2
    fi

    # Parse duration into seconds
    local seconds=0
    if [[ "$older_than" =~ ^([0-9]+)d$ ]]; then
        seconds=$(( ${BASH_REMATCH[1]} * 86400 ))
    elif [[ "$older_than" =~ ^([0-9]+)h$ ]]; then
        seconds=$(( ${BASH_REMATCH[1]} * 3600 ))
    else
        echo -e "${RED}Error: Invalid duration format '$older_than'. Use Nd or Nh (e.g. 7d, 24h)${RESET}"
        exit 2
    fi

    local cutoff
    cutoff=$(python3 -c "
from datetime import datetime, timezone, timedelta
cutoff = datetime.now(timezone.utc) - timedelta(seconds=$seconds)
print(cutoff.strftime('%Y-%m-%dT%H:%M:%SZ'))
")

    local removed=0
    local sessions
    sessions=$(ls -1 "$SESSION_BASE" 2>/dev/null)

    if [ -z "$sessions" ]; then
        echo -e "${DIM}No sessions to clean${RESET}"
        exit 0
    fi

    while IFS= read -r session_id; do
        local state_file
        state_file="$(get_state_file "$session_id")"
        if [ ! -f "$state_file" ]; then
            continue
        fi

        # Skip sessions with corrupt JSON (but still allow removal)
        if ! validate_json "$state_file"; then
            echo -e "  ${YELLOW}Skipping corrupt session: $session_id${RESET}"
            continue
        fi

        local should_remove
        should_remove=$(python3 -c "
import json, sys
from datetime import datetime, timezone

state = json.loads(sys.stdin.read())
started = state.get('started_at', '')
cutoff = '$cutoff'

try:
    started_dt = datetime.fromisoformat(started.replace('Z', '+00:00'))
    cutoff_dt = datetime.fromisoformat(cutoff.replace('Z', '+00:00'))
    print('yes' if started_dt < cutoff_dt else 'no')
except:
    print('no')
" < "$state_file")

        if [ "$should_remove" = "yes" ]; then
            if [ "$dry_run" = true ]; then
                echo -e "  ${DIM}Would remove: $session_id${RESET}"
            else
                rm -rf "$(get_session_dir "$session_id")"
                echo -e "  ${DIM}Removed: $session_id${RESET}"
            fi
            removed=$((removed + 1))
        fi
    done <<< "$sessions"

    if [ "$dry_run" = true ]; then
        echo -e "${YELLOW}Dry run: would remove $removed session(s)${RESET}"
    else
        echo -e "${GREEN}Cleaned $removed session(s) older than $older_than${RESET}"
    fi
}

# ---------------------------------------------------------------------------
# Main dispatch
# ---------------------------------------------------------------------------
if [ $# -eq 0 ]; then
    usage
fi

COMMAND="$1"
shift

case "$COMMAND" in
    init)       cmd_init "$@" ;;
    checkpoint) cmd_checkpoint "$@" ;;
    progress)   cmd_progress "$@" ;;
    resume)     cmd_resume "$@" ;;
    list)       cmd_list "$@" ;;
    status)     cmd_status "$@" ;;
    finalize)   cmd_finalize "$@" ;;
    clean)      cmd_clean "$@" ;;
    --help|-h)  usage ;;
    *)
        echo -e "${RED}Error: Unknown command '$COMMAND'${RESET}"
        usage
        ;;
esac
