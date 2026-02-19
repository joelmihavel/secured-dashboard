#!/bin/bash
# fix-ios-spaces.sh
# Fixes iOS build failures caused by spaces in the project directory path.
#
# The React Native build pipeline (script_phases.rb) generates shell script
# phases in the Pods Xcode project that use /bin/sh -c with unquoted paths.
# When the project path contains spaces (e.g., "Secured v2-react-native project"),
# /bin/sh word-splits the path and fails with:
#   /bin/sh: /Users/.../Secured: No such file or directory
#
# This script patches:
# 1. Pods.xcodeproj/project.pbxproj - Fix the [CP-User] Generate Specs script phase
# 2. node_modules/react-native/scripts/xcode/with-environment.sh - Quote $1 execution
# 3. node_modules/react-native/scripts/react_native_pods_utils/script_phases.rb - Fix template
# 4. node_modules/react-native/sdks/hermes-engine/utils/replace_hermes_version.js - Quote tar paths
#
# Usage:
#   Run after `npx expo prebuild --clean --platform ios` and `pod install`:
#     bash scripts/fix-ios-spaces.sh
#
# For a permanent fix, consider using patch-package:
#   npx patch-package react-native

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$PROJECT_ROOT/ios"
PODS_PBXPROJ="$IOS_DIR/Pods/Pods.xcodeproj/project.pbxproj"

echo "=== Fixing iOS build for paths with spaces ==="
echo "Project root: $PROJECT_ROOT"

# --- Fix 1: Pods.xcodeproj/project.pbxproj ---
if [ -f "$PODS_PBXPROJ" ]; then
    echo ""
    echo "[1/4] Patching Pods.xcodeproj/project.pbxproj..."

    # Fix the [CP-User] Generate Specs script phase:
    # - Quote export assignments so paths with spaces don't break
    # - Replace /bin/sh -c "$WITH_ENVIRONMENT $SCRIPT_PHASES_SCRIPT" with
    #   source "$WITH_ENVIRONMENT" followed by "$SCRIPT_PHASES_SCRIPT"
    #
    # The original /bin/sh -c passes a single string to a new shell which
    # word-splits on spaces. By sourcing the env file and calling the script
    # directly (both quoted), we avoid word splitting.

    if grep -q '/bin/sh -c \\"\\$WITH_ENVIRONMENT \\$SCRIPT_PHASES_SCRIPT\\"' "$PODS_PBXPROJ" 2>/dev/null; then
        sed -i '' \
            's|/bin/sh -c \\"\\$WITH_ENVIRONMENT \\$SCRIPT_PHASES_SCRIPT\\"|source \\"\\$WITH_ENVIRONMENT\\"\\n\\"\\$SCRIPT_PHASES_SCRIPT\\"|g' \
            "$PODS_PBXPROJ"
        echo "  -> Fixed /bin/sh -c invocation in Generate Specs phase"
    elif grep -q 'bin/sh -c' "$PODS_PBXPROJ" 2>/dev/null; then
        echo "  -> WARNING: Found bin/sh -c but pattern didn't match. Manual check needed."
    else
        echo "  -> Already patched or pattern not found (OK after re-run)"
    fi

    # Fix unquoted export assignments for RCT_SCRIPT_* variables
    # Pattern: export RCT_SCRIPT_RN_DIR=$RCT_SCRIPT_POD_INSTALLATION_ROOT/...
    # Should be: export RCT_SCRIPT_RN_DIR="$RCT_SCRIPT_POD_INSTALLATION_ROOT/..."
    sed -i '' \
        's|export RCT_SCRIPT_RN_DIR=\\$RCT_SCRIPT_POD_INSTALLATION_ROOT|export RCT_SCRIPT_RN_DIR=\\"\\$RCT_SCRIPT_POD_INSTALLATION_ROOT|g;
         s|export RCT_SCRIPT_APP_PATH=\\$RCT_SCRIPT_POD_INSTALLATION_ROOT|export RCT_SCRIPT_APP_PATH=\\"\\$RCT_SCRIPT_POD_INSTALLATION_ROOT|g;
         s|export RCT_SCRIPT_OUTPUT_DIR=\\$RCT_SCRIPT_POD_INSTALLATION_ROOT|export RCT_SCRIPT_OUTPUT_DIR=\\"\\$RCT_SCRIPT_POD_INSTALLATION_ROOT|g' \
        "$PODS_PBXPROJ" 2>/dev/null || true

    echo "  -> Done"
