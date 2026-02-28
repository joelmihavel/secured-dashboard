#!/bin/bash
# =============================================================================
# watchdog.sh -- Long Session Watchdog
# Monitors a test session for resource exhaustion, process health, and
# simulator stability. Runs in background alongside the test orchestrator.
#
# Usage:
#   ./resilience/watchdog.sh --pid <orchestrator_pid> --max-memory 4G --max-duration 3600
#   ./resilience/watchdog.sh --pid 12345 --session-dir /path/to/session --interval 15
#
# Options:
#   --pid PID             PID of the orchestrator process to monitor (required)
#   --max-memory SIZE     Maximum memory threshold, e.g. 2G, 4G, 8G (default: 4G)
#   --max-duration SECS   Maximum session duration in seconds (default: 3600)
#   --session-dir DIR     Directory for watchdog logs and status (auto-created)
#   --interval SECS       Check interval in seconds (default: 30)
#   --no-simulator        Skip simulator health checks
#
# Exit codes:
#   0  Session completed normally
#   1  Session killed due to resource exhaustion
#   2  Usage error
#   3  Monitored process not found
# =============================================================================
set -uo pipefail

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/test-infrastructure"

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
# Defaults
# ---------------------------------------------------------------------------
TARGET_PID=""
MAX_MEMORY_BYTES=$((4 * 1024 * 1024 * 1024))  # 4GB
MAX_MEMORY_DISPLAY="4G"
MAX_DURATION=3600
SESSION_DIR=""
CHECK_INTERVAL=30
CHECK_SIMULATOR=true

# Simulator config
SIMULATOR_UUID="EA52887A-365C-495B-8618-16FBEE0E0990"
APP_BUNDLE_ID="com.flent.secured"

# Watchdog state
WATCHDOG_PID=$$
START_TIME=""
WATCHDOG_LOG=""
STATUS_FILE=""
MEMORY_WARN_SENT=false
CPU_WARN_START=0
SHUTDOWN_REQUESTED=false

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
cleanup() {
    SHUTDOWN_REQUESTED=true
    if [ -n "$STATUS_FILE" ]; then
        write_status "stopped" "Watchdog shutting down"
    fi
    echo -e "${DIM}[watchdog] Stopped${RESET}"
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    echo "Usage: $0 --pid PID [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --pid PID             PID of the process to monitor (required)"
    echo "  --max-memory SIZE     Memory threshold: 2G, 4G, 8G (default: 4G)"
    echo "  --max-duration SECS   Max session duration in seconds (default: 3600)"
    echo "  --session-dir DIR     Directory for logs/status"
    echo "  --interval SECS       Check interval in seconds (default: 30)"
    echo "  --no-simulator        Skip simulator health checks"
    echo "  --help                Show this help"
    exit 2
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --pid)
            TARGET_PID="${2:?'--pid requires a PID'}"
            shift 2
            ;;
        --max-memory)
            MAX_MEMORY_DISPLAY="${2:?'--max-memory requires a size'}"
            # Parse size like 2G, 4G, 512M
            case "$MAX_MEMORY_DISPLAY" in
                *G|*g)
                    MAX_MEMORY_BYTES=$(( ${MAX_MEMORY_DISPLAY%[Gg]} * 1024 * 1024 * 1024 ))
                    ;;
                *M|*m)
                    MAX_MEMORY_BYTES=$(( ${MAX_MEMORY_DISPLAY%[Mm]} * 1024 * 1024 ))
                    ;;
                *)
                    echo -e "${RED}Error: Invalid memory format '$MAX_MEMORY_DISPLAY'. Use e.g. 2G, 4G, 512M${RESET}"
                    exit 2
                    ;;
            esac
            shift 2
            ;;
        --max-duration)
            MAX_DURATION="${2:?'--max-duration requires seconds'}"
            shift 2
            ;;
        --session-dir)
            SESSION_DIR="${2:?'--session-dir requires a path'}"
            shift 2
            ;;
        --interval)
            CHECK_INTERVAL="${2:?'--interval requires seconds'}"
            shift 2
            ;;
        --no-simulator)
            CHECK_SIMULATOR=false
            shift
            ;;
        --help)
            usage
            ;;
        *)
            echo -e "${RED}Error: Unknown option '$1'${RESET}"
            usage
            ;;
    esac
done

if [ -z "$TARGET_PID" ]; then
    echo -e "${RED}Error: --pid is required${RESET}"
    usage
fi

