#!/bin/bash
# =============================================================================
# failure-collector.sh -- Failure Artifact Collection
# Collects all relevant artifacts when a test fails, organizing them into a
# structured directory for post-mortem analysis and debugging.
#
# Usage:
#   ./resilience/failure-collector.sh --test sign-up.yaml --layer e2e --session-dir /path/to/session
#   ./resilience/failure-collector.sh --test auth-otp.test.ts --layer backend --output /path/to/output.txt
#   ./resilience/failure-collector.sh --test usePaymentFlow.test.ts --layer frontend --output /path/to/jest-output.txt
#
# Options:
#   --test NAME           Name of the failed test (required)
#   --layer LAYER         Test layer: backend, frontend, e2e (required)
#   --session-dir DIR     Session directory (default: auto-created in reports/)
#   --output FILE         Path to test output file to include
#   --error MSG           Error message to record
#   --exit-code N         Test exit code
#
# Exit codes:
#   0  Artifacts collected successfully
#   1  Collection failed (partial collection may still be available)
#   2  Usage error
# =============================================================================
set -uo pipefail

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/test-infrastructure"
RN_APP_DIR="$PROJECT_ROOT/rn-app"

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
# Configuration
# ---------------------------------------------------------------------------
SIMULATOR_UUID="EA52887A-365C-495B-8618-16FBEE0E0990"
APP_BUNDLE_ID="com.flent.secured"
LOCAL_SUPABASE_URL="http://127.0.0.1:54321"

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
TEST_NAME=""
LAYER=""
SESSION_DIR=""
OUTPUT_FILE=""
ERROR_MSG=""
EXIT_CODE=""

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
TMPDIR_COLLECT=""
cleanup() {
    if [ -n "$TMPDIR_COLLECT" ] && [ -d "$TMPDIR_COLLECT" ]; then
        rm -rf "$TMPDIR_COLLECT"
    fi
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    echo "Usage: $0 --test NAME --layer LAYER [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --test NAME           Failed test name (required)"
    echo "  --layer LAYER         backend | frontend | e2e (required)"
    echo "  --session-dir DIR     Session directory for artifacts"
    echo "  --output FILE         Test output file to include"
    echo "  --error MSG           Error message"
    echo "  --exit-code N         Test exit code"
    echo "  --help                Show this help"
    exit 2
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --test)        TEST_NAME="${2:?'--test requires a name'}"; shift 2 ;;
        --layer)       LAYER="${2:?'--layer requires backend|frontend|e2e'}"; shift 2 ;;
        --session-dir) SESSION_DIR="${2:?'--session-dir requires a path'}"; shift 2 ;;
        --output)      OUTPUT_FILE="${2:?'--output requires a file path'}"; shift 2 ;;
        --error)       ERROR_MSG="${2:-}"; shift 2 ;;
        --exit-code)   EXIT_CODE="${2:-}"; shift 2 ;;
        --help)        usage ;;
        *)
            echo -e "${RED}Error: Unknown option '$1'${RESET}"
            usage
            ;;
    esac
done

if [ -z "$TEST_NAME" ] || [ -z "$LAYER" ]; then
    echo -e "${RED}Error: --test and --layer are required${RESET}"
    usage
fi

if [[ ! "$LAYER" =~ ^(backend|frontend|e2e)$ ]]; then
    echo -e "${RED}Error: --layer must be backend, frontend, or e2e${RESET}"
    exit 2
fi

# ---------------------------------------------------------------------------
# Setup artifact directory
# ---------------------------------------------------------------------------
if [ -z "$SESSION_DIR" ]; then
    SESSION_DIR="$INFRA_DIR/orchestrator/reports/$(date +%Y%m%d-%H%M%S)"
fi

# Sanitize test name for directory use
SAFE_TEST_NAME="$(echo "$TEST_NAME" | tr '/' '_' | tr ' ' '_' | tr -cd '[:alnum:]._-')"
FAILURE_DIR="$SESSION_DIR/failures/$SAFE_TEST_NAME"
mkdir -p "$FAILURE_DIR"

TMPDIR_COLLECT="$(mktemp -d "${TMPDIR:-/tmp}/failure-collect.XXXXXX")"

echo -e "${BOLD}Failure Collector${RESET}"
echo -e "  Test:  ${RED}$TEST_NAME${RESET}"
echo -e "  Layer: $LAYER"
echo -e "  Dir:   ${DIM}$FAILURE_DIR${RESET}"
echo ""

COLLECTED=0

