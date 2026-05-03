#!/usr/bin/env bash
#
# May ₹1000-cashback broadcast helper.
# One-off script — delete after May 5 2026.
#
# Reads the cohort assignment from private.may1k_cashback_cohort (a view I
# created on prod that maps user_status to the right approved Twilio
# Content SID and excludes anyone who already has a successful payment in
# the current calendar month).
#
# Sends each row through the prod `send-whatsapp` edge function — which
# enforces the master `whatsapp_send` kill-switch but bypasses the per-
# notification-type policy (these templates aren't tied to a
# notification_policy row, so reserveWhatsAppSlot doesn't apply).
#
# USAGE
#   # 1) Test render: send 1 message of a cohort template to your phone
#   ./broadcast-may1k-cashback.sh test +91XXXXXXXXXX approved
#
#   # 2) Dry-run: print what would be sent per cohort, no Twilio calls
#   ./broadcast-may1k-cashback.sh dry-run
#   ./broadcast-may1k-cashback.sh dry-run signed_up
#
#   # 3) Live broadcast: dispatch the whole cohort
#   ./broadcast-may1k-cashback.sh send signed_up
#   ./broadcast-may1k-cashback.sh send all
#
# REQUIRED ENV
#   PROD_SERVICE_ROLE_KEY  — service_role JWT for prod (uowjtrzmszuaiokqxgir)
#   PROD_DB_URL            — postgres://... connection string for prod
#                            (only needed for `send` and `dry-run`; `test`
#                            doesn't query the DB)
#
# Pacing: 200ms between sends. ~3 minutes for 520 recipients.

set -euo pipefail

PROJECT_REF="uowjtrzmszuaiokqxgir"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
SEND_URL="${SUPABASE_URL}/functions/v1/send-whatsapp"

declare -A SID
SID[signed_up]="HX9204abc2b538924b8091dba04dfc3a00"  # whatsapp/card, CTA: Upload Your Agreement, paragraph-spaced body
SID[uploaded]="HX4d93b86ac11c68f809a798a66ad022e3"   # whatsapp/card, CTA: Complete Setup, paragraph-spaced
SID[approved]="HXaf573bf51b1eb0f1c394781e48a45242"   # whatsapp/card, CTA: Pay Now, paragraph-spaced
SID[paid]="HXe984848cd496f0ac4c8353d5532bf1e6"       # whatsapp/card, CTA: Pay Now, paragraph-spaced

cmd="${1:-help}"

require_service_key() {
  if [[ -z "${PROD_SERVICE_ROLE_KEY:-}" ]]; then
    echo "ERROR: set PROD_SERVICE_ROLE_KEY env var (service_role JWT for prod)" >&2
    exit 1
  fi
}

require_db_url() {
  if [[ -z "${PROD_DB_URL:-}" ]]; then
    echo "ERROR: set PROD_DB_URL env var (postgres://... for prod)" >&2
    exit 1
  fi
}

send_one() {
  # $1 = E.164 phone, $2 = HX template SID
  local phone="$1" sid="$2"
  curl -sS -X POST "$SEND_URL" \
    -H "Authorization: Bearer $PROD_SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"to\":\"${phone}\",\"template\":\"${sid}\"}" \
    -w "\nHTTP %{http_code}\n"
}

