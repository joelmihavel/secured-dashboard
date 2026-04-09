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

echo "Deploying to Cloud Run..."
gcloud run deploy extraction-service \
  --image "${IMAGE}:${TAG}" \
  --region asia-south1 \
  --project secured-by-flent \
  --memory 1Gi \
  --cpu 2 \
  --timeout 900 \
  --max-instances 10 \
  --concurrency 1 \
  --no-allow-unauthenticated \
  --set-env-vars "NODE_ENV=production"

echo "Deployment complete."