# ---------------------------------------------------------------------------
# Helper: safe copy (non-fatal if source doesn't exist)
# ---------------------------------------------------------------------------
safe_copy() {
    local src="$1"
    local dst="$2"
    if [ -f "$src" ]; then
        cp "$src" "$dst" 2>/dev/null && return 0
    fi
    return 1
}

# Helper: collect with status message
collect_artifact() {
    local description="$1"
    local target_file="$2"
    shift 2
    local cmd=("$@")

    echo -ne "  ${DIM}Collecting ${description}...${RESET} "

    if "${cmd[@]}" > "$target_file" 2>/dev/null; then
        # Check if file has content
        if [ -s "$target_file" ]; then
            local size
            size=$(wc -c < "$target_file" | tr -d ' ')
            echo -e "${GREEN}OK${RESET} (${size} bytes)"
            COLLECTED=$((COLLECTED + 1))
            return 0
        else
            rm -f "$target_file"
            echo -e "${DIM}empty${RESET}"
            return 1
        fi
    else
        rm -f "$target_file"
        echo -e "${DIM}unavailable${RESET}"
        return 1
    fi
}

# ---------------------------------------------------------------------------
# 1. Test output (provided via --output)
# ---------------------------------------------------------------------------
if [ -n "$OUTPUT_FILE" ] && [ -f "$OUTPUT_FILE" ]; then
    echo -ne "  ${DIM}Copying test output...${RESET} "
    cp "$OUTPUT_FILE" "$FAILURE_DIR/test-output.txt"
    echo -e "${GREEN}OK${RESET}"
    COLLECTED=$((COLLECTED + 1))

    # Extract stack trace from test output
    if grep -qE '(Error|at .+\(.+:[0-9]+:[0-9]+\)|Traceback|panic)' "$OUTPUT_FILE" 2>/dev/null; then
        echo -ne "  ${DIM}Extracting stack trace...${RESET} "
        grep -E '(Error|at .+\(.+:[0-9]+:[0-9]+\)|Traceback|panic|^\s+at )' "$OUTPUT_FILE" \
            > "$FAILURE_DIR/stack-trace.txt" 2>/dev/null || true
        if [ -s "$FAILURE_DIR/stack-trace.txt" ]; then
            echo -e "${GREEN}OK${RESET}"
            COLLECTED=$((COLLECTED + 1))
        else
            rm -f "$FAILURE_DIR/stack-trace.txt"
            echo -e "${DIM}no stack trace found${RESET}"
        fi
    fi
fi

# ---------------------------------------------------------------------------
# 2. System information
# ---------------------------------------------------------------------------
echo -ne "  ${DIM}Collecting system info...${RESET} "
python3 -c "
import json, subprocess, os, platform
from datetime import datetime, timezone

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        return result.stdout.strip()
    except:
        return 'unavailable'

# Memory info
vm_stat = run_cmd(['vm_stat'])
mem_lines = vm_stat.split('\n')
mem_info = {}
for line in mem_lines:
    if ':' in line:
        key, val = line.split(':', 1)
        val = val.strip().rstrip('.')
        try:
            mem_info[key.strip()] = int(val) * 4096  # pages to bytes
        except:
            pass

free_mem = mem_info.get('Pages free', 0) + mem_info.get('Pages inactive', 0)
total_mem_gb = float(run_cmd(['sysctl', '-n', 'hw.memsize'])) / (1024**3) if run_cmd(['sysctl', '-n', 'hw.memsize']) != 'unavailable' else 0

# Disk
df_output = run_cmd(['df', '-h', '$FAILURE_DIR'])
disk_line = df_output.split('\n')[-1] if df_output != 'unavailable' else ''
disk_parts = disk_line.split()
disk_available = disk_parts[3] if len(disk_parts) >= 4 else 'unknown'
disk_use_pct = disk_parts[4] if len(disk_parts) >= 5 else 'unknown'

# CPU load
load_avg = run_cmd(['sysctl', '-n', 'vm.loadavg']).strip('{ }')

# Simulator status
sim_status = 'unknown'
sim_output = run_cmd(['xcrun', 'simctl', 'list', 'devices'])
for line in sim_output.split('\n'):
    if '$SIMULATOR_UUID' in line:
        if 'Booted' in line:
            sim_status = 'Booted'
        elif 'Shutdown' in line:
            sim_status = 'Shutdown'
        break

