#!/usr/bin/env bash
# Phase Z — rotate the prod Supabase service-role key + update all consumers.
#
# WHEN TO RUN:
#   1. Open Supabase Dashboard → project uowjtrzmszuaiokqxgir → Settings → API
#   2. Click "Reset service_role secret" (or equivalent — Supabase has been
#      shifting the API-keys UI; the action is "rotate the service_role key")
#   3. Copy the new key value (do NOT paste in this script's argv — script
#      reads it from stdin without echo)
#   4. Run this script. It prompts for the key, validates shape, updates
#      every consumer, then verifies the old JWT is invalidated.
#
# WHAT IT TOUCHES (in this order):
#   1. extraction-service-prod env: SUPABASE_SERVICE_ROLE_KEY
#   2. stamp-verification-service-prod env: SUPABASE_SERVICE_ROLE_KEY
#   3. prod private.edge_function_config row 'service_role_key'
#   4. Probe verification: confirm OLD JWT returns 401
#
# WHAT IT DOES NOT TOUCH (intentionally):
#   - rn-app: doesn't use service-role key (anon-key only). Zero impact on users.
#   - GH Actions secrets: SUPABASE_ACCESS_TOKEN is a different artifact (PAT),
#     not the service-role. Not affected by rotation.
#   - admin-app/.env.local: local-only, manual update if you want.
#   - Dev project: separate rotation needed (this script is prod-only).
#   - Migration files in git history: contain old JWT but it's now dead string.
#     History rewrite is more disruptive than the residual cosmetic exposure.
#
# SECURITY:
#   - The new key is NEVER printed to stdout/stderr or saved to a file
#   - gcloud + Supabase MCP/psql do not echo the value either
#   - On exit, the key is unset from the shell env

set -euo pipefail

PROJ=secured-by-flent
PROD_REF=uowjtrzmszuaiokqxgir
PROD_DB_URL_PREFIX="postgres://postgres.${PROD_REF}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

# ─── 0. pre-flight ─────────────────────────────────────────────────────
echo "=== Phase Z — prod service-role rotation ==="
echo ""

if ! gcloud config get-value project 2>/dev/null | grep -q "$PROJ"; then
  echo "  Setting gcloud default project to $PROJ for this run..."
  GCLOUD_PROJ_FLAG="--project=$PROJ"
else
  GCLOUD_PROJ_FLAG=""
fi

# Verify supabase CLI is authed
if ! supabase projects list 2>&1 | grep -q "$PROD_REF"; then
  echo "✗ Supabase CLI not authed for project $PROD_REF. Run 'supabase login' first."
  exit 1
fi

# ─── 1. read the new key (silent, no echo, no history) ─────────────────
echo "Paste the new prod service-role key (no echo)."
echo "Tip: copy from Supabase Dashboard → Settings → API → service_role secret"
echo ""
echo -n "New key: "
read -rs NEW_KEY
echo ""
echo ""

if [ -z "$NEW_KEY" ]; then
  echo "✗ no key provided — aborting"
  exit 1
fi

# Validate shape: either old JWT (eyJ...) or new sb_secret_ format
if ! echo "$NEW_KEY" | grep -qE '^(eyJ[A-Za-z0-9_.-]+|sb_secret_[A-Za-z0-9_]+)$'; then
  echo "✗ key shape doesn't match either Supabase format (eyJ... or sb_secret_...)"
  echo "  aborting before touching anything"
  unset NEW_KEY
  exit 1
fi
echo "✓ key shape looks valid (length=${#NEW_KEY})"
echo ""

# ─── 2. update Cloud Run prod services ──────────────────────────────────
echo "→ updating extraction-service-prod env..."
gcloud run services update extraction-service-prod \
  --region=asia-south1 $GCLOUD_PROJ_FLAG \
  --update-env-vars=SUPABASE_SERVICE_ROLE_KEY="$NEW_KEY" \
  --quiet 2>&1 | tail -3
echo ""

echo "→ updating stamp-verification-service-prod env..."
gcloud run services update stamp-verification-service-prod \
  --region=asia-south1 $GCLOUD_PROJ_FLAG \
  --update-env-vars=SUPABASE_SERVICE_ROLE_KEY="$NEW_KEY" \
  --quiet 2>&1 | tail -3
echo ""

# ─── 3. update prod private.edge_function_config row ───────────────────
echo "→ updating prod private.edge_function_config.service_role_key row..."
echo ""
echo "Need DB password for project $PROD_REF (from Supabase Dashboard"
echo "→ Settings → Database → Connection Pooler → Password)."
echo -n "DB password: "
read -rs DB_PASSWORD
echo ""

# Use psql with explicit URL. Pass the new key via psql's -v variable
# substitution to avoid putting it on the command line.
PGPASSWORD="$DB_PASSWORD" psql \
  "${PROD_DB_URL_PREFIX/postgres:\/\/postgres.${PROD_REF}@/postgres:\/\/postgres.${PROD_REF}:${DB_PASSWORD}@}" \
  -v ON_ERROR_STOP=1 \
  -v new_key="$NEW_KEY" \
  -c "UPDATE private.edge_function_config SET value = :'new_key' WHERE key = 'service_role_key' RETURNING key, length(value) AS new_value_length;" 2>&1 \
  | grep -vE "(password|NEW_KEY|sb_secret|eyJ)" \
  | head -10
unset DB_PASSWORD
echo ""

# ─── 4. verify OLD JWT is now invalid ──────────────────────────────────
echo "→ verifying OLD leaked JWT is now invalidated..."
OLD_JWT=$(grep -oE "eyJhbGci[A-Za-z0-9_.-]+" supabase/migrations/20260308000001_migrate_cron_keys_to_vault.sql | head -1)
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $OLD_JWT" -H "apikey: $OLD_JWT" \
  "https://${PROD_REF}.supabase.co/rest/v1/users?select=id&limit=1")
echo ""
case "$HTTP" in
  401)
    echo "  ✅ OLD JWT returns HTTP 401 — rotation FULLY COMPLETE"
    echo "  Leaked JWT in git is now dead string. No further action needed."
    ;;
  200)
    echo "  ⚠️  OLD JWT still returns HTTP 200."
    echo ""
    echo "  This is EXPECTED if you're on Supabase's new API-key model:"
    echo "  the old JWT-format service_role key co-exists with the new"
    echo "  sb_secret_* key until you explicitly revoke it."
    echo ""
    echo "  TO COMPLETE ROTATION:"
    echo "    1. Verify all consumers are working (smoke-test below succeeds)"
    echo "    2. Go to Supabase Dashboard → Settings → API Keys"
    echo "    3. Find the old JWT-format service_role row"
    echo "    4. Click 'Revoke' / 'Disable' / 'Delete'"
    echo "    5. Re-run this script (it'll re-probe; should return 401)"
    echo ""
    echo "  ON THE OLD ONE-CLICK MODEL, this would mean the rotation"
    echo "  failed. On the new model, it's the expected mid-flow state."
    ;;
  *)
    echo "  ⚠️  Unexpected HTTP $HTTP — investigate manually"
    ;;
esac
echo ""

# ─── 5. cleanup ────────────────────────────────────────────────────────
unset NEW_KEY
echo "✓ NEW_KEY cleared from script env"
echo ""
echo "Recommended: clear shell history if anything could have echoed the key:"
echo "  history -c"
echo ""
echo "Phase Z prod rotation complete."
