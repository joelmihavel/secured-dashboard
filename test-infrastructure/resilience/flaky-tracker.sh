#!/bin/bash
# =============================================================================
# flaky-tracker.sh -- Flaky Test Detection & Tracking
# Tracks test results across multiple sessions to detect flaky tests,
# manage quarantine, and generate reports with actionable recommendations.
#
# Usage:
#   ./resilience/flaky-tracker.sh record --test auth-otp.test.ts --result pass --session 20260227
#   ./resilience/flaky-tracker.sh record --test auth-otp.test.ts --result fail --session 20260227 --error "timeout"
#   ./resilience/flaky-tracker.sh report [--format text|json] [--min-runs 5]
#   ./resilience/flaky-tracker.sh quarantine --test flaky-test.ts [--reason "Intermittent timeout"]
#   ./resilience/flaky-tracker.sh unquarantine --test fixed-test.ts
#   ./resilience/flaky-tracker.sh check --test some-test.ts  (exit 0 if not quarantined, 1 if quarantined)
#   ./resilience/flaky-tracker.sh list-quarantined
#   ./resilience/flaky-tracker.sh prune --keep-runs 20
#
# Exit codes:
#   0  Success
#   1  Test is quarantined (for check command) or operation failed
#   2  Usage error
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/test-infrastructure"
RESILIENCE_DIR="$INFRA_DIR/resilience"
HISTORY_FILE="$RESILIENCE_DIR/.flaky-history.json"

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
# Constants
# ---------------------------------------------------------------------------
FLAKY_THRESHOLD=0.20       # >20% failure rate = flaky
WINDOW_SIZE=10             # Look at last N runs for flaky detection
AUTO_UNQUARANTINE_PASSES=5 # Consecutive passes to suggest unquarantine

# ---------------------------------------------------------------------------
# Ensure history file exists
# ---------------------------------------------------------------------------
initialize_history() {
    if [ ! -f "$HISTORY_FILE" ]; then
        local tmp="${HISTORY_FILE}.tmp"
        echo '{"tests": {}, "metadata": {"created_at": "'$(date -u '+%Y-%m-%dT%H:%M:%SZ')'", "version": 1}}' | \
            python3 -m json.tool > "$tmp"
        mv "$tmp" "$HISTORY_FILE"
    fi
}

# ---------------------------------------------------------------------------
# Atomic write helper
# ---------------------------------------------------------------------------
atomic_write_history() {
    local content="$1"
    local tmp="${HISTORY_FILE}.tmp"
    echo "$content" > "$tmp"
    mv "$tmp" "$HISTORY_FILE"
}

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  record             Record a test result"
    echo "  report             Generate flaky test report"
    echo "  quarantine         Quarantine a flaky test"
    echo "  unquarantine       Remove a test from quarantine"
    echo "  check              Check if a test is quarantined"
    echo "  list-quarantined   List all quarantined tests"
    echo "  prune              Remove old run history"
    echo ""
    echo "Run '$0 COMMAND --help' for command-specific help."
    exit 2
}

