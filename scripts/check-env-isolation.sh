#!/usr/bin/env bash
# scripts/check-env-isolation.sh
#
# CI lint that enforces "every env var read must go through the central
# config module per subproject." Phase 3 of the cleanup plan.
#
# Allowed central modules:
#   - rn-app/src/config/env.ts
#   - admin-app/src/lib/env.ts
#   - cloud-run/extraction-service/src/config.ts
#
# Anything else that reads process.env.* in the source trees fails the check.
#
# Usage:
#   bash scripts/check-env-isolation.sh
#
# Exit codes:
#   0  — clean
#   1  — at least one violation found
#
# Wired into CI as the `lint:env` job. Run locally via `npm run lint:env`.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Central modules that ARE allowed to read process.env directly.
# Add new ones here as new subprojects come online.
ALLOWED='rn-app/src/config/env\.ts$|admin-app/src/lib/env\.ts$|cloud-run/extraction-service/src/config\.ts$'

# Where to look. Skips test files, build outputs, node_modules, scripts/legacy/.
SEARCH_DIRS='rn-app/src rn-app/app admin-app/src admin-app/app cloud-run'

# File extensions to scan
EXTS='ts tsx js jsx mjs cjs'

declare -a VIOLATIONS=()

for dir in $SEARCH_DIRS; do
  [ -d "$dir" ] || continue
  for ext in $EXTS; do
    while IFS= read -r match; do
      file="${match%%:*}"
      # Skip allowed central modules
      if printf '%s' "$file" | grep -qE "$ALLOWED"; then
        continue
      fi
      # Skip type definition files (declarations)
      case "$file" in *.d.ts) continue ;; esac
      # Skip node_modules + dist (defensive — find -prune below should already exclude)
      case "$file" in
        */node_modules/*|*/dist/*|*/.next/*|*/build/*) continue ;;
      esac
      VIOLATIONS+=("$match")
    done < <(grep -rIn --include="*.${ext}" \
              --exclude-dir=node_modules \
              --exclude-dir=dist \
              --exclude-dir=.next \
              --exclude-dir=build \
              "process\.env\." "$dir" 2>/dev/null || true)
  done
done

if [ ${#VIOLATIONS[@]} -eq 0 ]; then
  echo "✓ env isolation: zero process.env reads outside central modules"
  exit 0
fi

echo "✗ env isolation FAILED — process.env reads found outside central modules:"
echo ""
for v in "${VIOLATIONS[@]}"; do
  echo "  $v"
done
echo ""
echo "Fix: import from the central env module for the subproject:"
echo "  rn-app/src/config/env.ts            (rn-app)"
echo "  admin-app/src/lib/env.ts            (admin-app)"
echo "  cloud-run/extraction-service/src/config.ts  (extraction-service)"
echo ""
echo "Then use \`env.foo\` / \`config.foo\` instead of \`process.env.FOO\`."
exit 1