case "$cmd" in
  test)
    require_service_key
    phone="${2:-}"; cohort="${3:-}"
    if [[ -z "$phone" || -z "$cohort" || -z "${SID[$cohort]:-}" ]]; then
      echo "Usage: $0 test +91XXXXXXXXXX [signed_up|uploaded|approved|paid]" >&2
      exit 1
    fi
    echo "Sending $cohort template (${SID[$cohort]}) to $phone"
    send_one "$phone" "${SID[$cohort]}"
    ;;

  dry-run)
    require_db_url
    cohort="${2:-all}"
    if [[ "$cohort" == "all" ]]; then
      echo "=== Cohort counts (would-be sends) ==="
      psql -At "$PROD_DB_URL" -c \
        "SELECT cohort, count(*) FROM private.may1k_cashback_cohort GROUP BY cohort ORDER BY 1;"
    else
      psql -At "$PROD_DB_URL" -c \
        "SELECT count(*) FROM private.may1k_cashback_cohort WHERE cohort='${cohort}';"
      echo "Sample (first 5):"
      psql -At "$PROD_DB_URL" -c \
        "SELECT phone_number, full_name FROM private.may1k_cashback_cohort WHERE cohort='${cohort}' LIMIT 5;"
    fi
    ;;

  send)
    require_service_key
    require_db_url
    cohort="${2:-}"
    if [[ -z "$cohort" ]]; then
      echo "Usage: $0 send [signed_up|uploaded|approved|paid|all]" >&2
      exit 1
    fi

    where=""
    if [[ "$cohort" != "all" ]]; then
      [[ -z "${SID[$cohort]:-}" ]] && { echo "Unknown cohort: $cohort" >&2; exit 1; }
      where="WHERE cohort='${cohort}'"
    fi

    total=$(psql -At "$PROD_DB_URL" -c "SELECT count(*) FROM private.may1k_cashback_cohort ${where};")
    echo "About to dispatch to $total users. Continue? (yes/N)"
    read -r confirm
    [[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 0; }

    sent=0; failed=0
    psql -At -F'|' "$PROD_DB_URL" -c \
      "SELECT phone_number, template_sid, cohort FROM private.may1k_cashback_cohort ${where};" \
      | while IFS='|' read -r phone sid coh; do
          [[ -z "$phone" || -z "$sid" ]] && continue
          # Phone in users table is plain digits like '6362877970' or '916362877970'
          # send-whatsapp's sanitizePhone + isValidIndianPhone normalize, but
          # safest to prepend + if missing.
          if [[ "$phone" != +* ]]; then
            if [[ ${#phone} -eq 10 ]]; then phone="+91${phone}"; else phone="+${phone}"; fi
          fi
          resp=$(curl -sS -X POST "$SEND_URL" \
            -H "Authorization: Bearer $PROD_SERVICE_ROLE_KEY" \
            -H 'Content-Type: application/json' \
            -d "{\"to\":\"${phone}\",\"template\":\"${sid}\"}" \
            -w '\n%{http_code}')
          http_code=$(echo "$resp" | tail -1)
          if [[ "$http_code" == "200" ]]; then
            sent=$((sent+1))
            printf "  [%4d/%s]  ✓  %s  %s\n" "$sent" "$total" "$coh" "$phone"
          else
            failed=$((failed+1))
            printf "  [%4d/%s]  ✗  %s  %s  (HTTP %s)  %s\n" "$sent" "$total" "$coh" "$phone" "$http_code" "$(echo "$resp" | head -1)"
          fi
          sleep 0.2
        done

    echo
    echo "Done. sent=$sent failed=$failed"
    ;;

  *)
    cat <<EOF
May ₹1000-cashback broadcast helper.

Usage:
  $0 test +91XXXXXXXXXX [signed_up|uploaded|approved|paid]
  $0 dry-run [signed_up|uploaded|approved|paid|all]
  $0 send    [signed_up|uploaded|approved|paid|all]

Env required:
  PROD_SERVICE_ROLE_KEY   service_role JWT for prod
  PROD_DB_URL             postgres://... for prod (skip for 'test' command)

Templates (must be Meta-approved before sending):
  signed_up  HX9204abc2b538924b8091dba04dfc3a00  (whatsapp/card, CTA: Upload Your Agreement)
  uploaded   HX4d93b86ac11c68f809a798a66ad022e3  (whatsapp/card, CTA: Complete Setup)
  approved   HXaf573bf51b1eb0f1c394781e48a45242  (whatsapp/card, CTA: Pay Now)
  paid       HXe984848cd496f0ac4c8353d5532bf1e6  (whatsapp/card, CTA: Pay Now)
EOF
    exit 1
    ;;
esac