# ---------------------------------------------------------------------------
# Command: record
# ---------------------------------------------------------------------------
cmd_record() {
    local test_name=""
    local result=""
    local session=""
    local error=""
    local layer=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --test)    test_name="${2:?'--test requires a name'}"; shift 2 ;;
            --result)  result="${2:?'--result requires pass|fail'}"; shift 2 ;;
            --session) session="${2:?'--session requires an ID'}"; shift 2 ;;
            --error)   error="${2:-}"; shift 2 ;;
            --layer)   layer="${2:-}"; shift 2 ;;
            --help)
                echo "Usage: $0 record --test NAME --result pass|fail [--session ID] [--error MSG] [--layer LAYER]"
                exit 0
                ;;
            *) echo -e "${RED}Error: Unknown option '$1'${RESET}"; exit 2 ;;
        esac
    done

    if [ -z "$test_name" ] || [ -z "$result" ]; then
        echo -e "${RED}Error: --test and --result are required${RESET}"
        exit 2
    fi
    if [[ ! "$result" =~ ^(pass|fail)$ ]]; then
        echo -e "${RED}Error: --result must be pass or fail${RESET}"
        exit 2
    fi
    if [ -z "$session" ]; then
        session="$(date +%Y%m%d-%H%M%S)"
    fi

    initialize_history

    local current_history
    current_history="$(cat "$HISTORY_FILE")"

    local new_history
    new_history=$(python3 -c "
import json, sys
from datetime import datetime, timezone

history = json.loads(sys.stdin.read())
test_name = '$test_name'
result = '$result'
session = '$session'
error = '''$error'''
layer = '''$layer'''

if test_name not in history['tests']:
    history['tests'][test_name] = {
        'runs': [],
        'flaky_rate': 0.0,
        'quarantined': False,
        'last_failure': None,
        'last_pass': None,
        'consecutive_passes': 0,
        'consecutive_failures': 0,
        'total_runs': 0,
        'total_failures': 0
    }

entry = history['tests'][test_name]

# Record the run
run_record = {
    'session': session,
    'result': result,
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
if error:
    run_record['error'] = error
if layer:
    run_record['layer'] = layer

entry['runs'].append(run_record)
entry['total_runs'] = len(entry['runs'])

# Update consecutive counters
if result == 'pass':
    entry['consecutive_passes'] = entry.get('consecutive_passes', 0) + 1
    entry['consecutive_failures'] = 0
    entry['last_pass'] = session
else:
    entry['consecutive_failures'] = entry.get('consecutive_failures', 0) + 1
    entry['consecutive_passes'] = 0
    entry['last_failure'] = session
    entry['total_failures'] = entry.get('total_failures', 0) + 1

# Calculate flaky rate over last $WINDOW_SIZE runs
window = entry['runs'][-$WINDOW_SIZE:]
failures_in_window = sum(1 for r in window if r['result'] == 'fail')
entry['flaky_rate'] = round(failures_in_window / len(window), 4) if window else 0.0

# Detect new flakiness
is_flaky = entry['flaky_rate'] > $FLAKY_THRESHOLD and len(window) >= 3
entry['is_flaky'] = is_flaky

# Auto-unquarantine suggestion
if entry.get('quarantined') and entry.get('consecutive_passes', 0) >= $AUTO_UNQUARANTINE_PASSES:
    entry['suggest_unquarantine'] = True

history['metadata']['updated_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

print(json.dumps(history, indent=2))
" <<< "$current_history")

    atomic_write_history "$new_history"

    # Check if we should alert about flakiness
    local is_flaky
    is_flaky=$(python3 -c "
import json, sys
h = json.loads(sys.stdin.read())
t = h['tests'].get('$test_name', {})
print('yes' if t.get('is_flaky') else 'no')
" <<< "$new_history")

    if [ "$is_flaky" = "yes" ]; then
        echo -e "  ${YELLOW}FLAKY${RESET} $test_name (result: $result, rate: >$(awk "BEGIN {printf \"%.0f\", $FLAKY_THRESHOLD * 100}")%)"
    else
        case "$result" in
            pass) echo -e "  ${GREEN}PASS${RESET} $test_name recorded" ;;
            fail) echo -e "  ${RED}FAIL${RESET} $test_name recorded${error:+ -- $error}" ;;
        esac
    fi

    # Check for auto-unquarantine suggestion
    local suggest
    suggest=$(python3 -c "
import json, sys
h = json.loads(sys.stdin.read())
t = h['tests'].get('$test_name', {})
print('yes' if t.get('suggest_unquarantine') else 'no')
" <<< "$new_history")

    if [ "$suggest" = "yes" ]; then
        echo -e "  ${CYAN}SUGGESTION${RESET}: $test_name has passed $AUTO_UNQUARANTINE_PASSES consecutive times. Consider unquarantining."
    fi
}

# ---------------------------------------------------------------------------
# Command: report
# ---------------------------------------------------------------------------
cmd_report() {
    local format="text"
    local min_runs=3

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --format)    format="${2:?'--format requires text|json'}"; shift 2 ;;
            --min-runs)  min_runs="${2:?'--min-runs requires a number'}"; shift 2 ;;
            --help)
                echo "Usage: $0 report [--format text|json] [--min-runs N]"
                exit 0
                ;;
            *) echo -e "${RED}Error: Unknown option '$1'${RESET}"; exit 2 ;;
        esac
    done

    initialize_history

    if [ "$format" = "json" ]; then
        python3 -c "
import json, sys

history = json.loads(sys.stdin.read())
min_runs = $min_runs

