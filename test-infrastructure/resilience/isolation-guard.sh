#!/bin/bash
# =============================================================================
# isolation-guard.sh -- Test Isolation Verification
# Ensures tests don't leak state by snapshotting database state before and
# after test execution, then comparing the two snapshots.
#
# Usage:
#   ./resilience/isolation-guard.sh --before --snapshot-id mysuite
#   # ... run tests ...
#   ./resilience/isolation-guard.sh --after --snapshot-id mysuite
#   ./resilience/isolation-guard.sh --audit  # Run orphan + stale data checks
#
# Options:
#   --before              Capture pre-test snapshot
#   --after               Capture post-test snapshot and compare
#   --audit               Run full orphan check and stale data audit
#   --snapshot-id ID      Identifier for the snapshot pair (default: auto-generated)
#   --session-dir DIR     Directory for snapshot files (default: auto)
#   --allow-delta TABLE:N Allow N row delta on TABLE (repeatable)
#   --strict              Fail on ANY unexpected delta (default: warn)
#   --db-url URL          Database REST API URL (default: local supabase)
#
# Exit codes:
#   0  Isolation verified (no leaks or only allowed deltas)
#   1  Isolation violation detected
#   2  Usage error
#   3  Database connection failed
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/test-infrastructure"
SQL_DIR="$INFRA_DIR/sql"

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
# SAFETY: Always default to local Supabase. Never connect to production.
LOCAL_SUPABASE_URL="http://127.0.0.1:54321"
# Local Supabase default service role key (demo/dev only)
LOCAL_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# Tables to snapshot (all user-facing data tables)
TABLES=(
    "otp_requests"
    "payments"
    "tenancies"
    "waitlist_entries"
    "bank_accounts"
    "cashback_ledger"
    "notifications"
    "identity_verifications"
    "payment_schedules"
    "device_tokens"
    "referral_redemptions"
    "processed_webhooks"
    "idempotency_keys"
    "utility_verifications"
    "extracted_rental_info"
)

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
MODE=""  # before, after, audit
SNAPSHOT_ID=""
SESSION_DIR=""
STRICT=false
DB_URL="$LOCAL_SUPABASE_URL"
SERVICE_KEY="$LOCAL_SERVICE_KEY"
ALLOWED_DELTAS=""

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    echo "Usage: $0 MODE [OPTIONS]"
    echo ""
    echo "Modes:"
    echo "  --before              Capture pre-test snapshot"
    echo "  --after               Capture post-test snapshot and compare"
    echo "  --audit               Run orphan check and stale data audit"
    echo ""
    echo "Options:"
    echo "  --snapshot-id ID      Snapshot pair identifier"
    echo "  --session-dir DIR     Directory for snapshot files"
    echo "  --allow-delta T:N     Allow N row delta on table T (repeatable)"
    echo "  --strict              Fail on any unexpected delta"
    echo "  --db-url URL          REST API URL (default: local supabase)"
    echo "  --help                Show this help"
    exit 2
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --before)       MODE="before"; shift ;;
        --after)        MODE="after"; shift ;;
        --audit)        MODE="audit"; shift ;;
        --snapshot-id)  SNAPSHOT_ID="${2:?'--snapshot-id requires an ID'}"; shift 2 ;;
        --session-dir)  SESSION_DIR="${2:?'--session-dir requires a path'}"; shift 2 ;;
        --allow-delta)
            DELTA_SPEC="${2:?'--allow-delta requires TABLE:N'}"
            ALLOWED_DELTAS="${ALLOWED_DELTAS} ${DELTA_SPEC}"
            shift 2
            ;;
        --strict)       STRICT=true; shift ;;
        --db-url)
            DB_URL="${2:?'--db-url requires a URL'}"
            shift 2
            ;;
        --help)         usage ;;
        *)
            echo -e "${RED}Error: Unknown option '$1'${RESET}"
            usage
            ;;
    esac
done

