#!/bin/bash
# AutoBot Session Recovery — Read state and show what's next

AUTOBOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RN_APP_DIR="$(cd "$AUTOBOT_DIR/../rn-app" && pwd)"

echo "=== AutoBot Session Resume ==="
echo ""

# 1. Current progress
echo "--- Compound Metrics ---"
if [ -f "$AUTOBOT_DIR/state/progress.json" ]; then
  python3 -c "
import json, sys
with open('$AUTOBOT_DIR/state/progress.json') as f:
    data = json.load(f)
screens = data.get('screens', {})
certified = sum(1 for s in screens.values() if s.get('status') == 'CERTIFIED')
verified = sum(1 for s in screens.values() if s.get('status') == 'VERIFIED')
coverage_pass = sum(1 for s in screens.values() if s.get('status') == 'COVERAGE_PASS')
extracted = sum(1 for s in screens.values() if s.get('status') == 'EXTRACTED')
blocked = sum(1 for s in screens.values() if s.get('status') == 'BLOCKED')
total = data.get('compound_metrics', {}).get('total_screens', len(screens))
print(f'Screens: {certified} certified, {verified} verified, {coverage_pass} coverage pass, {extracted} extracted, {blocked} blocked / {total} total')
metrics = data.get('compound_metrics', {})
print(f'Velocity trend: {metrics.get(\"velocity_trend\", \"baseline\")}')
" 2>/dev/null
else
  echo "No progress data yet"
fi

# 2. Execution order
echo ""
echo "--- Flow Execution Order ---"
if [ -f "$AUTOBOT_DIR/config/execution-order.json" ]; then
  python3 -c "
import json
with open('$AUTOBOT_DIR/config/execution-order.json') as f:
    data = json.load(f)
current = data.get('currentFlow', 0)
for flow in data.get('flows', []):
    status = flow.get('status', 'pending')
    marker = 'DONE' if status in ('complete', 'verified') else 'CURR' if flow['order'] == current else '    '
    print(f'  [{marker}] {flow[\"order\"]}. {flow[\"name\"]} ({flow[\"screenStates\"]} states) — {status}')
" 2>/dev/null
fi

# 3. Recent session log entries
echo ""
echo "--- Latest Session Log ---"
if [ -f "$AUTOBOT_DIR/state/session-log.md" ]; then
  tail -20 "$AUTOBOT_DIR/state/session-log.md"
fi

# 4. Recent commits
echo ""
echo "--- Recent Commits ---"
cd "$RN_APP_DIR" && git log --oneline -5 2>/dev/null

echo ""
echo "=== To resume ==="
echo "  1. Read autobot/state/session-log.md"
echo "  2. Read autobot/state/progress.json"
echo "  3. Read autobot/AGENTS.md (workflow + phase checklist)"
echo "  4. Execute next phase from the checklist"
