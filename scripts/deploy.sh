#!/bin/bash
# Flent Secured — Safe Edge Function Deployment
# Auto-detects git branch and routes to the correct Supabase project.
# Usage: ./scripts/deploy.sh [function-name]
#   No args = deploy ALL functions
#   With arg = deploy single function

set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "main" ]; then
  REF="uowjtrzmszuaiokqxgir"
  printf "\033[33m%s\033[0m\n" "PRODUCTION deployment to Supabase main"
  read -p "Are you sure? (y/N) " confirm
  [ "$confirm" != "y" ] && echo "Cancelled." && exit 1
elif [ "$BRANCH" = "dev" ]; then
  REF="zqlowjveyqiagnbmfwsb"
  printf "\033[36m%s\033[0m\n" "Dev deployment to Supabase branch (v2-backend-dev)"
else
  printf "\033[31m%s\033[0m\n" "Unknown branch: $BRANCH — deploy from 'dev' or 'main' only."
  exit 1
fi

echo "Project ref: $REF"
echo ""

if [ $# -eq 0 ]; then
  echo "Deploying ALL functions..."
  npx supabase functions deploy --project-ref "$REF" --no-verify-jwt
else
  echo "Deploying: $1"
  npx supabase functions deploy "$1" --project-ref "$REF" --no-verify-jwt
fi

echo ""
echo "Done."