# ---------------------------------------------------------------------------
# Verify target PID exists
# ---------------------------------------------------------------------------
if ! kill -0 "$TARGET_PID" 2>/dev/null; then
    echo -e "${RED}Error: Process $TARGET_PID not found${RESET}"
    exit 3
fi

# ---------------------------------------------------------------------------
# Setup session directory and log files
# ---------------------------------------------------------------------------
if [ -z "$SESSION_DIR" ]; then
    SESSION_ID="$(date +%Y%m%d-%H%M%S)"
    SESSION_DIR="$INFRA_DIR/orchestrator/reports/$SESSION_ID"
fi
mkdir -p "$SESSION_DIR"

WATCHDOG_LOG="$SESSION_DIR/watchdog.log"
STATUS_FILE="$SESSION_DIR/watchdog-status.json"
START_TIME="$(date +%s)"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log() {
    local level="$1"
    shift
    local msg="$*"
    local ts
    ts="$(date '+%Y-%m-%d %H:%M:%S')"
    echo "[$ts] [$level] $msg" >> "$WATCHDOG_LOG"

    case "$level" in
        ERROR)   echo -e "${RED}[watchdog] $msg${RESET}" ;;
        WARN)    echo -e "${YELLOW}[watchdog] $msg${RESET}" ;;
        INFO)    echo -e "${DIM}[watchdog] $msg${RESET}" ;;
        ACTION)  echo -e "${BOLD}[watchdog] $msg${RESET}" ;;
    esac
}

# ---------------------------------------------------------------------------
# JSON status output (atomic write)
# ---------------------------------------------------------------------------
write_status() {
    local status="$1"
    local message="${2:-}"
    local now
    now="$(date +%s)"
    local elapsed=$((now - START_TIME))

    local tmp_file="${STATUS_FILE}.tmp"
    python3 -c "
import json, sys
status = {
    'watchdog_pid': $WATCHDOG_PID,
    'target_pid': $TARGET_PID,
    'status': '$status',
    'message': '$message',
    'elapsed_seconds': $elapsed,
    'max_duration_seconds': $MAX_DURATION,
    'max_memory': '$MAX_MEMORY_DISPLAY',
    'check_interval': $CHECK_INTERVAL,
    'timestamp': '$(date -u '+%Y-%m-%dT%H:%M:%SZ')'
}
print(json.dumps(status, indent=2))
" > "$tmp_file"
    mv "$tmp_file" "$STATUS_FILE"
}

# ---------------------------------------------------------------------------
# Resource measurement helpers
# ---------------------------------------------------------------------------

# Get total RSS memory of a process tree in bytes
get_process_tree_memory() {
    local pid=$1
    local total_kb=0

    # Get all child PIDs recursively
    local pids
    pids=$(pgrep -P "$pid" 2>/dev/null || true)
    pids="$pid $pids"

    for p in $pids; do
        if kill -0 "$p" 2>/dev/null; then
            # macOS ps reports RSS in kilobytes
            local rss_kb
            rss_kb=$(ps -o rss= -p "$p" 2>/dev/null | tr -d ' ' || echo "0")
            total_kb=$((total_kb + rss_kb))
        fi
    done

    # Convert KB to bytes
    echo $((total_kb * 1024))
}

# Get CPU usage percentage (averaged over process tree)
get_process_tree_cpu() {
    local pid=$1
    local total_cpu=0

    local pids
    pids=$(pgrep -P "$pid" 2>/dev/null || true)
    pids="$pid $pids"

    for p in $pids; do
        if kill -0 "$p" 2>/dev/null; then
            local cpu
            cpu=$(ps -o %cpu= -p "$p" 2>/dev/null | tr -d ' ' || echo "0")
            # Convert to integer (bash doesn't do float math)
            cpu_int=$(python3 -c "print(int(float('${cpu}')))" 2>/dev/null || echo "0")
            total_cpu=$((total_cpu + cpu_int))
        fi
    done

    echo "$total_cpu"
}

# Get available disk space in bytes
get_disk_space_bytes() {
    # macOS df -b returns 512-byte blocks
    local blocks
    blocks=$(df -b "$SESSION_DIR" 2>/dev/null | tail -1 | awk '{print $4}')
    echo $((blocks * 512))
}

# Format bytes as human-readable
format_bytes() {
    local bytes=$1
    python3 -c "
b = $bytes
if b >= 1073741824:
    print(f'{b/1073741824:.1f}G')
elif b >= 1048576:
    print(f'{b/1048576:.1f}M')
elif b >= 1024:
    print(f'{b/1024:.1f}K')
else:
    print(f'{b}B')
"
}

