# CI/CD Reference

> **Last reviewed:** 2026-04-25 (Phase 5 of cleanup plan)
>
> Per the cleanup plan, the CI rollout is staged over ~11 days from a
> non-blocking foundation to required-checks gating. This doc captures
> the steady-state design + the manual setup steps that aren't yet
> automated.

## Workflow inventory

```
.github/workflows/
  pr-gates.yml                  PR validation (gitleaks + lint + typecheck + migration-lint)
  deploy.yml                    Reusable orchestrator — called by dev/prod triggers
  deploy-dev-trigger.yml        push to dev branch → deploys to dev infra
  deploy-prod-trigger.yml       push tag `deploy-prod-*` → deploys to prod (no approval gates — tag-push IS the gate)
  mobile-release.yml            workflow_dispatch / tag push → Maestro regression + EAS build + submit
  maestro-nightly.yml           daily 00:30 IST → full Maestro on dev, files issue on failure
  rollback.yml                  workflow_dispatch → per-surface rollback
  synthetic-prod-health.yml     every 5 min → curl auth-otp + extraction-service /health
  secret-age-check.yml          weekly → quarterly secret rotation reminder
  protection-sync.yml           daily → assert main branch protection matches committed JSON
  _reusable-lint.yml            building block: typecheck + eslint per subproject
  _reusable-supabase.yml        building block: supabase db push or functions deploy
  _reusable-cloud-run.yml       building block: gcloud run deploy --no-traffic + probe + promote
  _reusable-eas-update.yml      building block: eas update --branch <channel>
```

## Branch → environment routing

| Git branch | Trigger workflow | Supabase project | Cloud Run service | EAS channel |
|---|---|---|---|---|
| `dev` (push) | `deploy-dev-trigger.yml` | `zqlowjveyqiagnbmfwsb` | `extraction-service-dev` | `development` |
| Tag `deploy-prod-*` push | `deploy-prod-trigger.yml` (no Environment gate — tag-push IS the deploy decision) | `uowjtrzmszuaiokqxgir` | `extraction-service-prod` | `production` |
| Tag `v*` | `mobile-release.yml` | n/a | n/a | builds prod profile, submits to TestFlight |

**Why tag-trigger for prod:** push-to-main does NOT auto-deploy. The deploy decision is decoupled from the merge decision so doc-only fixes, refactors, batched merges don't auto-deploy to prod. To deploy: `git tag deploy-prod-$(date +%Y-%m-%d)-<slug> && git push origin <tag>`. The tag itself + auto-generated GitHub Release with commit notes is the audit trail.

## Required GH secrets

Configure under repo Settings → Secrets and variables → Actions.

| Secret | Where used | How to obtain |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | _reusable-supabase.yml | Supabase dashboard → Account → Access Tokens |
| `EXPO_TOKEN` | _reusable-eas-update.yml, mobile-release.yml | expo.dev → Account → Access Tokens |
| `GCP_WIF_PROVIDER` | _reusable-cloud-run.yml, rollback.yml | Workload Identity Federation provider resource path (see "WIF Setup" below) |
| `GCP_SA_EMAIL` | _reusable-cloud-run.yml, rollback.yml | `cloud-run-deployer-prod@secured-by-flent.iam.gserviceaccount.com` (or per-env) |
| `EXPO_APPLE_API_KEY_BASE64` | mobile-release.yml | base64 of `AuthKey_*.p8` from Apple Developer |
| `MAESTRO_CLOUD_API_KEY` | maestro-nightly.yml, mobile-release.yml | mobile.dev dashboard |
| `SLACK_DEPLOYS_WEBHOOK` | deploy.yml notify job (optional) | Slack incoming webhook URL |

## Workload Identity Federation setup (one-time)

Run once before `_reusable-cloud-run.yml` will work. Replace `<PROJECT_NUMBER>` with the output of `gcloud projects describe secured-by-flent --format='value(projectNumber)'`.

```bash
PROJECT=secured-by-flent
PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')

# 1. Create a workload identity pool
gcloud iam workload-identity-pools create github-pool \
  --location=global --project=$PROJECT \
  --display-name="GitHub Actions pool"

# 2. Create OIDC provider scoped to this repo
gcloud iam workload-identity-pools providers create-oidc github-prod \
  --location=global \
  --project=$PROJECT \
  --workload-identity-pool=github-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="attribute.repository == 'flent-homes/Secured-v2'"

# 3. Create deploy service accounts (per environment)
gcloud iam service-accounts create cloud-run-deployer-prod \
  --project=$PROJECT \
  --display-name="GitHub Actions — Cloud Run prod deployer"

gcloud iam service-accounts create cloud-run-deployer-dev \
  --project=$PROJECT \
  --display-name="GitHub Actions — Cloud Run dev deployer"

# 4. Bind the SAs to the pool — only THIS repo can impersonate them
for env in prod dev; do
  SA="cloud-run-deployer-${env}@${PROJECT}.iam.gserviceaccount.com"
  gcloud iam service-accounts add-iam-policy-binding $SA \
    --project=$PROJECT \
    --role=roles/iam.workloadIdentityUser \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/flent-homes/Secured-v2"

  # 5. Grant the SAs the roles they need to deploy + use Cloud Build
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" \
    --role=roles/run.admin
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" \
    --role=roles/iam.serviceAccountUser
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" \
    --role=roles/cloudbuild.builds.editor
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" \
    --role=roles/artifactregistry.writer
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" \
    --role=roles/storage.objectViewer
done

# 6. The values to put in GH secrets:
echo "GCP_WIF_PROVIDER = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-prod"
echo "GCP_SA_EMAIL = cloud-run-deployer-prod@${PROJECT}.iam.gserviceaccount.com"
```

