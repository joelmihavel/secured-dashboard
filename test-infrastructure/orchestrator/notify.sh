#!/usr/bin/env bash
# =============================================================================
# Test Result Notification Helper
# =============================================================================
# Sends formatted test results to Slack, webhook, email, or stdout.
# Used by the orchestrator and Maestro Cloud runner to notify teams
# of test outcomes.
#
# Usage:
#   ./notify.sh --target slack --results /path/to/summary.json
#   ./notify.sh --target slack --results /path/to/summary.json --channel "#e2e-tests"
#   ./notify.sh --target webhook --results /path/to/summary.json --url https://hooks.example.com/abc
#   ./notify.sh --target email --results /path/to/summary.json --to team@flent.app
#   ./notify.sh --target stdout --results /path/to/summary.json
#
# Environment variables:
#   SLACK_WEBHOOK_URL   - Slack incoming webhook URL (for --target slack)
#   WEBHOOK_NOTIFY_URL  - Generic webhook URL (for --target webhook)
#   NOTIFY_EMAIL        - Email recipient (for --target email)
#
# Exit codes:
#   0 - Notification sent successfully
#   1 - Notification delivery failed
#   2 - Usage error
# =============================================================================

set -euo pipefail

# -- Color output helpers --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[NOTIFY]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[NOTIFY]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[NOTIFY]${NC} $*"; }
log_error() { echo -e "${RED}[NOTIFY]${NC} $*"; }

# -- Parse arguments --
TARGET=""
RESULTS_FILE=""
SLACK_CHANNEL="${SLACK_CHANNEL:-#testing}"
WEBHOOK_URL="${WEBHOOK_NOTIFY_URL:-}"
EMAIL_TO="${NOTIFY_EMAIL:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --results)
      RESULTS_FILE="$2"
      shift 2
      ;;
    --channel)
      SLACK_CHANNEL="$2"
      shift 2
      ;;
    --url)
      WEBHOOK_URL="$2"
      shift 2
      ;;
    --to)
      EMAIL_TO="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 --target TARGET --results /path/to/results.json [OPTIONS]"
      echo ""
      echo "Targets:"
      echo "  slack      Send to Slack via incoming webhook"
      echo "  webhook    Send to generic webhook URL"
      echo "  email      Send via mail command"
      echo "  stdout     Print formatted summary to stdout"
      echo ""
      echo "Options:"
      echo "  --channel CHANNEL  Slack channel (default: #testing)"
      echo "  --url URL          Webhook URL override"
      echo "  --to EMAIL         Email recipient override"
      exit 0
      ;;
    *)
      log_warn "Unknown argument: $1"
      shift
      ;;
  esac
done

# -- Validate inputs --
if [[ -z "$TARGET" ]]; then
  log_error "Missing required --target argument"
  exit 2
fi

if [[ -z "$RESULTS_FILE" || ! -f "$RESULTS_FILE" ]]; then
  log_error "Results file not found: ${RESULTS_FILE:-<not specified>}"
  exit 2
fi

# -- Parse results JSON --
parse_field() {
  local field="$1"
  local default="${2:-}"
  python3 -c "
import json, sys
with open('$RESULTS_FILE') as f:
    data = json.load(f)
keys = '$field'.split('.')
val = data
for k in keys:
    if isinstance(val, dict):
        val = val.get(k, {})
    else:
        val = {}
        break
print(val if val != {} else '$default')
" 2>/dev/null || echo "$default"
}

STATUS=$(parse_field "status" "unknown")
STATUS_UPPER=$(echo "$STATUS" | tr '[:lower:]' '[:upper:]')
PROFILE=$(parse_field "profile" "default")
MODE=$(parse_field "mode" "unknown")
DURATION=$(parse_field "duration_seconds" "0")
TOTAL_TESTS=$(parse_field "total_flows" "$(parse_field "summary.total_tests" "0")")
PASSED=$(parse_field "passed" "$(parse_field "summary.total_passed" "0")")
FAILED=$(parse_field "failed" "$(parse_field "summary.total_failed" "0")")
PASS_RATE=$(parse_field "pass_rate" "$(parse_field "summary.pass_rate" "0")")
SESSION_ID=$(parse_field "session_id" "unknown")
CLOUD_URL=$(parse_field "cloud_run_url" "")
TIMESTAMP=$(parse_field "timestamp" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")")