if [ -z "$MODE" ]; then
    echo -e "${RED}Error: Mode is required (--before, --after, or --audit)${RESET}"
    usage
fi

# ---------------------------------------------------------------------------
# Safety check: refuse to run against production
# ---------------------------------------------------------------------------
PRODUCTION_REF="zqlowjveyqiagnbmfwsb"
if echo "$DB_URL" | grep -q "$PRODUCTION_REF"; then
    echo -e "${RED}SAFETY BLOCK: Refusing to run isolation checks against production database.${RESET}"
    echo -e "${RED}This tool must only run against the local Supabase instance.${RESET}"
    echo -e "${RED}URL: $DB_URL${RESET}"
    exit 2
fi

# ---------------------------------------------------------------------------
# Setup directories
# ---------------------------------------------------------------------------
if [ -z "$SNAPSHOT_ID" ]; then
    SNAPSHOT_ID="$(date +%Y%m%d-%H%M%S)"
fi

if [ -z "$SESSION_DIR" ]; then
    SESSION_DIR="$INFRA_DIR/orchestrator/reports/isolation"
fi
mkdir -p "$SESSION_DIR"

SNAPSHOT_DIR="$SESSION_DIR/$SNAPSHOT_ID"
mkdir -p "$SNAPSHOT_DIR"

# ---------------------------------------------------------------------------
# Database query helper
# ---------------------------------------------------------------------------
# Get row count for a table via REST API
get_table_count() {
    local table="$1"
    local response
    response=$(curl -s \
        -H "apikey: $SERVICE_KEY" \
        -H "Authorization: Bearer $SERVICE_KEY" \
        -H "Prefer: count=exact" \
        -H "Range: 0-0" \
        "${DB_URL}/rest/v1/${table}?select=id" \
        -D - 2>/dev/null)

    # Extract count from Content-Range header: */COUNT
    local count
    count=$(echo "$response" | grep -i "content-range" | sed 's/.*\///' | tr -d '\r\n ' || echo "-1")

    # Handle empty or wildcard count
    if [ -z "$count" ] || [ "$count" = "*" ]; then
        echo "0"
    else
        echo "$count"
    fi
}

# Check if local supabase is reachable
check_db_connection() {
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        "${DB_URL}/rest/v1/" \
        -H "apikey: $SERVICE_KEY" \
        --max-time 5 2>/dev/null || echo "000")

    if [ "$http_code" = "000" ] || [ "$http_code" = "503" ]; then
        echo -e "${RED}Error: Cannot connect to database at $DB_URL${RESET}"
        echo -e "${DIM}Is local Supabase running? Start with: supabase start${RESET}"
        exit 3
    fi
}

# ---------------------------------------------------------------------------
# Mode: before -- Capture pre-test snapshot
# ---------------------------------------------------------------------------
cmd_before() {
    echo -e "${BOLD}Isolation Guard: Pre-Test Snapshot${RESET}"
    echo -e "  Snapshot ID: ${CYAN}$SNAPSHOT_ID${RESET}"
    echo ""

    check_db_connection

    local snapshot_file="$SNAPSHOT_DIR/before.json"
    local snapshot_tmp="${snapshot_file}.tmp"

    echo -ne "  ${DIM}Snapshotting table row counts...${RESET} "

    local counts_json="{"
    local first=true
    for table in "${TABLES[@]}"; do
        local count
        count=$(get_table_count "$table")

        if [ "$first" = true ]; then
            first=false
        else
            counts_json+=","
        fi
        counts_json+="\"$table\": $count"
    done
    counts_json+="}"

    python3 -c "
import json
from datetime import datetime, timezone

snapshot = {
    'snapshot_id': '$SNAPSHOT_ID',
    'type': 'before',
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'db_url': '$DB_URL',
    'tables': json.loads('$counts_json')
}
print(json.dumps(snapshot, indent=2))
" > "$snapshot_tmp"
    mv "$snapshot_tmp" "$snapshot_file"

    echo -e "${GREEN}OK${RESET}"

    # Display counts
    python3 -c "
import json
data = json.load(open('$snapshot_file'))
for table, count in sorted(data['tables'].items()):
    print(f'    {table:<35} {count:>6} rows')
" 2>/dev/null

    echo ""
    echo -e "  ${DIM}Snapshot saved: $snapshot_file${RESET}"
}

