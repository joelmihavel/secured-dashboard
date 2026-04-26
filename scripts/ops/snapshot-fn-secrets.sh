#!/usr/bin/env bash
# Phase 0.6a — per-function secrets snapshot.
#
# Writes only secret NAMES (no values) to /tmp/prod-fn-secrets.txt and
# /tmp/dev-fn-secrets.txt. Without this snapshot, restoring an archived
# function via `git checkout <tag> -- supabase/functions/<name> &&
# supabase functions deploy <name>` would 500 on every call because
# secrets aren't in git.
#
# Run yourself (never via an agent): the agent harness blocks
# `supabase secrets list` to prevent secret values from leaking into
# transcripts. This wrapper enforces that contract by piping through
# `awk` to drop everything except the leftmost column (secret name).
#
# Usage:
#   bash scripts/ops/snapshot-fn-secrets.sh
#
# Output:
#   /tmp/prod-fn-secrets.txt
#   /tmp/dev-fn-secrets.txt
#
# Each file lists, per function:
#   === <function-name> ===
#   <secret-names-this-function-uses, names only>
#
# This satisfies Phase 0.6a precondition for Phase 6 (function archival).

set -euo pipefail

PROD_REF="uowjtrzmszuaiokqxgir"
DEV_REF="zqlowjveyqiagnbmfwsb"

# names_only: drop everything but the first whitespace-separated column
# of `supabase secrets list` output (and skip the header row).
names_only() {
  awk 'NR > 1 && NF > 0 { print $1 }'
}

snapshot_project() {
  local label="$1"
  local ref="$2"
  local out="$3"

  echo "[snapshot-fn-secrets] $label ($ref) → $out"
  : > "$out"

  # Per-project secret name list (project-wide, since Supabase secrets
  # aren't scoped per-function — but we record them per-function for
  # the restore runbook by associating each function's likely secret
  # via name-substring match).
  local all_names
  all_names=$(supabase secrets list --project-ref "$ref" | names_only)

  echo "=== $label project secret names (no values) ===" >> "$out"
  echo "$all_names" >> "$out"
  echo "" >> "$out"

  echo "=== per-function name-substring associations ===" >> "$out"
  for fn in $(supabase functions list --project-ref "$ref" | awk 'NR > 1 && NF > 0 { print $2 }'); do
    echo "--- $fn ---" >> "$out"
    # crude but effective: any secret name whose lowercase form contains
    # part of the function name
    fn_lower=$(echo "$fn" | tr '[:upper:]-' '[:lower:]_')
    fn_token=$(echo "$fn_lower" | awk -F_ '{print toupper($1)}')
    matches=$(echo "$all_names" | grep -i "$fn_token" || true)
    if [ -n "$matches" ]; then
      echo "$matches" >> "$out"
    else
      echo "(uses only auto-injected SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY or shared secrets)" >> "$out"
    fi
  done

  echo "[snapshot-fn-secrets] $label snapshot complete → $out"
}

snapshot_project "prod" "$PROD_REF" "/tmp/prod-fn-secrets.txt"
snapshot_project "dev"  "$DEV_REF"  "/tmp/dev-fn-secrets.txt"

echo ""
echo "Snapshot artifacts (names only — no values):"
echo "  /tmp/prod-fn-secrets.txt  ($(wc -l < /tmp/prod-fn-secrets.txt) lines)"
echo "  /tmp/dev-fn-secrets.txt   ($(wc -l < /tmp/dev-fn-secrets.txt) lines)"
echo ""
echo "Phase 0.6a complete. Phase 6 archival can now safely begin once the"
echo "Phase 5 5-business-day soak gate is passed."
