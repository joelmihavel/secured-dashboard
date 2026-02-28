#!/bin/bash
# =============================================================================
# Production Release Readiness Checks
# =============================================================================
# Validates the codebase is ready for production deployment.
# Checks for hardcoded secrets, bundle config, env vars, and more.
#
# Usage: ./scripts/production-checks.sh [--verbose] [--fix]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RN_APP_DIR="$PROJECT_ROOT/rn-app"

VERBOSE=false
FIX_MODE=false
PASS=0
FAIL=0
WARN=0
ERRORS=()
WARNINGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verbose) VERBOSE=true; shift ;;
    --fix) FIX_MODE=true; shift ;;
    *) echo "Usage: $0 [--verbose] [--fix]"; exit 2 ;;
  esac
done

check_pass() { PASS=$((PASS + 1)); [ "$VERBOSE" = true ] && echo "  PASS  $1"; }
check_fail() { FAIL=$((FAIL + 1)); ERRORS+=("FAIL  $1"); echo "  FAIL  $1"; }
check_warn() { WARN=$((WARN + 1)); WARNINGS+=("WARN  $1"); [ "$VERBOSE" = true ] && echo "  WARN  $1"; }

echo "=== Production Readiness Checks ==="
echo ""

# ---------------------------------------------------------------------------
# Check 1: No hardcoded API keys in source
# ---------------------------------------------------------------------------
echo "--- Secret Scanning ---"
SECRET_PATTERNS='sk_live\|sk_test\|Bearer ey[A-Za-z0-9]\|SUPABASE_SERVICE_ROLE_KEY=ey\|password\s*=\s*["\x27][^"\x27]\{8,\}'

SECRETS_FOUND=$(grep -rn "$SECRET_PATTERNS" "$RN_APP_DIR/src/" "$RN_APP_DIR/app/" 2>/dev/null | grep -v node_modules | grep -v '.test.' | grep -v '__mocks__' || true)
if [ -z "$SECRETS_FOUND" ]; then
  check_pass "No hardcoded secrets in source"
else
  check_fail "Hardcoded secrets found in source code"
  echo "$SECRETS_FOUND" | head -5
fi

# ---------------------------------------------------------------------------
# Check 2: .env.example has all required vars
# ---------------------------------------------------------------------------
echo ""
echo "--- Environment Variables ---"
REQUIRED_VARS="EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY"
if [ -f "$RN_APP_DIR/.env.example" ]; then
  MISSING_VARS=""
  for var in $REQUIRED_VARS; do
    if ! grep -q "$var" "$RN_APP_DIR/.env.example"; then
      MISSING_VARS="$MISSING_VARS $var"
    fi
  done
  if [ -z "$MISSING_VARS" ]; then
    check_pass ".env.example has all required vars"
  else
    check_fail ".env.example missing:$MISSING_VARS"
  fi
else
  check_fail ".env.example not found"
fi

# ---------------------------------------------------------------------------
# Check 3: Sentry DSN configured for production
# ---------------------------------------------------------------------------
echo ""
echo "--- Sentry Configuration ---"
if grep -rq "SENTRY_DSN\|sentry.dsn\|dsn.*sentry" "$RN_APP_DIR/src/config/" "$RN_APP_DIR/app.json" 2>/dev/null; then
  check_pass "Sentry DSN reference found"
else
  check_warn "No Sentry DSN configuration found"
fi

# ---------------------------------------------------------------------------
# Check 4: No console.log in production code (except __DEV__ guarded)
# ---------------------------------------------------------------------------
echo ""
echo "--- Console Log Check ---"
CONSOLE_LOGS=$(grep -rn 'console\.log\|console\.warn\|console\.error' "$RN_APP_DIR/src/" "$RN_APP_DIR/app/" 2>/dev/null \
  | grep -v node_modules | grep -v '.test.' | grep -v '__mocks__' | grep -v '__DEV__' | grep -v '// eslint' || true)
LOG_COUNT=$(echo "$CONSOLE_LOGS" | grep -c '.' 2>/dev/null || echo "0")
if [ "$LOG_COUNT" -gt 10 ]; then
  check_warn "$LOG_COUNT unguarded console statements found"
else
  check_pass "Console log usage within limits ($LOG_COUNT)"
fi

# ---------------------------------------------------------------------------
# Check 5: All Supabase functions exist locally
# ---------------------------------------------------------------------------
echo ""
echo "--- Supabase Functions ---"
if [ -d "$PROJECT_ROOT/supabase/functions" ]; then
  LOCAL_FN_COUNT=$(find "$PROJECT_ROOT/supabase/functions" -mindepth 1 -maxdepth 1 -type d ! -name '_*' | wc -l | tr -d ' ')
  check_pass "$LOCAL_FN_COUNT edge functions found locally"
else
  check_fail "supabase/functions directory not found"
fi

# ---------------------------------------------------------------------------
# Check 6: TypeScript strict mode
# ---------------------------------------------------------------------------
echo ""
echo "--- TypeScript Config ---"
if grep -q '"strict": true' "$RN_APP_DIR/tsconfig.json" 2>/dev/null; then
  check_pass "TypeScript strict mode enabled"
else
  check_warn "TypeScript strict mode not enabled"
fi

# ---------------------------------------------------------------------------
# Check 7: No TODO/FIXME/HACK in critical paths
# ---------------------------------------------------------------------------
echo ""
echo "--- Code Quality ---"
CRITICAL_PATHS="$RN_APP_DIR/src/services $RN_APP_DIR/src/hooks $PROJECT_ROOT/supabase/functions"
TODO_COUNT=0
for path in $CRITICAL_PATHS; do
  if [ -d "$path" ]; then
    COUNT=$(grep -rn 'TODO\|FIXME\|HACK\|XXX' "$path" 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
    TODO_COUNT=$((TODO_COUNT + COUNT))
  fi
done
if [ "$TODO_COUNT" -gt 20 ]; then
  check_warn "$TODO_COUNT TODO/FIXME/HACK comments in critical paths"
else
  check_pass "TODO/FIXME count acceptable ($TODO_COUNT)"
fi

# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
echo ""
echo "=== Results ==="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  WARN: $WARN"
echo ""

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "--- Failures ---"
  for err in "${ERRORS[@]}"; do
    echo "  $err"
  done
  echo ""
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "--- Warnings ---"
  for warn in "${WARNINGS[@]}"; do
    echo "  $warn"
  done
  echo ""
fi

if [ $FAIL -gt 0 ]; then
  echo "Production readiness: NOT READY ($FAIL failures)"
  exit 1
else
  echo "Production readiness: READY ($WARN warnings)"
  exit 0
fi