report = {
    'flaky_tests': [],
    'quarantined_tests': [],
    'stable_tests': [],
    'suggestions': [],
    'summary': {}
}

for name, data in sorted(history.get('tests', {}).items()):
    total = data.get('total_runs', 0)
    if total < min_runs:
        continue

    entry = {
        'test': name,
        'total_runs': total,
        'flaky_rate': data.get('flaky_rate', 0),
        'quarantined': data.get('quarantined', False),
        'consecutive_passes': data.get('consecutive_passes', 0),
        'consecutive_failures': data.get('consecutive_failures', 0),
        'last_failure': data.get('last_failure'),
    }

    if data.get('quarantined'):
        report['quarantined_tests'].append(entry)
        if data.get('suggest_unquarantine'):
            report['suggestions'].append({
                'test': name,
                'action': 'unquarantine',
                'reason': f'Passed {data.get(\"consecutive_passes\", 0)} consecutive times'
            })
    elif data.get('is_flaky') or data.get('flaky_rate', 0) > $FLAKY_THRESHOLD:
        report['flaky_tests'].append(entry)
        if not data.get('quarantined'):
            report['suggestions'].append({
                'test': name,
                'action': 'quarantine',
                'reason': f'Flaky rate: {data.get(\"flaky_rate\", 0)*100:.1f}%'
            })
    else:
        report['stable_tests'].append(entry)

report['summary'] = {
    'total_tracked': len(history.get('tests', {})),
    'flaky_count': len(report['flaky_tests']),
    'quarantined_count': len(report['quarantined_tests']),
    'stable_count': len(report['stable_tests']),
    'suggestion_count': len(report['suggestions'])
}

print(json.dumps(report, indent=2))
" < "$HISTORY_FILE"
    else
        # Text format report
        python3 -c "
import json, sys

history = json.loads(sys.stdin.read())
min_runs = $min_runs

# Colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
CYAN = '\033[0;36m'
DIM = '\033[2m'
BOLD = '\033[1m'
RESET = '\033[0m'

tests = history.get('tests', {})
if not tests:
    print(f'{DIM}No test history recorded yet.{RESET}')
    sys.exit(0)

flaky = []
quarantined = []
stable = []
suggestions = []

for name, data in sorted(tests.items()):
    total = data.get('total_runs', 0)
    if total < min_runs:
        continue

    if data.get('quarantined'):
        quarantined.append((name, data))
        if data.get('suggest_unquarantine'):
            suggestions.append((name, 'unquarantine', f'Passed {data.get(\"consecutive_passes\", 0)} times consecutively'))
    elif data.get('is_flaky') or data.get('flaky_rate', 0) > $FLAKY_THRESHOLD:
        flaky.append((name, data))
        suggestions.append((name, 'quarantine', f'Flaky rate: {data.get(\"flaky_rate\", 0)*100:.1f}%'))
    else:
        stable.append((name, data))

print(f'{BOLD}Flaky Test Report{RESET}')
print(f'{DIM}{\"=\"*60}{RESET}')
print()

# Summary
total_tracked = len([t for t in tests.values() if t.get('total_runs', 0) >= min_runs])
print(f'  Tracked: {total_tracked}  Flaky: {RED}{len(flaky)}{RESET}  Quarantined: {YELLOW}{len(quarantined)}{RESET}  Stable: {GREEN}{len(stable)}{RESET}')
print()

# Flaky tests
if flaky:
    print(f'{RED}{BOLD}Flaky Tests ({len(flaky)}){RESET}')
    print(f'{DIM}{\"-\"*60}{RESET}')
    for name, data in sorted(flaky, key=lambda x: x[1].get('flaky_rate', 0), reverse=True):
        rate = data.get('flaky_rate', 0) * 100
        runs = data.get('total_runs', 0)
        last_fail = data.get('last_failure', 'never')
        consec_fail = data.get('consecutive_failures', 0)
        print(f'  {RED}{rate:5.1f}%{RESET}  {name}')
        print(f'         runs={runs} last_fail={last_fail} consec_fail={consec_fail}')
    print()

