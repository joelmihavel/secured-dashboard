# Claude Code Review - Vertex AI Setup Guide

This guide explains how to configure Google Cloud Vertex AI for Claude Code Review in GitHub Actions.

## Prerequisites

- GCP Project: `flent-ai-project-2` (Flent AI)
- Region: `us-east5`
- GitHub Repository: `secured-v2`
- Claude Code GitHub App installed

## Step 1: Enable Required GCP APIs

In the Google Cloud Console for project `flent-ai-project-2`:

```bash
gcloud services enable iamcredentials.googleapis.com --project=flent-ai-project-2
gcloud services enable sts.googleapis.com --project=flent-ai-project-2
gcloud services enable aiplatform.googleapis.com --project=flent-ai-project-2
```

## Step 2: Create Workload Identity Pool

1. Go to **IAM & Admin > Workload Identity Federation** in GCP Console
2. Create a new Workload Identity Pool:
   - **Name**: `github-actions-pool`
   - **Pool ID**: `github-actions-pool`

Or via CLI:

```bash
gcloud iam workload-identity-pools create github-actions-pool \
  --project=flent-ai-project-2 \
  --location=global \
  --display-name="GitHub Actions Pool"
```

## Step 3: Add GitHub OIDC Provider

Add a provider to the workload identity pool:

```bash
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=flent-ai-project-2 \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --display-name="GitHub OIDC Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner"
```

## Step 4: Create Service Account

Create a dedicated service account for Claude Code:

```bash
gcloud iam service-accounts create claude-code-reviewer \
  --project=flent-ai-project-2 \
  --display-name="Claude Code Reviewer"
```

## Step 5: Grant Vertex AI Permissions

Grant the service account access to Vertex AI:

```bash
gcloud projects add-iam-policy-binding flent-ai-project-2 \
  --member="serviceAccount:claude-code-reviewer@flent-ai-project-2.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

## Step 6: Configure Workload Identity Federation Binding

Allow GitHub Actions to impersonate the service account:

```bash
# Get your GCP project number
PROJECT_NUMBER=$(gcloud projects describe flent-ai-project-2 --format='value(projectNumber)')

# Create the IAM binding (replace OWNER/REPO with your GitHub repo)
gcloud iam service-accounts add-iam-policy-binding \
  claude-code-reviewer@flent-ai-project-2.iam.gserviceaccount.com \
  --project=flent-ai-project-2 \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/OWNER/secured-v2"
```

## Step 7: Get Workload Identity Provider Resource Name

```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe flent-ai-project-2 --format='value(projectNumber)')

# The provider resource name format:
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider"
```

## Step 8: Configure GitHub Secrets

Add these secrets to your GitHub repository (**Settings > Secrets and variables > Actions**):

| Secret Name | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `claude-code-reviewer@flent-ai-project-2.iam.gserviceaccount.com` |
| `CLAUDE_CODE_APP_ID` | Your Claude Code GitHub App ID |
| `CLAUDE_CODE_APP_PRIVATE_KEY` | Your Claude Code GitHub App private key |

### Finding Claude Code GitHub App Credentials

1. Go to **GitHub Settings > Developer settings > GitHub Apps**
2. Find your Claude Code app
3. Copy the **App ID** from the General section
4. Generate and download a **Private Key** from the same page

## Step 9: Verify Setup

Create a test PR that modifies files in `supabase/` or `tests/` directories to trigger the CI pipeline.

The Claude Code Review job should:
1. Authenticate to GCP using Workload Identity Federation
2. Use Vertex AI to run Claude
3. Review the PR and post comments

## Troubleshooting

### OIDC Token Error
If you see "unable to retrieve ACTIONS_ID_TOKEN_REQUEST_URL", ensure:
- The workflow has `id-token: write` permission
- The repository has GitHub Actions enabled

### Permission Denied
If authentication fails:
- Verify the service account has `Vertex AI User` role
- Check the Workload Identity Pool binding includes your repository
- Ensure the provider resource name is correct

### Model Not Found
If the model isn't available:
- Claude models on Vertex AI are region-specific
- Ensure `us-east5` supports the model version
- Try `claude-sonnet-4@20250514` or check latest available models

## Security Best Practices

1. **Repository-specific binding**: The IAM binding restricts access to your specific repository only
2. **Minimal permissions**: Service account only has `Vertex AI User` role
3. **No downloadable keys**: Workload Identity Federation eliminates service account key files
4. **Audit logging**: GCP automatically logs all Vertex AI API calls

## References

- [Claude Code GitHub Actions Docs](https://code.claude.com/docs/en/github-actions)
- [Google Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Anthropic Claude on Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude)
