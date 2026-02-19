#!/bin/bash
# AutoBot Quick Status

AUTOBOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== AutoBot Status ==="
python3 -c "
import json
with open('$AUTOBOT_DIR/state/progress.json') as f:
    data = json.load(f)
m = data.get('compound_metrics', {})
print(f'Total screens: {m.get(\"total_screens\", 0)}')
print(f'Certified: {m.get(\"certified\", 0)}')
print(f'Extracted: {m.get(\"extracted\", 0)}')
print(f'In fix loop: {m.get(\"in_fix_loop\", 0)}')
print(f'Pending: {m.get(\"pending\", 0)}')
print(f'AGENTS.md entries: {m.get(\"agents_md_entries\", 0)}')
print(f'Velocity: {m.get(\"velocity_trend\", \"baseline\")}')
" 2>/dev/null || echo "No data"