# Quarantined tests
if quarantined:
    print(f'{YELLOW}{BOLD}Quarantined Tests ({len(quarantined)}){RESET}')
    print(f'{DIM}{\"-\"*60}{RESET}')
    for name, data in quarantined:
        rate = data.get('flaky_rate', 0) * 100
        consec_pass = data.get('consecutive_passes', 0)
        reason = data.get('quarantine_reason', '')
        suggest = ' [suggest unquarantine]' if data.get('suggest_unquarantine') else ''
        print(f'  {YELLOW}{name}{RESET}')
        print(f'         rate={rate:.1f}% consec_passes={consec_pass}{\" reason=\" + reason if reason else \"\"}{CYAN}{suggest}{RESET}')
    print()

# Suggestions
if suggestions:
    print(f'{CYAN}{BOLD}Recommendations{RESET}')
    print(f'{DIM}{\"-\"*60}{RESET}')
    for name, action, reason in suggestions:
        if action == 'quarantine':
            print(f'  {RED}QUARANTINE{RESET}  {name}')
            print(f'             {reason}')
        else:
            print(f'  {GREEN}UNQUARANTINE{RESET}  {name}')
            print(f'               {reason}')
    print()

if not flaky and not quarantined:
    print(f'{GREEN}All tests are stable. No flaky tests detected.{RESET}')
    print()
" < "$HISTORY_FILE"
    fi
}

# ---------------------------------------------------------------------------
# Command: quarantine
# ---------------------------------------------------------------------------
cmd_quarantine() {
    local test_name=""
    local reason=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --test)   test_name="${2:?'--test requires a name'}"; shift 2 ;;
            --reason) reason="${2:-}"; shift 2 ;;
            --help)
                echo "Usage: $0 quarantine --test NAME [--reason MSG]"
                exit 0
                ;;
            *) echo -e "${RED}Error: Unknown option '$1'${RESET}"; exit 2 ;;
        esac
    done

    if [ -z "$test_name" ]; then
        echo -e "${RED}Error: --test is required${RESET}"
        exit 2
    fi

    initialize_history

    local current_history
    current_history="$(cat "$HISTORY_FILE")"

    local new_history
    new_history=$(python3 -c "
import json, sys
from datetime import datetime, timezone

history = json.loads(sys.stdin.read())
test_name = '$test_name'
reason = '''$reason'''

if test_name not in history['tests']:
    history['tests'][test_name] = {
        'runs': [],
        'flaky_rate': 0.0,
        'quarantined': False,
        'total_runs': 0,
        'total_failures': 0,
        'consecutive_passes': 0,
        'consecutive_failures': 0
    }

entry = history['tests'][test_name]
entry['quarantined'] = True
entry['quarantined_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
if reason:
    entry['quarantine_reason'] = reason
entry['suggest_unquarantine'] = False

history['metadata']['updated_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

print(json.dumps(history, indent=2))
" <<< "$current_history")

    atomic_write_history "$new_history"
    echo -e "  ${YELLOW}QUARANTINED${RESET} $test_name${reason:+ (reason: $reason)}"
}

# ---------------------------------------------------------------------------
# Command: unquarantine
# ---------------------------------------------------------------------------
cmd_unquarantine() {
    local test_name=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --test) test_name="${2:?'--test requires a name'}"; shift 2 ;;
            --help)
                echo "Usage: $0 unquarantine --test NAME"
                exit 0
                ;;
            *) echo -e "${RED}Error: Unknown option '$1'${RESET}"; exit 2 ;;
        esac
    done

    if [ -z "$test_name" ]; then
        echo -e "${RED}Error: --test is required${RESET}"
        exit 2
    fi

    initialize_history

    local current_history
    current_history="$(cat "$HISTORY_FILE")"

    local new_history
    new_history=$(python3 -c "
import json, sys
from datetime import datetime, timezone

history = json.loads(sys.stdin.read())
test_name = '$test_name'

if test_name not in history['tests']:
    print(json.dumps(history, indent=2))
    sys.exit(0)

entry = history['tests'][test_name]
was_quarantined = entry.get('quarantined', False)
entry['quarantined'] = False
entry['suggest_unquarantine'] = False
if 'quarantined_at' in entry:
    entry['unquarantined_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
if 'quarantine_reason' in entry:
    del entry['quarantine_reason']

history['metadata']['updated_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

print(json.dumps(history, indent=2))
" <<< "$current_history")

    atomic_write_history "$new_history"
    echo -e "  ${GREEN}UNQUARANTINED${RESET} $test_name"
}

# ---------------------------------------------------------------------------
# Command: check
# ---------------------------------------------------------------------------
cmd_check() {
    local test_name=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --test) test_name="${2:?'--test requires a name'}"; shift 2 ;;
            --help)
                echo "Usage: $0 check --test NAME"
                echo "Exit code 0 = not quarantined, 1 = quarantined"
                exit 0
                ;;
            *) echo -e "${RED}Error: Unknown option '$1'${RESET}"; exit 2 ;;
        esac
    done

    if [ -z "$test_name" ]; then
        echo -e "${RED}Error: --test is required${RESET}"
        exit 2
    fi

    initialize_history

    local is_quarantined
    is_quarantined=$(python3 -c "
import json, sys
history = json.loads(sys.stdin.read())
test = history.get('tests', {}).get('$test_name', {})
print('yes' if test.get('quarantined') else 'no')
" < "$HISTORY_FILE")

    if [ "$is_quarantined" = "yes" ]; then
        echo -e "  ${YELLOW}QUARANTINED${RESET} $test_name"
        exit 1
    else
        echo -e "  ${GREEN}ACTIVE${RESET} $test_name"
        exit 0
    fi
}

