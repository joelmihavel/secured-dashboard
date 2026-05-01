#!/usr/bin/env bash
set -euo pipefail

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Build Docker image
IMAGE="asia-south1-docker.pkg.dev/secured-by-flent/cloud-run/extraction-service"
TAG="${1:-latest}"

echo "Building Docker image: ${IMAGE}:${TAG}"
docker build -t "${IMAGE}:${TAG}" .

echo "Pushing image..."
docker push "${IMAGE}:${TAG}"

# NOTE: Live services are extraction-service-prod and extraction-service-dev,
# deployed via .github/workflows/_reusable-cloud-run.yml (called from
# deploy-prod-trigger.yml / deploy-dev-trigger.yml). This script is a manual
# fallback that targets PROD; CI is the canonical deploy path.
# --set-env-vars is intentionally OMITTED — it wipes existing env vars.
# Use the GCP console (or `gcloud run services update --update-env-vars`)
# for env changes, never this script.
echo "Deploying to Cloud Run (extraction-service-prod, min=3)..."
gcloud run deploy extraction-service-prod \
  --image "${IMAGE}:${TAG}" \
  --region asia-south1 \
  --project secured-by-flent \
  --memory 1Gi \
  --cpu 2 \
  --timeout 900 \
  --min-instances 3 \
  --max-instances 10 \
  --concurrency 1 \
  --no-allow-unauthenticated

echo "Deployment complete."