If the deploy ever fails with "PERMISSION_DENIED" on Artifact Registry or Cloud Build, the SA is missing the corresponding role from step 5.

## Branch protection setup (Phase 5 Day 8)

Two rules — one per branch.

```bash
# Apply the committed JSON
gh api -X PUT repos/flent-homes/Secured-v2/branches/main/protection \
  --input .github/branch-protection-main.json

gh api -X PUT repos/flent-homes/Secured-v2/branches/dev/protection \
  --input .github/branch-protection-dev.json
```

Both JSONs require `PR gates summary` as the only status check (the summary job orchestrates the underlying checks). When `pr-gates-summary` flips from non-blocking to blocking, this rule starts gating merges.

## GitHub Environments — NOT used (tag-trigger replaces this)

The original cleanup plan called for `production-migrations` + `production-cloud-run` GitHub Environments with required reviewer + 5-min wait timer. These require GitHub Pro on private repos. **Project decision (2026-04-26): skip the Pro upgrade.** See memory `project_branch_protection_deferred.md`.

**Replacement gate: tag-triggered prod deploy** (see Branch → environment routing table above). Pushing to `main` does NOT auto-deploy. To deploy:

```bash
# After merging to main and verifying:
SLUG="cashfree-rotation"   # short description of what's deploying
git tag "deploy-prod-$(date +%Y-%m-%d)-${SLUG}"
git push origin "deploy-prod-$(date +%Y-%m-%d)-${SLUG}"
```

The tag is the deploy artifact + audit trail. The workflow also auto-creates a GitHub Release on the tag with commit-since-last-deploy notes.

**Backup manual trigger:** GitHub Actions UI → "deploy-prod" → "Run workflow" → click. Same effect as tag-push without creating a tag.

## Rollback playbook

Single-command per surface:

```bash
# Cloud Run (e.g., extraction-service-prod) → roll traffic to prior revision
gh workflow run rollback.yml \
  -f surface=cloud-run \
  -f service=extraction-service-prod \
  -f revision_or_sha=extraction-service-prod-00014-8f7 \
  -f confirm=ROLLBACK

# Edge function → checkout prior SHA + redeploy
gh workflow run rollback.yml \
  -f surface=edge-fns \
  -f service=admin-waitlist \
  -f revision_or_sha=ac26d4ae \
  -f confirm=ROLLBACK

# Migration → print rollback block; manual apply only (auto-apply is too dangerous)
gh workflow run rollback.yml \
  -f surface=migrations \
  -f revision_or_sha=20260425131920 \
  -f confirm=ROLLBACK

# EAS update → republish previous group
gh workflow run rollback.yml \
  -f surface=eas \
  -f service=production \
  -f revision_or_sha=<prev-update-group-id> \
  -f confirm=ROLLBACK
```

For a real incident:
1. Identify which surface broke (logs, monitoring, user reports)
2. Find the prior known-good identifier:
   - Cloud Run: `gcloud run revisions list --service=extraction-service-prod --region=asia-south1 --project=secured-by-flent`
   - Edge fn: `git log --oneline supabase/functions/<name>/`
   - Migration: rare; usually need a forward-fix migration instead
   - EAS: `eas update:list --branch production`
3. Run the rollback workflow above
4. Verify with synthetic-prod-health (or manual smoke)
5. Open an issue for the post-mortem

## Migration-lint rules

Per `scripts/ci/lint-migrations.mjs`. Eleven rules — full reference in
`docs/backend/cron-jobs.md` and the script header.

To add a new rule, edit the script and add a sample violation as a unit
test (TODO — not yet wired). Re-run `node scripts/ci/lint-migrations.mjs`
locally to verify.

## Sequencing (the rollout)

| Day | Action |
|---|---|
| Day 1 | CODEOWNERS + .gitleaks.toml + pr-gates.yml in non-blocking mode (DONE — `ed0cac7c`) |
| Day 2 | scripts/ci/lint-migrations.mjs (DONE — `ed0cac7c`) |
| Day 3 | WIF setup commands above + _reusable-cloud-run.yml (DONE — `34f3ddc0`+) |
| Day 4 | _reusable-supabase.yml functions mode (DONE) |
| Day 5–10 | Migration cutover soak — `--dry-run` only for one full week |
| Day 8 | **FLIP REQUIRED CHECKS** for main + dev (10-green-runs gate first) |
| Day 9 | deploy-prod-trigger.yml + GitHub Environments approval gates |
| Day 10 | mobile-release.yml + maestro-nightly.yml |
| Day 11 | synthetic-prod-health.yml + secret-age-check.yml + protection-sync.yml + rollback.yml (DONE) |
| Day 12+ | Replace `cloud-run/extraction-service/deploy.sh` body + `rn-app/scripts/ota-*.sh` with `gh workflow run ...` thin wrappers. Connect Vercel projects to GitHub. |

The 11-day timeline is aggressive for a solo dev — extend each day to a working day and the rollout takes ~3 weeks calendar.