# ---------------------------------------------------------------------------
# Mode: after -- Capture post-test snapshot and compare
# ---------------------------------------------------------------------------
cmd_after() {
    echo -e "${BOLD}Isolation Guard: Post-Test Comparison${RESET}"
    echo -e "  Snapshot ID: ${CYAN}$SNAPSHOT_ID${RESET}"
    echo ""

    local before_file="$SNAPSHOT_DIR/before.json"
    if [ ! -f "$before_file" ]; then
        echo -e "${RED}Error: No 'before' snapshot found for ID '$SNAPSHOT_ID'${RESET}"
        echo -e "${DIM}Run with --before first${RESET}"
        exit 1
    fi

    check_db_connection

    # Capture after counts
    echo -ne "  ${DIM}Snapshotting table row counts...${RESET} "

    local counts_json="{"
    local first=true
    for table in "${TABLES[@]}"; do
        local count
        count=$(get_table_count "$table")
        if [ "$first" = true ]; then first=false; else counts_json+=","; fi
        counts_json+="\"$table\": $count"
    done
    counts_json+="}"

    local after_file="$SNAPSHOT_DIR/after.json"
    local after_tmp="${after_file}.tmp"

    python3 -c "
import json
from datetime import datetime, timezone

snapshot = {
    'snapshot_id': '$SNAPSHOT_ID',
    'type': 'after',
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'db_url': '$DB_URL',
    'tables': json.loads('$counts_json')
}
print(json.dumps(snapshot, indent=2))
" > "$after_tmp"
    mv "$after_tmp" "$after_file"
    echo -e "${GREEN}OK${RESET}"
    echo ""

    # Build allowed deltas JSON for Python
    local allowed_json="{"
    local afirst=true
    for spec in $ALLOWED_DELTAS; do
        local key="${spec%%:*}"
        local val="${spec##*:}"
        if [ "$afirst" = true ]; then afirst=false; else allowed_json+=","; fi
        allowed_json+="\"$key\": $val"
    done
    allowed_json+="}"

    # Compare snapshots
    local comparison_file="$SNAPSHOT_DIR/comparison.json"
    local comparison_tmp="${comparison_file}.tmp"
    local violations=0

    # Use a temp file for the violation count to avoid fragile stderr parsing
    local violation_count_file
    violation_count_file="$(mktemp "${TMPDIR:-/tmp}/iso-guard-count.XXXXXX")"

    python3 -c "
import json, sys

before = json.load(open('$before_file'))
after = json.load(open('$after_file'))
allowed = json.loads('$allowed_json')
strict = $( [ "$STRICT" = true ] && echo "True" || echo "False" )

# Colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
DIM = '\033[2m'
BOLD = '\033[1m'
RESET = '\033[0m'

comparison = {
    'snapshot_id': '$SNAPSHOT_ID',
    'before_timestamp': before['timestamp'],
    'after_timestamp': after['timestamp'],
    'deltas': {},
    'violations': [],
    'allowed_deltas': allowed
}

violations = 0
print(f'{BOLD}  Table Comparison{RESET}')
print(f'  {\"Table\":<35} {\"Before\":>8} {\"After\":>8} {\"Delta\":>8}  Status')
print(f'  {\"-\"*75}')

for table in sorted(set(list(before['tables'].keys()) + list(after['tables'].keys()))):
    b = before['tables'].get(table, 0)
    a = after['tables'].get(table, 0)

    # Handle string counts
    try:
        b = int(b)
    except (ValueError, TypeError):
        b = 0
    try:
        a = int(a)
    except (ValueError, TypeError):
        a = 0

    delta = a - b
    allowed_delta = allowed.get(table, 0)

    comparison['deltas'][table] = {
        'before': b,
        'after': a,
        'delta': delta
    }

    if delta == 0:
        status = f'{GREEN}OK{RESET}'
    elif abs(delta) <= abs(allowed_delta):
        status = f'{YELLOW}ALLOWED{RESET} (delta={delta}, allowed={allowed_delta})'
    else:
        status = f'{RED}VIOLATION{RESET} (delta={delta})'
        violations += 1
        comparison['violations'].append({
            'table': table,
            'before': b,
            'after': a,
            'delta': delta,
            'allowed_delta': allowed_delta
        })

    delta_str = f'+{delta}' if delta > 0 else str(delta)
    print(f'  {table:<35} {b:>8} {a:>8} {delta_str:>8}  {status}')

# Write comparison file
with open('$comparison_tmp', 'w') as f:
    comparison['violation_count'] = violations
    comparison['result'] = 'pass' if violations == 0 else 'fail'
    json.dump(comparison, f, indent=2)

# Write violation count to temp file for bash to read
with open('$violation_count_file', 'w') as f:
    f.write(str(violations))

print()
if violations > 0:
    print(f'  {RED}{BOLD}ISOLATION VIOLATION: {violations} table(s) have unexpected row count changes{RESET}')
    print(f'  {DIM}This indicates tests may be leaking state into the database.{RESET}')
    if not strict:
        print(f'  {DIM}Use --strict to fail on violations, or --allow-delta TABLE:N to whitelist.{RESET}')
else:
    print(f'  {GREEN}Isolation verified: no unexpected state leakage{RESET}')
"

    # Move comparison file
    if [ -f "$comparison_tmp" ]; then
        mv "$comparison_tmp" "$comparison_file"
    fi

    # Read violation count from temp file
    violations=$(cat "$violation_count_file" 2>/dev/null || echo "0")
    rm -f "$violation_count_file"

    # Ensure violations is a number
    if ! [[ "$violations" =~ ^[0-9]+$ ]]; then
        violations=0
    fi

    echo ""
    echo -e "  ${DIM}Comparison saved: $comparison_file${RESET}"

    if [ "$violations" -gt 0 ] && [ "$STRICT" = true ]; then
        exit 1
    elif [ "$violations" -gt 0 ]; then
        # Warn but don't fail
        return 0
    fi
}