# ---------------------------------------------------------------------------
# Command: list-quarantined
# ---------------------------------------------------------------------------
cmd_list_quarantined() {
    initialize_history

    python3 -c "
import json, sys

history = json.loads(sys.stdin.read())

YELLOW = '\033[1;33m'
DIM = '\033[2m'
BOLD = '\033[1m'
RESET = '\033[0m'

quarantined = []
for name, data in sorted(history.get('tests', {}).items()):
    if data.get('quarantined'):
        quarantined.append((name, data))

if not quarantined:
    print(f'{DIM}No quarantined tests{RESET}')
    sys.exit(0)

print(f'{BOLD}Quarantined Tests ({len(quarantined)}){RESET}')
print(f'{DIM}{\"-\"*50}{RESET}')

for name, data in quarantined:
    since = data.get('quarantined_at', 'unknown')
    reason = data.get('quarantine_reason', '')
    consec = data.get('consecutive_passes', 0)
    print(f'  {YELLOW}{name}{RESET}')
    print(f'    since={since}{\" reason=\" + reason if reason else \"\"} consec_passes={consec}')

print()
" < "$HISTORY_FILE"
}

# ---------------------------------------------------------------------------
# Command: prune
# ---------------------------------------------------------------------------
cmd_prune() {
    local keep_runs=20

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --keep-runs) keep_runs="${2:?'--keep-runs requires a number'}"; shift 2 ;;
            --help)
                echo "Usage: $0 prune [--keep-runs N]"
                echo "Keep only the last N runs per test (default: 20)"
                exit 0
                ;;
            *) echo -e "${RED}Error: Unknown option '$1'${RESET}"; exit 2 ;;
        esac
    done

    initialize_history

    local current_history
    current_history="$(cat "$HISTORY_FILE")"

    local new_history
    new_history=$(python3 -c "
import json, sys
from datetime import datetime, timezone

history = json.loads(sys.stdin.read())
keep = $keep_runs
pruned_total = 0

for name, data in history.get('tests', {}).items():
    runs = data.get('runs', [])
    if len(runs) > keep:
        pruned_total += len(runs) - keep
        data['runs'] = runs[-keep:]

history['metadata']['updated_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
history['metadata']['last_pruned'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

print(json.dumps(history, indent=2))

import sys as s
s.stderr.write(str(pruned_total))
" <<< "$current_history" 2>/tmp/flaky-prune-count)

    atomic_write_history "$new_history"

    local pruned_count
    pruned_count=$(cat /tmp/flaky-prune-count 2>/dev/null || echo "0")
    rm -f /tmp/flaky-prune-count

    echo -e "  ${DIM}Pruned $pruned_count old run records (keeping last $keep_runs per test)${RESET}"
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
    record)           cmd_record "$@" ;;
    report)           cmd_report "$@" ;;
    quarantine)       cmd_quarantine "$@" ;;
    unquarantine)     cmd_unquarantine "$@" ;;
    check)            cmd_check "$@" ;;
    list-quarantined) cmd_list_quarantined "$@" ;;
    prune)            cmd_prune "$@" ;;
    --help|-h)        usage ;;
    *)
        echo -e "${RED}Error: Unknown command '$COMMAND'${RESET}"
        usage
        ;;
esac