else
    echo "[1/4] SKIP: $PODS_PBXPROJ not found (run expo prebuild first)"
fi

# --- Fix 2: with-environment.sh ---
WITH_ENV="$PROJECT_ROOT/node_modules/react-native/scripts/xcode/with-environment.sh"
if [ -f "$WITH_ENV" ]; then
    echo ""
    echo "[2/4] Patching with-environment.sh..."
    if grep -q '  \$1$' "$WITH_ENV"; then
        sed -i '' 's|  \$1$|  "\$@"|' "$WITH_ENV"
        echo '  -> Fixed unquoted $1 -> "$@"'
    else
        echo "  -> Already patched"
    fi
else
    echo "[2/4] SKIP: with-environment.sh not found"
fi

# --- Fix 3: script_phases.rb template ---
SCRIPT_PHASES_RB="$PROJECT_ROOT/node_modules/react-native/scripts/react_native_pods_utils/script_phases.rb"
if [ -f "$SCRIPT_PHASES_RB" ]; then
    echo ""
    echo "[3/4] Patching script_phases.rb..."
    if grep -q '/bin/sh -c "\$WITH_ENVIRONMENT \$SCRIPT_PHASES_SCRIPT"' "$SCRIPT_PHASES_RB"; then
        sed -i '' 's|/bin/sh -c "\$WITH_ENVIRONMENT \$SCRIPT_PHASES_SCRIPT"|source "\$WITH_ENVIRONMENT"\n        "\$SCRIPT_PHASES_SCRIPT"|' "$SCRIPT_PHASES_RB"
        echo "  -> Fixed /bin/sh -c in template"
    else
        echo "  -> Already patched or pattern not found"
    fi

    # Also fix unquoted export assignments in the ERB template
    if grep -q 'export <%= varname -%>=<%= value -%>$' "$SCRIPT_PHASES_RB"; then
        sed -i '' 's|export <%= varname -%>=<%= value -%>|export <%= varname -%>="<%= value -%>"|' "$SCRIPT_PHASES_RB"
        echo '  -> Fixed unquoted export template'
    else
        echo "  -> Export template already patched"
    fi
else
    echo "[3/4] SKIP: script_phases.rb not found"
fi

# --- Fix 4: replace_hermes_version.js ---
HERMES_REPLACE="$PROJECT_ROOT/node_modules/react-native/sdks/hermes-engine/utils/replace_hermes_version.js"
if [ -f "$HERMES_REPLACE" ]; then
    echo ""
    echo "[4/4] Patching replace_hermes_version.js..."
    if grep -q 'tar -xf \${tarballURLPath} -C \${finalLocation}' "$HERMES_REPLACE"; then
        sed -i '' 's|tar -xf \${tarballURLPath} -C \${finalLocation}|tar -xf "\${tarballURLPath}" -C "\${finalLocation}"|' "$HERMES_REPLACE"
        echo "  -> Fixed unquoted tar command paths"
    else
        echo "  -> Already patched"
    fi
else
    echo "[4/4] SKIP: replace_hermes_version.js not found"
fi

echo ""
echo "=== Patching complete ==="
echo ""
echo "Next steps:"
echo "  1. Build with: cd ios && xcodebuild -workspace FlentSecured.xcworkspace -scheme FlentSecured -configuration Debug -sdk iphonesimulator"
echo "  2. Or use Expo: npx expo run:ios"
echo ""
echo "To make patches permanent across npm install, use patch-package:"
echo "  npm install --save-dev patch-package"
echo "  npx patch-package react-native"
echo '  Add "postinstall": "patch-package" to package.json scripts'