# Format duration
DURATION_MIN=$((DURATION / 60))
DURATION_SEC=$((DURATION % 60))
DURATION_FMT="${DURATION_MIN}m ${DURATION_SEC}s"

# Get failed test names if available
FAILED_NAMES=$(python3 -c "
import json
with open('$RESULTS_FILE') as f:
    data = json.load(f)
# Try flows array (Maestro results format)
flows = data.get('flows', [])
failed = [f.get('flow', 'unknown') for f in flows if f.get('status') == 'fail']
if not failed:
    # Try layer_results format (orchestrator summary)
    for layer, info in data.get('layer_results', {}).items():
        if info.get('status') not in ('pass', 'skipped') and info.get('ran'):
            failed.append(f'{layer} layer')
for name in failed[:10]:
    print(name)
" 2>/dev/null || echo "")

# -- Send notification by target --

send_slack() {
  local webhook_url="${SLACK_WEBHOOK_URL:-}"
  if [[ -z "$webhook_url" ]]; then
    log_error "SLACK_WEBHOOK_URL not set. Cannot send Slack notification."
    return 1
  fi

  # Determine status emoji and color
  local color="#22c55e"
  local status_emoji="white_check_mark"
  if [[ "$STATUS" != "pass" ]]; then
    color="#ef4444"
    status_emoji="x"
  fi

  # Build Slack Block Kit payload (with failed test details and cloud URL)
  local payload
  payload=$(python3 -c "
import json, os

blocks = [
    {
        'type': 'header',
        'text': {
            'type': 'plain_text',
            'text': 'Flent Secured E2E: $STATUS_UPPER'
        }
    },
    {
        'type': 'section',
        'fields': [
            {'type': 'mrkdwn', 'text': '*Profile:* $PROFILE'},
            {'type': 'mrkdwn', 'text': '*Mode:* $MODE'},
            {'type': 'mrkdwn', 'text': '*Duration:* $DURATION_FMT'},
            {'type': 'mrkdwn', 'text': '*Pass Rate:* ${PASS_RATE}%'},
            {'type': 'mrkdwn', 'text': '*Passed:* $PASSED / $TOTAL_TESTS'},
            {'type': 'mrkdwn', 'text': '*Failed:* $FAILED'},
        ]
    },
]

# Add failed test details if any (limit to first 10)
failed_names = '''$FAILED_NAMES'''.strip()
if failed_names:
    failed_list = failed_names.split('\n')[:10]
    failed_text = '\n'.join(f'  - {name}' for name in failed_list if name.strip())
    truncation_note = ''
    all_failed = failed_names.split('\n')
    if len(all_failed) > 10:
        truncation_note = f'\n  ... and {len(all_failed) - 10} more'
    blocks.append({
        'type': 'section',
        'text': {
            'type': 'mrkdwn',
            'text': '*Failed Tests:*\n\`\`\`\n' + failed_text + truncation_note + '\n\`\`\`'
        }
    })

# Add cloud URL if available
cloud_url = '$CLOUD_URL'
if cloud_url:
    blocks.append({
        'type': 'section',
        'text': {
            'type': 'mrkdwn',
            'text': '<' + cloud_url + '|View Full Report on Maestro Cloud>'
        }
    })

blocks.append({
    'type': 'context',
    'elements': [
        {'type': 'mrkdwn', 'text': 'Session: \`$SESSION_ID\` | $TIMESTAMP'}
    ]
})

payload = {
    'channel': '$SLACK_CHANNEL',
    'username': 'Flent Test Bot',
    'icon_emoji': ':$status_emoji:',
    'blocks': blocks
}

print(json.dumps(payload))
" 2>/dev/null)

  if [[ -z "$payload" ]]; then
    log_error "Failed to build Slack payload"
    return 1
  fi

  # Send to Slack
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$webhook_url")

  if [[ "$http_code" == "200" ]]; then
    log_ok "Slack notification sent to $SLACK_CHANNEL"
    return 0
  else
    log_error "Slack webhook returned HTTP $http_code"
    return 1
  fi
}

send_webhook() {
  local url="${WEBHOOK_URL:-}"
  if [[ -z "$url" ]]; then
    log_error "No webhook URL provided (--url or WEBHOOK_NOTIFY_URL)"
    return 1
  fi

  # Send the raw results JSON to the webhook
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d @"$RESULTS_FILE" \
    "$url")

  if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
    log_ok "Webhook notification sent (HTTP $http_code)"
    return 0
  else
    log_error "Webhook returned HTTP $http_code"
    return 1
  fi
}

send_email() {
  local to="${EMAIL_TO:-}"
  if [[ -z "$to" ]]; then
    log_error "No email recipient provided (--to or NOTIFY_EMAIL)"
    return 1
  fi

  if ! command -v mail &> /dev/null; then
    log_error "'mail' command not found. Install mailutils or use a different target."
    return 1
  fi

  local subject="[Flent E2E] $STATUS_UPPER - $PROFILE ($PASSED/$TOTAL_TESTS passed)"

  local body="Flent Secured E2E Test Results
================================

Status:    $STATUS_UPPER
Profile:   $PROFILE
Mode:      $MODE
Duration:  $DURATION_FMT

Results:   $PASSED passed, $FAILED failed out of $TOTAL_TESTS
Pass Rate: ${PASS_RATE}%

Session:   $SESSION_ID
Timestamp: $TIMESTAMP"

  if [[ -n "$CLOUD_URL" ]]; then
    body="$body

Cloud Report: $CLOUD_URL"
  fi

  if [[ -n "$FAILED_NAMES" ]]; then
    body="$body

Failed Tests:
$FAILED_NAMES"
  fi

  echo "$body" | mail -s "$subject" "$to"
  local exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    log_ok "Email notification sent to $to"
    return 0
  else
    log_error "Failed to send email (exit code: $exit_code)"
    return 1
  fi
}

send_stdout() {
  echo ""
  echo "================================================================"
  echo "  FLENT SECURED - TEST RESULTS NOTIFICATION"
  echo "================================================================"
  echo ""
  echo "  Status:     $STATUS_UPPER"
  echo "  Profile:    $PROFILE"
  echo "  Mode:       $MODE"
  echo "  Duration:   $DURATION_FMT"
  echo ""
  echo "  Total:      $TOTAL_TESTS"
  echo "  Passed:     $PASSED"
  echo "  Failed:     $FAILED"
  echo "  Pass Rate:  ${PASS_RATE}%"
  echo ""
  echo "  Session:    $SESSION_ID"
  echo "  Timestamp:  $TIMESTAMP"

  if [[ -n "$CLOUD_URL" ]]; then
    echo "  Cloud URL:  $CLOUD_URL"
  fi

  if [[ -n "$FAILED_NAMES" ]]; then
    echo ""
    echo "  Failed Tests:"
    while IFS= read -r name; do
      echo "    - $name"
    done <<< "$FAILED_NAMES"
  fi

  echo ""
  echo "================================================================"
  echo ""
  return 0
}

# -- Dispatch to target --
case "$TARGET" in
  slack)
    send_slack
    ;;
  webhook)
    send_webhook
    ;;
  email)
    send_email
    ;;
  stdout)
    send_stdout
    ;;
  *)
    log_error "Unknown notification target: $TARGET"
    log_info "Available targets: slack, webhook, email, stdout"
    exit 2
    ;;
esac
