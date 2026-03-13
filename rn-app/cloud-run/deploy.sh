#!/usr/bin/env bash
# Cloud Run API Club Proxy — Deployment Script
# Deploys a static-IP proxy for API Club IP whitelisting.
# Idempotent — safe to re-run.
#
# Usage:
#   ./deploy.sh                          # Interactive (prompts for secrets)
#   API_CLUB_KEY=xxx PROXY_SECRET=yyy ./deploy.sh  # Non-interactive

set -euo pipefail

PROJECT_ID="secured-by-flent"
REGION="asia-south1"
GCLOUD="${GCLOUD:-$(which gcloud 2>/dev/null || echo /Users/atrishabh/google-cloud-sdk/bin/gcloud)}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
err()  { echo -e "${RED}[deploy]${NC} $*" >&2; }

# ── Pre-flight checks ────────────────────────────────────────────

if ! command -v "$GCLOUD" &>/dev/null; then
  err "gcloud not found at $GCLOUD"
  exit 1
fi

$GCLOUD config set project "$PROJECT_ID" --quiet

# Prompt for secrets if not in env
if [[ -z "${API_CLUB_KEY:-}" ]]; then
  read -rsp "Enter API_CLUB_KEY: " API_CLUB_KEY
  echo
fi
if [[ -z "${PROXY_SECRET:-}" ]]; then
  read -rsp "Enter PROXY_SECRET (shared secret for Supabase → proxy auth): " PROXY_SECRET
  echo
fi

if [[ -z "$API_CLUB_KEY" || -z "$PROXY_SECRET" ]]; then
  err "Both API_CLUB_KEY and PROXY_SECRET are required"
  exit 1
fi

# ── 1. Enable APIs ───────────────────────────────────────────────

log "Enabling required GCP APIs..."
$GCLOUD services enable \
  run.googleapis.com \
  vpcaccess.googleapis.com \
  compute.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet

# ── 2. Reserve static IP ────────────────────────────────────────

if $GCLOUD compute addresses describe api-club-static-ip --region="$REGION" &>/dev/null; then
  log "Static IP 'api-club-static-ip' already exists"
else
  log "Reserving static external IP..."
  $GCLOUD compute addresses create api-club-static-ip --region="$REGION"
fi

STATIC_IP=$($GCLOUD compute addresses describe api-club-static-ip --region="$REGION" --format='get(address)')
log "Static IP: $STATIC_IP"

# ── 3. VPC network + subnet ─────────────────────────────────────

if $GCLOUD compute networks describe api-club-vpc &>/dev/null; then
  log "VPC 'api-club-vpc' already exists"
else
  log "Creating VPC network..."
  $GCLOUD compute networks create api-club-vpc --subnet-mode=custom --quiet
fi

if $GCLOUD compute networks subnets describe api-club-subnet --region="$REGION" &>/dev/null; then
  log "Subnet 'api-club-subnet' already exists"
else
  log "Creating subnet..."
  $GCLOUD compute networks subnets create api-club-subnet \
    --network=api-club-vpc \
    --region="$REGION" \
    --range=10.8.0.0/28 \
    --quiet
fi

# ── 4. Serverless VPC Access connector ──────────────────────────

if $GCLOUD compute networks vpc-access connectors describe api-club-connector --region="$REGION" &>/dev/null; then
  log "VPC connector 'api-club-connector' already exists"
else
  log "Creating Serverless VPC Access connector..."
  $GCLOUD compute networks vpc-access connectors create api-club-connector \
    --region="$REGION" \
    --subnet=api-club-subnet \
    --quiet
fi

# ── 5. Cloud Router + Cloud NAT ─────────────────────────────────

if $GCLOUD compute routers describe api-club-router --region="$REGION" &>/dev/null; then
  log "Cloud Router 'api-club-router' already exists"
else
  log "Creating Cloud Router..."
  $GCLOUD compute routers create api-club-router \
    --network=api-club-vpc \
    --region="$REGION" \
    --quiet
fi

if $GCLOUD compute routers nats describe api-club-nat --router=api-club-router --region="$REGION" &>/dev/null; then
  log "Cloud NAT 'api-club-nat' already exists"
else
  log "Creating Cloud NAT with static IP..."
  $GCLOUD compute routers nats create api-club-nat \
    --router=api-club-router \
    --region="$REGION" \
    --nat-external-ip-pool=api-club-static-ip \
    --nat-all-subnet-ip-ranges \
    --quiet
fi

# ── 6. Build + Deploy Cloud Run ─────────────────────────────────

log "Deploying Cloud Run service 'api-club-proxy'..."
$GCLOUD run deploy api-club-proxy \
  --source="$SCRIPT_DIR/api-club-proxy" \
  --region="$REGION" \
  --vpc-connector="api-club-connector" \
  --vpc-egress=all-traffic \
  --min-instances=0 \
  --max-instances=5 \
  --memory=256Mi \
  --cpu=1 \
  --timeout=60s \
  --set-env-vars="API_CLUB_KEY=${API_CLUB_KEY},PROXY_SECRET=${PROXY_SECRET}" \
  --allow-unauthenticated \
  --quiet

# ── 7. Print summary ────────────────────────────────────────────

SERVICE_URL=$($GCLOUD run services describe api-club-proxy --region="$REGION" --format='value(status.url)')

echo ""
log "=== Deployment Complete ==="
log "Service URL:  $SERVICE_URL"
log "Static IP:    $STATIC_IP  (whitelist this with API Club)"
log ""
log "Next steps:"
log "  1. Whitelist $STATIC_IP with API Club"
log "  2. Set Supabase secrets:"
log "     supabase secrets set API_CLUB_BASE_URL=\"$SERVICE_URL\" --project-ref uowjtrzmszuaiokqxgir"
log "     supabase secrets set PROXY_SECRET=\"<your-proxy-secret>\" --project-ref uowjtrzmszuaiokqxgir"
log "  3. Test: curl $SERVICE_URL/health"
log "  4. Test with auth: curl -H 'X-Proxy-Secret: <secret>' $SERVICE_URL/fetch_bill_operator"