# Check simulator status
check_simulator_status() {
    if [ "$CHECK_SIMULATOR" = false ]; then
        echo "skipped"
        return
    fi

    local state
    state=$(xcrun simctl list devices 2>/dev/null | grep "$SIMULATOR_UUID" | grep -oE '\((Booted|Shutdown|Shutting Down)\)' | tr -d '()' || echo "unknown")

    if [ -z "$state" ]; then
        echo "not_found"
    else
        echo "$state"
    fi
}

# Check if Node.js/Deno processes are healthy
check_runtime_health() {
    local node_procs
    node_procs=$(pgrep -f "node|deno" 2>/dev/null | wc -l | tr -d ' ')
    echo "$node_procs"
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

# Send SIGTERM to process tree, wait, then SIGKILL if necessary
kill_process_tree() {
    local pid=$1
    local reason="$2"

    log ACTION "Killing process tree (PID $pid): $reason"

    # Get all children first
    local children
    children=$(pgrep -P "$pid" 2>/dev/null || true)

    # Send SIGTERM to parent (which should propagate)
    kill -TERM "$pid" 2>/dev/null || true

    # Wait up to 10 seconds for graceful shutdown
    local waited=0
    while [ $waited -lt 10 ] && kill -0 "$pid" 2>/dev/null; do
        sleep 1
        waited=$((waited + 1))
    done

    # SIGKILL any survivors
    if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "$pid" 2>/dev/null || true
    fi
    for child in $children; do
        if kill -0 "$child" 2>/dev/null; then
            kill -KILL "$child" 2>/dev/null || true
        fi
    done
}

restart_simulator() {
    log ACTION "Restarting simulator $SIMULATOR_UUID"

    xcrun simctl shutdown "$SIMULATOR_UUID" 2>/dev/null || true
    sleep 2
    xcrun simctl boot "$SIMULATOR_UUID" 2>/dev/null || true
    sleep 3

    local new_state
    new_state=$(check_simulator_status)
    if [ "$new_state" = "Booted" ]; then
        log INFO "Simulator restarted successfully"
    else
        log ERROR "Simulator restart failed (state: $new_state)"
    fi
}

# ---------------------------------------------------------------------------
# Main monitoring loop
# ---------------------------------------------------------------------------
log INFO "Watchdog started for PID $TARGET_PID"
log INFO "Max memory: $MAX_MEMORY_DISPLAY, Max duration: ${MAX_DURATION}s, Interval: ${CHECK_INTERVAL}s"
write_status "running" "Monitoring started"

echo -e "${GREEN}[watchdog]${RESET} Monitoring PID $TARGET_PID (max mem: $MAX_MEMORY_DISPLAY, max time: ${MAX_DURATION}s)"
echo -e "${DIM}[watchdog] Log: $WATCHDOG_LOG${RESET}"
echo ""

CHECK_COUNT=0

while true; do
    # Check if the target process is still alive
    if ! kill -0 "$TARGET_PID" 2>/dev/null; then
        log INFO "Target process $TARGET_PID has exited"
        write_status "completed" "Target process exited normally"
        exit 0
    fi

    if [ "$SHUTDOWN_REQUESTED" = true ]; then
        break
    fi

    CHECK_COUNT=$((CHECK_COUNT + 1))
    NOW=$(date +%s)
    ELAPSED=$((NOW - START_TIME))

    # --- Duration check ---
    if [ "$ELAPSED" -ge "$MAX_DURATION" ]; then
        log ERROR "Maximum duration exceeded (${ELAPSED}s >= ${MAX_DURATION}s)"
        write_status "timeout" "Session exceeded maximum duration"
        kill_process_tree "$TARGET_PID" "Maximum duration exceeded"
        exit 1
    fi

    # Warn at 90% of duration
    DURATION_90=$((MAX_DURATION * 90 / 100))
    if [ "$ELAPSED" -ge "$DURATION_90" ]; then
        REMAINING=$((MAX_DURATION - ELAPSED))
        log WARN "Session approaching timeout: ${REMAINING}s remaining"
    fi

    # --- Memory check ---
    MEM_BYTES=$(get_process_tree_memory "$TARGET_PID")
    MEM_DISPLAY=$(format_bytes "$MEM_BYTES")
    MEM_PERCENT=$((MEM_BYTES * 100 / MAX_MEMORY_BYTES))

    if [ "$MEM_PERCENT" -ge 95 ]; then
        log ERROR "CRITICAL: Memory at ${MEM_PERCENT}% ($MEM_DISPLAY / $MAX_MEMORY_DISPLAY)"
        write_status "oom_kill" "Memory exceeded 95% threshold"

        # Collect memory snapshot before killing
        ps aux --sort=-%mem 2>/dev/null | head -20 > "$SESSION_DIR/memory-snapshot-oom.txt" || \
        ps -eo pid,rss,comm -r 2>/dev/null | head -20 > "$SESSION_DIR/memory-snapshot-oom.txt" || true

        kill_process_tree "$TARGET_PID" "Memory exceeded 95% ($MEM_DISPLAY / $MAX_MEMORY_DISPLAY)"
        exit 1
    elif [ "$MEM_PERCENT" -ge 80 ] && [ "$MEMORY_WARN_SENT" = false ]; then
        log WARN "Memory at ${MEM_PERCENT}% ($MEM_DISPLAY / $MAX_MEMORY_DISPLAY). Consider reducing parallel tests."
        MEMORY_WARN_SENT=true

        # Collect heap info
        ps -eo pid,rss,comm -r 2>/dev/null | head -20 > "$SESSION_DIR/memory-snapshot-warn.txt" || true
    fi

    # --- CPU check ---
    CPU_PERCENT=$(get_process_tree_cpu "$TARGET_PID")

    if [ "$CPU_PERCENT" -ge 95 ]; then
        if [ "$CPU_WARN_START" -eq 0 ]; then
            CPU_WARN_START=$NOW
        fi
        CPU_HIGH_DURATION=$((NOW - CPU_WARN_START))
        if [ "$CPU_HIGH_DURATION" -ge 300 ]; then
            log WARN "CPU at ${CPU_PERCENT}% for ${CPU_HIGH_DURATION}s (>5min)"
        fi
    else
        CPU_WARN_START=0
    fi

    # --- Disk space check ---
    DISK_BYTES=$(get_disk_space_bytes)
    DISK_DISPLAY=$(format_bytes "$DISK_BYTES")
    # Warn if less than 1GB remaining
    if [ "$DISK_BYTES" -lt $((1 * 1024 * 1024 * 1024)) ]; then
        log WARN "Low disk space: $DISK_DISPLAY remaining"
    fi

    # --- Simulator check ---
    SIM_STATUS="n/a"
    if [ "$CHECK_SIMULATOR" = true ]; then
        SIM_STATUS=$(check_simulator_status)
        if [ "$SIM_STATUS" = "Shutdown" ] || [ "$SIM_STATUS" = "Shutting Down" ]; then
            log WARN "Simulator is $SIM_STATUS -- attempting restart"
            restart_simulator
            SIM_STATUS=$(check_simulator_status)
        elif [ "$SIM_STATUS" = "not_found" ]; then
            log WARN "Simulator $SIMULATOR_UUID not found in device list"
        fi
    fi

    # --- Runtime health ---
    RUNTIME_PROCS=$(check_runtime_health)

    # --- Write periodic status ---
    # Write JSON status every check (for dashboard consumption)
    STATUS_TMP="${STATUS_FILE}.tmp"
    python3 -c "
import json
status = {
    'watchdog_pid': $WATCHDOG_PID,
    'target_pid': $TARGET_PID,
    'status': 'running',
    'check_number': $CHECK_COUNT,
    'elapsed_seconds': $ELAPSED,
    'max_duration_seconds': $MAX_DURATION,
    'resources': {
        'memory_bytes': $MEM_BYTES,
        'memory_display': '$MEM_DISPLAY',
        'memory_percent': $MEM_PERCENT,
        'max_memory': '$MAX_MEMORY_DISPLAY',
        'cpu_percent': $CPU_PERCENT,
        'disk_available': '$DISK_DISPLAY',
        'disk_available_bytes': $DISK_BYTES
    },
    'simulator': {
        'uuid': '$SIMULATOR_UUID',
        'status': '$SIM_STATUS'
    },
    'runtime_processes': $RUNTIME_PROCS,
    'timestamp': '$(date -u '+%Y-%m-%dT%H:%M:%SZ')'
}
print(json.dumps(status, indent=2))
" > "$STATUS_TMP"
    mv "$STATUS_TMP" "$STATUS_FILE"

    # Log summary every 4 checks (every ~2 minutes at default interval)
    if [ $((CHECK_COUNT % 4)) -eq 0 ]; then
        log INFO "Status: mem=${MEM_DISPLAY}(${MEM_PERCENT}%) cpu=${CPU_PERCENT}% disk=${DISK_DISPLAY} sim=${SIM_STATUS} elapsed=${ELAPSED}s procs=${RUNTIME_PROCS}"
    fi

    # --- Sleep until next check ---
    sleep "$CHECK_INTERVAL"
done