info = {
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'test': '$TEST_NAME',
    'layer': '$LAYER',
    'exit_code': '$EXIT_CODE' if '$EXIT_CODE' else None,
    'error_message': '''$ERROR_MSG''' if '''$ERROR_MSG''' else None,
    'system': {
        'platform': platform.platform(),
        'python': platform.python_version(),
        'total_memory_gb': round(total_mem_gb, 1),
        'free_memory_bytes': free_mem,
        'cpu_load_avg': load_avg,
        'disk_available': disk_available,
        'disk_use_percent': disk_use_pct
    },
    'simulator': {
        'uuid': '$SIMULATOR_UUID',
        'status': sim_status
    },
    'node_version': run_cmd(['node', '--version']),
    'deno_version': run_cmd(['deno', '--version']).split('\n')[0] if run_cmd(['deno', '--version']) != 'unavailable' else 'unavailable',
    'cwd': os.getcwd()
}

print(json.dumps(info, indent=2))
" > "$FAILURE_DIR/system-info.json" 2>/dev/null
if [ -s "$FAILURE_DIR/system-info.json" ]; then
    echo -e "${GREEN}OK${RESET}"
    COLLECTED=$((COLLECTED + 1))
else
    echo -e "${DIM}failed${RESET}"
fi

# ---------------------------------------------------------------------------
# 3. Layer-specific artifacts
# ---------------------------------------------------------------------------
case "$LAYER" in
    # -------------------------------------------------------------------
    # E2E / Maestro artifacts
    # -------------------------------------------------------------------
    e2e)
        # Maestro screenshot
        echo -ne "  ${DIM}Capturing simulator screenshot...${RESET} "
        if xcrun simctl io "$SIMULATOR_UUID" screenshot "$FAILURE_DIR/screenshot.png" 2>/dev/null; then
            echo -e "${GREEN}OK${RESET}"
            COLLECTED=$((COLLECTED + 1))
        else
            echo -e "${DIM}unavailable${RESET}"
        fi

        # Copy the Maestro flow YAML if it exists
        FLOW_PATH=""
        # Try to find the flow file
        if [[ "$TEST_NAME" == *.yaml ]] || [[ "$TEST_NAME" == *.yml ]]; then
            # Check common locations
            for prefix in "$PROJECT_ROOT/maestro" "$PROJECT_ROOT/rn-app/maestro" "$PROJECT_ROOT"; do
                if [ -f "$prefix/$TEST_NAME" ]; then
                    FLOW_PATH="$prefix/$TEST_NAME"
                    break
                fi
            done
        fi
        if [ -n "$FLOW_PATH" ] && [ -f "$FLOW_PATH" ]; then
            echo -ne "  ${DIM}Copying flow YAML...${RESET} "
            cp "$FLOW_PATH" "$FAILURE_DIR/flow.yaml"
            echo -e "${GREEN}OK${RESET}"
            COLLECTED=$((COLLECTED + 1))
        fi

        # App logs from simulator
        collect_artifact "app logs (last 5min)" "$FAILURE_DIR/app-logs.txt" \
            xcrun simctl spawn "$SIMULATOR_UUID" log show --last 5m \
            --predicate "process == 'FlentSecured' OR process == '$APP_BUNDLE_ID'" \
            --style compact || true

        # Simulator console log
        collect_artifact "simulator console" "$FAILURE_DIR/simulator-console.txt" \
            xcrun simctl spawn "$SIMULATOR_UUID" log show --last 2m \
            --predicate "subsystem == 'com.apple.CoreSimulator'" \
            --style compact || true

        # Check for crash reports
        CRASH_DIR="$HOME/Library/Logs/DiagnosticReports"
        if [ -d "$CRASH_DIR" ]; then
            # Find crash reports from last 10 minutes
            RECENT_CRASHES=$(find "$CRASH_DIR" -name "FlentSecured*" -newer "$FAILURE_DIR" -mmin -10 2>/dev/null || true)
            if [ -n "$RECENT_CRASHES" ]; then
                echo -ne "  ${DIM}Collecting crash reports...${RESET} "
                mkdir -p "$FAILURE_DIR/crash-reports"
                echo "$RECENT_CRASHES" | while read -r crash_file; do
                    cp "$crash_file" "$FAILURE_DIR/crash-reports/" 2>/dev/null || true
                done
                echo -e "${GREEN}OK${RESET}"
                COLLECTED=$((COLLECTED + 1))
            fi
        fi

        # Maestro recording (if exists in default location)
        MAESTRO_RECORDINGS="$HOME/.maestro/recordings"
        if [ -d "$MAESTRO_RECORDINGS" ]; then
            LATEST_RECORDING=$(ls -1t "$MAESTRO_RECORDINGS"/*.mp4 2>/dev/null | head -1)
            if [ -n "$LATEST_RECORDING" ]; then
                # Only copy if it's recent (last 5 minutes)
                if find "$LATEST_RECORDING" -mmin -5 -print 2>/dev/null | grep -q .; then
                    echo -ne "  ${DIM}Copying Maestro recording...${RESET} "
                    cp "$LATEST_RECORDING" "$FAILURE_DIR/recording.mp4" 2>/dev/null || true
                    if [ -f "$FAILURE_DIR/recording.mp4" ]; then
                        echo -e "${GREEN}OK${RESET}"
                        COLLECTED=$((COLLECTED + 1))
                    else
                        echo -e "${DIM}failed${RESET}"
                    fi
                fi
            fi
        fi
        ;;

    # -------------------------------------------------------------------
    # Frontend / Jest artifacts
    # -------------------------------------------------------------------
    frontend)
        # Jest coverage report (if exists)
        COVERAGE_DIR="$RN_APP_DIR/coverage"
        if [ -d "$COVERAGE_DIR" ]; then
            echo -ne "  ${DIM}Collecting coverage summary...${RESET} "
            if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
                cp "$COVERAGE_DIR/coverage-summary.json" "$FAILURE_DIR/coverage-summary.json"
                echo -e "${GREEN}OK${RESET}"
                COLLECTED=$((COLLECTED + 1))
            else
                echo -e "${DIM}not found${RESET}"
            fi
        fi

        # Jest config for context
        if [ -f "$RN_APP_DIR/jest.config.js" ] || [ -f "$RN_APP_DIR/jest.config.ts" ]; then
            echo -ne "  ${DIM}Collecting Jest config...${RESET} "
            for cfg in "$RN_APP_DIR/jest.config.js" "$RN_APP_DIR/jest.config.ts"; do
                if [ -f "$cfg" ]; then
                    cp "$cfg" "$FAILURE_DIR/jest-config$(basename "$cfg" | sed 's/jest.config//')"
                    COLLECTED=$((COLLECTED + 1))
                fi
            done
            echo -e "${GREEN}OK${RESET}"
        fi

        # Node.js process info
        collect_artifact "node process info" "$FAILURE_DIR/node-processes.txt" \
            ps aux || true
        # Filter to just node processes
        if [ -f "$FAILURE_DIR/node-processes.txt" ]; then
            grep -E '(node|jest)' "$FAILURE_DIR/node-processes.txt" > "$FAILURE_DIR/node-processes-filtered.txt" 2>/dev/null || true
            if [ -s "$FAILURE_DIR/node-processes-filtered.txt" ]; then
                mv "$FAILURE_DIR/node-processes-filtered.txt" "$FAILURE_DIR/node-processes.txt"
            else
                rm -f "$FAILURE_DIR/node-processes-filtered.txt"
            fi
        fi

        # Metro bundler logs (if running)
        METRO_LOG="$RN_APP_DIR/.expo/packager-info.json"
        if [ -f "$METRO_LOG" ]; then
            echo -ne "  ${DIM}Collecting Metro info...${RESET} "
            cp "$METRO_LOG" "$FAILURE_DIR/metro-info.json"
            echo -e "${GREEN}OK${RESET}"
            COLLECTED=$((COLLECTED + 1))
        fi
        ;;

    # -------------------------------------------------------------------
    # Backend / Deno artifacts
    # -------------------------------------------------------------------
    backend)
        # Supabase edge function logs (local)
        collect_artifact "supabase function logs" "$FAILURE_DIR/edge-function-logs.txt" \
            bash -c "curl -s '${LOCAL_SUPABASE_URL}/functions/v1/' -o /dev/null -w '%{http_code}' 2>/dev/null && supabase functions logs --limit 100 2>/dev/null || echo 'Supabase local not running'" || true

        # Try to get the specific function name from test name
        FUNC_NAME=""
        if [[ "$TEST_NAME" =~ ^([a-z-]+)\.test\.(ts|js)$ ]]; then
            FUNC_NAME="${BASH_REMATCH[1]}"
        fi

        if [ -n "$FUNC_NAME" ]; then
            # Copy the edge function source for context
            FUNC_DIR="$PROJECT_ROOT/supabase/functions/$FUNC_NAME"
            if [ -d "$FUNC_DIR" ]; then
                echo -ne "  ${DIM}Copying function source...${RESET} "
                mkdir -p "$FAILURE_DIR/function-source"
                cp -r "$FUNC_DIR"/* "$FAILURE_DIR/function-source/" 2>/dev/null || true
                echo -e "${GREEN}OK${RESET}"
                COLLECTED=$((COLLECTED + 1))
            fi
        fi

        # Database state snapshot (local only -- NEVER against production)
        echo -ne "  ${DIM}Collecting DB state snapshot...${RESET} "
        python3 -c "
import json, subprocess

# Only connect to LOCAL supabase
# SAFETY: hardcoded local URL, never production
local_url = '${LOCAL_SUPABASE_URL}'

tables = [
    'otp_requests', 'payments', 'tenancies', 'waitlist_entries',
    'bank_accounts', 'cashback_ledger', 'notifications', 'identity_verifications'
]

state = {'source': 'local_supabase', 'url': local_url, 'tables': {}}

for table in tables:
    try:
        result = subprocess.run(
            ['curl', '-s', f'{local_url}/rest/v1/{table}?select=id&limit=1',
             '-H', 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
             '-H', 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
             '-H', 'Prefer: count=exact',
             '-H', 'Range: 0-0',
             '-D', '-'],
            capture_output=True, text=True, timeout=5
        )
        # Extract count from Content-Range header
        for line in result.stdout.split('\n'):
            if 'content-range' in line.lower():
                count = line.split('/')[-1].strip()
                state['tables'][table] = {'count': count}
                break
    except:
        state['tables'][table] = {'count': 'error'}

print(json.dumps(state, indent=2))
" > "$FAILURE_DIR/db-state-snapshot.json" 2>/dev/null
        if [ -s "$FAILURE_DIR/db-state-snapshot.json" ]; then
            echo -e "${GREEN}OK${RESET}"
            COLLECTED=$((COLLECTED + 1))
        else
            echo -e "${DIM}unavailable (local supabase may not be running)${RESET}"
            rm -f "$FAILURE_DIR/db-state-snapshot.json"
        fi

        # Deno process info
        collect_artifact "deno processes" "$FAILURE_DIR/deno-processes.txt" \
            bash -c "ps aux | grep -E 'deno|supabase' | grep -v grep" || true
        ;;
esac

# ---------------------------------------------------------------------------
# 4. Error message file
# ---------------------------------------------------------------------------
if [ -n "$ERROR_MSG" ]; then
    echo "$ERROR_MSG" > "$FAILURE_DIR/error-message.txt"
fi

# ---------------------------------------------------------------------------
# 5. Create failure manifest
# ---------------------------------------------------------------------------
echo -ne "  ${DIM}Writing manifest...${RESET} "
MANIFEST_TMP="$FAILURE_DIR/manifest.json.tmp"
python3 -c "
import json, os
from datetime import datetime, timezone

failure_dir = '$FAILURE_DIR'
artifacts = []

for fname in sorted(os.listdir(failure_dir)):
    fpath = os.path.join(failure_dir, fname)
    if os.path.isfile(fpath) and fname != 'manifest.json' and not fname.endswith('.tmp'):
        artifacts.append({
            'file': fname,
            'size_bytes': os.path.getsize(fpath)
        })
    elif os.path.isdir(fpath):
        dir_files = []
        for sub in sorted(os.listdir(fpath)):
            sub_path = os.path.join(fpath, sub)
            if os.path.isfile(sub_path):
                dir_files.append({
                    'file': f'{fname}/{sub}',
                    'size_bytes': os.path.getsize(sub_path)
                })
        artifacts.extend(dir_files)

manifest = {
    'test': '$TEST_NAME',
    'layer': '$LAYER',
    'collected_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'artifact_count': len(artifacts),
    'artifacts': artifacts,
    'failure_dir': failure_dir
}

if '$EXIT_CODE':
    manifest['exit_code'] = int('$EXIT_CODE') if '$EXIT_CODE'.isdigit() else None
if '''$ERROR_MSG''':
    manifest['error_summary'] = '''$ERROR_MSG'''[:500]

print(json.dumps(manifest, indent=2))
" > "$MANIFEST_TMP"
mv "$MANIFEST_TMP" "$FAILURE_DIR/manifest.json"
echo -e "${GREEN}OK${RESET}"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}--- Collection Summary ---${RESET}"
echo -e "  Artifacts: ${GREEN}$COLLECTED${RESET}"
echo -e "  Location:  ${DIM}$FAILURE_DIR${RESET}"

# List collected files
echo -e "  ${DIM}Files:${RESET}"
find "$FAILURE_DIR" -type f -not -name "*.tmp" | sort | while read -r f; do
    local_path="${f#$FAILURE_DIR/}"
    size=$(wc -c < "$f" | tr -d ' ')
    echo -e "    ${DIM}$local_path ($size bytes)${RESET}"
done
echo ""

exit 0
