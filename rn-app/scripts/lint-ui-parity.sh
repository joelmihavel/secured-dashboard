#!/bin/bash
# UI Parity Lint Script
# Detects common patterns that break Figma parity.
# Run: bash scripts/lint-ui-parity.sh
#
# Exit code 0 = clean, 1 = violations found

set -euo pipefail

SCREEN_DIR="app"
VIOLATIONS=0

echo "=== UI Parity Lint ==="
echo ""

# Rule 1: No raw TextInput from react-native in screen files
# (Only shared TextInput from @/src/components should be used)
echo "Rule 1: No raw RNTextInput in screen files..."
RAW_INPUTS=$(grep -rn "TextInput as RNTextInput" "$SCREEN_DIR" \
  --include="*.tsx" \
  | grep -v "sign-up.tsx" \
  | grep -v "type.*TextInput" \
  | grep -v "__tests__" \
  || true)

if [ -n "$RAW_INPUTS" ]; then
  echo "  FAIL: Raw RNTextInput found — use shared <TextInput> from @/src/components"
  echo "$RAW_INPUTS" | sed 's/^/    /'
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "  PASS"
fi

# Rule 2: No fontWeight style prop in screen files
# (fontFamily already encodes weight — PlusJakartaSans-Medium = 500)
echo "Rule 2: No fontWeight in screen StyleSheet..."
FONT_WEIGHT=$(grep -rn "fontWeight:" "$SCREEN_DIR" \
  --include="*.tsx" \
  | grep -v "__tests__" \
  | grep -v "//.*fontWeight" \
  | grep -v "FIGMA\.\|typography\.\|as const" \
  || true)

if [ -n "$FONT_WEIGHT" ]; then
  echo "  WARN: fontWeight found in screen styles — use fontFamily mapping instead"
  echo "$FONT_WEIGHT" | head -10 | sed 's/^/    /'
  COUNT=$(echo "$FONT_WEIGHT" | wc -l | xargs)
  echo "    ... ($COUNT total)"
else
  echo "  PASS"
fi

# Rule 3: Screens should import from @/src/components, not build inline inputs
echo "Rule 3: Screens import shared components..."
MISSING_IMPORT=$(grep -rLn "from '@/src/components" "$SCREEN_DIR" \
  --include="*.tsx" \
  | grep -v "_layout" \
  | grep -v "__tests__" \
  | grep -v "screen-picker" \
  || true)

if [ -n "$MISSING_IMPORT" ]; then
  echo "  WARN: These screen files don't import shared components:"
  echo "$MISSING_IMPORT" | sed 's/^/    /'
else
  echo "  PASS"
fi

# Rule 4: No hardcoded hex colors in StyleSheet.create
echo "Rule 4: Hardcoded hex colors in StyleSheet..."
HEX_COLORS=$(grep -rn "color: '#[0-9A-Fa-f]\{6\}'" "$SCREEN_DIR" \
  --include="*.tsx" \
  | grep -v "__tests__" \
  | grep -v "FIGMA_COLORS\.\|FIGMA\.colors\.\|EDIT_COLORS\.\|colors\." \
  || true)

if [ -n "$HEX_COLORS" ]; then
  COUNT=$(echo "$HEX_COLORS" | wc -l | xargs)
  echo "  WARN: $COUNT hardcoded hex colors found — migrate to theme tokens"
  echo "$HEX_COLORS" | head -5 | sed 's/^/    /'
  [ "$COUNT" -gt 5 ] && echo "    ... ($COUNT total)"
else
  echo "  PASS"
fi

echo ""
echo "=== Summary: $VIOLATIONS blocking violations ==="
exit $VIOLATIONS