# ---------------------------------------------------------------------------
# Mode: audit -- Run orphan check and stale data audit
# ---------------------------------------------------------------------------
cmd_audit() {
    echo -e "${BOLD}Isolation Guard: Database Audit${RESET}"
    echo ""

    check_db_connection

    local audit_file="$SNAPSHOT_DIR/audit-$(date +%Y%m%d-%H%M%S).json"
    local issues=0

    # --- Orphan Check ---
    echo -e "  ${BOLD}Orphan Check${RESET}"
    echo -e "  ${DIM}Checking FK integrity across all tables...${RESET}"

    if [ -f "$SQL_DIR/orphan-check.sql" ]; then
        echo -e "  ${DIM}SQL file found: $SQL_DIR/orphan-check.sql${RESET}"
        echo -e "  ${YELLOW}NOTE: Full orphan check requires psql or Supabase SQL Editor.${RESET}"
        echo -e "  ${DIM}Running lightweight REST API checks instead...${RESET}"
    fi

    # Lightweight orphan detection via REST API
    # Check for common orphan scenarios using the API
    echo ""
    local orphan_results="[]"

    # Check test user artifacts
    echo -ne "  ${DIM}Checking for test phone artifacts...${RESET} "
    local test_otps
    test_otps=$(curl -s \
        "${DB_URL}/rest/v1/otp_requests?phone=like.*999990*&select=id" \
        -H "apikey: $SERVICE_KEY" \
        -H "Authorization: Bearer $SERVICE_KEY" \
        -H "Prefer: count=exact" \
        -H "Range: 0-0" \
        -D - 2>/dev/null | grep -i "content-range" | sed 's/.*\///' | tr -d '\r\n ' || echo "0")

    if [ -n "$test_otps" ] && [ "$test_otps" != "0" ] && [ "$test_otps" != "*" ]; then
        echo -e "${YELLOW}found $test_otps OTP requests with test phones${RESET}"
        issues=$((issues + 1))
    else
        echo -e "${GREEN}clean${RESET}"
    fi

    # --- Stale Data Check ---
    echo ""
    echo -e "  ${BOLD}Stale Data Check${RESET}"

    if [ -f "$SQL_DIR/stale-data-audit.sql" ]; then
        echo -e "  ${DIM}SQL file found: $SQL_DIR/stale-data-audit.sql${RESET}"
        echo -e "  ${DIM}Running lightweight REST API checks...${RESET}"
    fi

    # Check for stale pending payments (older than 1 hour in local dev)
    echo -ne "  ${DIM}Checking for stale pending payments...${RESET} "
    local stale_payments
    stale_payments=$(curl -s \
        "${DB_URL}/rest/v1/payments?status=eq.pending&select=id" \
        -H "apikey: $SERVICE_KEY" \
        -H "Authorization: Bearer $SERVICE_KEY" \
        -H "Prefer: count=exact" \
        -H "Range: 0-0" \
        -D - 2>/dev/null | grep -i "content-range" | sed 's/.*\///' | tr -d '\r\n ' || echo "0")

    if [ -n "$stale_payments" ] && [ "$stale_payments" != "0" ] && [ "$stale_payments" != "*" ]; then
        echo -e "${YELLOW}$stale_payments pending payments found${RESET}"
    else
        echo -e "${GREEN}clean${RESET}"
    fi

    # --- Row Count Consistency ---
    echo ""
    echo -e "  ${BOLD}Row Count Summary${RESET}"
    echo -e "  ${DIM}$(printf '%.0s-' {1..50})${RESET}"

    local total_rows=0
    for table in "${TABLES[@]}"; do
        local count
        count=$(get_table_count "$table")
        if [ "$count" != "-1" ] && [ "$count" != "0" ]; then
            printf "  %-35s %6s rows\n" "$table" "$count"
            total_rows=$((total_rows + count))
        fi
    done

    echo -e "  ${DIM}$(printf '%.0s-' {1..50})${RESET}"
    printf "  %-35s %6s total\n" "ALL TABLES" "$total_rows"

    # --- Write audit result ---
    echo ""
    local audit_tmp="${audit_file}.tmp"
    python3 -c "
import json
from datetime import datetime, timezone

audit = {
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'db_url': '$DB_URL',
    'issues_found': $issues,
    'checks': {
        'test_phone_artifacts': '$test_otps',
        'stale_pending_payments': '$stale_payments',
        'total_rows': $total_rows
    },
    'result': 'pass' if $issues == 0 else 'warn'
}
print(json.dumps(audit, indent=2))
" > "$audit_tmp"
    mv "$audit_tmp" "$audit_file"

    echo -e "  ${DIM}Audit saved: $audit_file${RESET}"

    if [ "$issues" -gt 0 ]; then
        echo -e "  ${YELLOW}Issues found: $issues${RESET}"
        if [ "$STRICT" = true ]; then
            exit 1
        fi
    else
        echo -e "  ${GREEN}All audit checks passed${RESET}"
    fi
}

# ---------------------------------------------------------------------------
# Main dispatch
# ---------------------------------------------------------------------------
case "$MODE" in
    before) cmd_before ;;
    after)  cmd_after ;;
    audit)  cmd_audit ;;
    *)
        echo -e "${RED}Error: Invalid mode '$MODE'${RESET}"
        usage
        ;;
esac
