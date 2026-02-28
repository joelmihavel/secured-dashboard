#!/bin/bash
# PCI compliance check - scan codebase for card number patterns and sensitive data
# Usage: ./scripts/pci-compliance-check.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../../rn-app" && pwd)"
ISSUES=0

echo "=== PCI Compliance Check ==="
echo "Scanning: $APP_DIR"
echo ""

# Helper: search and report
check_pattern() {
  local description=$1
  local pattern=$2
  local search_dir=$3
  local exclude_dirs=${4:-"node_modules,.git,ios,android,.expo"}
  local severity=${5:-"CRITICAL"}

  local exclude_args=""
  IFS=',' read -ra EXCLUDES <<< "$exclude_dirs"
  for dir in "${EXCLUDES[@]}"; do
    exclude_args+=" --exclude-dir=$dir"
  done

  local results
  results=$(grep -rnE "$pattern" "$search_dir" $exclude_args 2>/dev/null || true)

  if [ -n "$results" ]; then
    ISSUES=$((ISSUES + 1))
    echo "[$severity] $description"
    echo "$results" | head -20
    local count
    count=$(echo "$results" | wc -l | tr -d ' ')
    if [ "$count" -gt 20 ]; then
      echo "  ... and $((count - 20)) more matches"
    fi
    echo ""
    return 1
  else
    echo "[PASS] $description"
    return 0
  fi
}

echo "--- Card Number Patterns ---"
echo ""

# 16-digit card number (standalone)
check_pattern \
  "16-digit card numbers in source code" \
  '\b[0-9]{16}\b' \
  "$APP_DIR/src" \
  "node_modules,.git,__tests__,__mocks__" \
  "CRITICAL" || true

# Card numbers with separators (4444-3333-2222-1111 or 4444 3333 2222 1111)
check_pattern \
  "Formatted card numbers (XXXX-XXXX-XXXX-XXXX)" \
  '\b[0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}\b' \
  "$APP_DIR/src" \
  "node_modules,.git,__tests__,__mocks__" \
  "CRITICAL" || true

# Known test card numbers that should NOT be in production source
check_pattern \
  "Known test card numbers (4111, 5500, 3782, 6011)" \
  '4111[\s-]?1111[\s-]?1111[\s-]?1111|5500[\s-]?0000[\s-]?0000[\s-]?0004|3782[\s-]?822463[\s-]?10005|6011[\s-]?0000[\s-]?0000[\s-]?0004' \
  "$APP_DIR/src" \
  "node_modules,.git,__tests__,__mocks__" \
  "HIGH" || true

echo ""
echo "--- CVV / Security Code Patterns ---"
echo ""

# CVV stored in state/storage (not input fields)
check_pattern \
  "CVV values in storage or state (not UI)" \
  'cvv.*=.*[0-9]{3,4}|security_code.*=.*[0-9]{3,4}|cvc.*=.*[0-9]{3,4}' \
  "$APP_DIR/src" \
  "node_modules,.git,__tests__,__mocks__,components" \
  "CRITICAL" || true

# CVV logged
check_pattern \
  "CVV in console.log or logging statements" \
  'console\.(log|warn|error|debug).*cvv|console\.(log|warn|error|debug).*security.?code' \
  "$APP_DIR/src" \
  "node_modules,.git" \
  "CRITICAL" || true

echo ""
echo "--- PAN (Permanent Account Number) Patterns ---"
echo ""

# Indian PAN number pattern (ABCDE1234F)
check_pattern \
  "PAN numbers in source (non-test files)" \
  '\b[A-Z]{5}[0-9]{4}[A-Z]\b' \
  "$APP_DIR/src" \
  "node_modules,.git,__tests__,__mocks__" \
  "HIGH" || true

echo ""
echo "--- Service Role Key Exposure ---"
echo ""

# Service role key in client-side code
check_pattern \
  "service_role key reference in client source" \
  'service_role|serviceRole|SERVICE_ROLE' \
  "$APP_DIR/src" \
  "node_modules,.git" \
  "CRITICAL" || true

# Supabase service key pattern (eyJ... long base64)
check_pattern \
  "Hardcoded JWT tokens (potential service keys)" \
  'eyJ[A-Za-z0-9_-]{100,}' \
  "$APP_DIR/src" \
  "node_modules,.git" \
  "CRITICAL" || true

echo ""
echo "--- Sensitive Data in Logs ---"
echo ""

# Card numbers in log statements
check_pattern \
  "Card data in logging statements" \
  'console\.(log|warn|error|debug).*card.?(number|num|no)|console\.(log|warn|error|debug).*\b\d{16}\b' \
  "$APP_DIR/src" \
  "node_modules,.git" \
  "HIGH" || true

# Sensitive fields logged
check_pattern \
  "Sensitive fields in logging (password, secret, token)" \
  'console\.(log|warn|error|debug).*(password|secret|private.?key|api.?key)' \
  "$APP_DIR/src" \
  "node_modules,.git" \
  "HIGH" || true

echo ""
echo "--- Insecure Storage ---"
echo ""

# AsyncStorage with card data
check_pattern \
  "Card data in AsyncStorage" \
  'AsyncStorage.*(card|cvv|pan|credit|debit)' \
  "$APP_DIR/src" \
  "node_modules,.git" \
  "CRITICAL" || true

# SecureStore misuse check (card data should use SecureStore, not AsyncStorage)
check_pattern \
  "Card data not using SecureStore" \
  'setItem.*(card_number|cardNumber|card_no|fullCardNumber)' \
  "$APP_DIR/src" \
  "node_modules,.git" \
  "HIGH" || true

echo ""
echo "--- Environment File Check ---"
echo ""

# Check for .env files committed
if [ -f "$APP_DIR/.env" ]; then
  ISSUES=$((ISSUES + 1))
  echo "[HIGH] .env file exists in app directory (should be gitignored)"
else
  echo "[PASS] No .env file in app root"
fi

if [ -f "$APP_DIR/.env.local" ]; then
  ISSUES=$((ISSUES + 1))
  echo "[HIGH] .env.local file exists in app directory"
else
  echo "[PASS] No .env.local file in app root"
fi

# Check gitignore includes env files
if [ -f "$APP_DIR/.gitignore" ]; then
  if grep -q '\.env' "$APP_DIR/.gitignore" 2>/dev/null; then
    echo "[PASS] .gitignore includes .env patterns"
  else
    ISSUES=$((ISSUES + 1))
    echo "[HIGH] .gitignore does NOT include .env patterns"
  fi
fi

echo ""
echo "=== PCI Compliance Check Complete ==="
echo ""
if [ "$ISSUES" -gt 0 ]; then
  echo "Issues found: $ISSUES"
  echo "Review and remediate before submission."
  exit 1
else
  echo "All checks passed. No PCI compliance issues detected."
fi
