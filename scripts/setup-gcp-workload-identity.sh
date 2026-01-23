#!/bin/bash
# =============================================================================
# Flent Secured v2 - GCP Workload Identity Federation Setup
# =============================================================================
# This script sets up OIDC authentication between GitHub Actions and GCP
# for Claude Code Review using Vertex AI.
#
# Prerequisites:
# - gcloud CLI installed and authenticated as project Owner/Admin
# - Access to flent-ai-project-2 (Flent APIs)
#
# Usage: ./setup-gcp-workload-identity.sh
# =============================================================================

set -e

# Configuration
PROJECT_ID="flent-ai-project-2"
POOL_ID="github-actions-pool"
PROVIDER_ID="github-provider"
SERVICE_ACCOUNT_NAME="claude-code-reviewer"
GITHUB_REPO="flent-homes/secured-v2"
REGION="us-east5"

echo "=============================================="
echo "Setting up GCP Workload Identity Federation"
echo "Project: $PROJECT_ID"
echo "GitHub Repo: $GITHUB_REPO"
echo "=============================================="

# Step 1: Set project
echo ""
echo "[1/8] Setting GCP project..."
gcloud config set project $PROJECT_ID

# Step 2: Enable required APIs
echo ""
echo "[2/8] Enabling required APIs..."
gcloud services enable \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  aiplatform.googleapis.com \
  iam.googleapis.com \
  --project=$PROJECT_ID

# Step 3: Create Workload Identity Pool
echo ""
echo "[3/8] Creating Workload Identity Pool..."
if gcloud iam workload-identity-pools describe $POOL_ID --location=global --project=$PROJECT_ID &>/dev/null; then
  echo "Pool '$POOL_ID' already exists, skipping..."
else
  gcloud iam workload-identity-pools create $POOL_ID \
    --project=$PROJECT_ID \
    --location=global \
    --display-name="GitHub Actions Pool"
  echo "Pool created successfully"
fi

# Step 4: Create OIDC Provider
echo ""
echo "[4/8] Creating GitHub OIDC Provider..."
if gcloud iam workload-identity-pools providers describe $PROVIDER_ID --workload-identity-pool=$POOL_ID --location=global --project=$PROJECT_ID &>/dev/null; then
  echo "Provider '$PROVIDER_ID' already exists, skipping..."
else
  gcloud iam workload-identity-pools providers create-oidc $PROVIDER_ID \
    --project=$PROJECT_ID \
    --location=global \
    --workload-identity-pool=$POOL_ID \
    --display-name="GitHub OIDC Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner"
  echo "Provider created successfully"
fi

# Step 5: Create Service Account
echo ""
echo "[5/8] Creating Service Account..."
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL --project=$PROJECT_ID &>/dev/null; then
  echo "Service account '$SERVICE_ACCOUNT_NAME' already exists, skipping..."
else
  gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --project=$PROJECT_ID \
    --display-name="Claude Code Reviewer"
  echo "Service account created successfully"
fi

# Step 6: Grant Vertex AI User role
echo ""
echo "[6/8] Granting Vertex AI User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/aiplatform.user" \
  --condition=None \
  --quiet

echo "Vertex AI User role granted"

# Step 7: Get project number and create IAM binding
echo ""
echo "[7/8] Creating Workload Identity binding for GitHub repo..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  --quiet

echo "IAM binding created for $GITHUB_REPO"

# Step 8: Output GitHub Secrets
echo ""
echo "=============================================="
echo "[8/8] SETUP COMPLETE!"
echo "=============================================="
echo ""
echo "Add these secrets to your GitHub repository:"
echo "(Settings > Secrets and variables > Actions)"
echo ""
echo "┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐"
echo "│ GCP_WORKLOAD_IDENTITY_PROVIDER                                                                          │"
echo "├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤"
echo "│ projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}  │"
echo "└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘"
echo ""
echo "┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐"
echo "│ GCP_SERVICE_ACCOUNT                                                                                     │"
echo "├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤"
echo "│ ${SERVICE_ACCOUNT_EMAIL}                                                                                │"
echo "└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘"
echo ""
echo "You also need to add your Claude Code GitHub App credentials:"
echo "  - CLAUDE_CODE_APP_ID: Your GitHub App ID"
echo "  - CLAUDE_CODE_APP_PRIVATE_KEY: Your GitHub App private key"
echo ""
echo "To find your Claude Code GitHub App credentials:"
echo "  1. Go to: https://github.com/settings/apps"
echo "  2. Find your Claude Code app"
echo "  3. Copy the App ID from the General section"
echo "  4. Generate a new Private Key if needed"
echo ""
