# Cloud Run Services

> **Last reviewed:** 2026-04-25

Cloud Run hosts the heavy-lift workloads that don't fit in Supabase's
edge function environment (long timeouts, GCP API access, native
binaries). All services live in GCP project `secured-by-flent`,
region `asia-south1` (Mumbai).

For deeper context see:
- [docs/ENVIRONMENT_INFRASTRUCTURE.md § Cloud Run Services](../ENVIRONMENT_INFRASTRUCTURE.md#cloud-run-services) — env var matrix per service
- [docs/backend/cashfree-integration.md](../backend/cashfree-integration.md) — payment + identity flows that route through Cloud Run
- [docs/backend/stamp-verification.md](../backend/stamp-verification.md) — SHCIL verification pipeline
- [docs/infrastructure/gcp-iam.md](./gcp-iam.md) — IAM audit findings
- [docs/infrastructure/data-residency.md](./data-residency.md) — region audit

## Service inventory

| Service | Source | Purpose |
|---|---|---|
| `extraction-service-prod` | `cloud-run/extraction-service/` (this repo) | Rent agreement OCR + Gemini extraction (15-min timeout). Invoked by `process-document` and `extraction-recovery` edge functions. |
| `extraction-service-dev` | `cloud-run/extraction-service/` (this repo) | Same code as prod, points at dev Supabase branch. |
| `stamp-verification-service-prod` | **NOT in this repo** | SHCIL e-Stamp verification with 2Captcha + ZenRows. Invoked by `extraction-service-prod` (cross-Cloud-Run) + `sweep-stamp-verifications` edge fn. |
| `stamp-verification-service-dev` | **NOT in this repo** (image-reuse from prod) | Same image as prod, dev env vars. |
| `api-club-proxy` | `rn-app/cloud-run/api-club-proxy/` (this repo, weird location) | Static-IP reverse proxy for the API Club utility-bill API which IP-whitelists callers. Invoked by `verify-utility` edge fn. |

## Why Cloud Run, not edge functions?

| Reason | Service |
|---|---|
| 15-min timeout for slow extractions | extraction-service |
| Persistent JS context with native deps (puppeteer-style scraping) | stamp-verification-service |
| Static outbound IP (vendor allowlists ours) | api-club-proxy |

Edge functions max at 60s and run on shared infra without a stable IP. None of the above use cases work there.

## Deploy commands

Per `docs/ENVIRONMENT_INFRASTRUCTURE.md` and `docs/ci-cd.md`:

```bash
# Manual one-off (rarely — usually CI does this)
cd cloud-run/extraction-service
gcloud run deploy extraction-service-prod \
  --source . --region=asia-south1 --project=secured-by-flent

# CI path (Phase 5 Day 3+, see docs/ci-cd.md)
gh workflow run deploy-prod-trigger.yml
# (push to main also auto-triggers it)
```

⚠️ **Never use `--set-env-vars` in CI.** It wipes existing env vars including secrets. The CI workflow `_reusable-cloud-run.yml` enforces this by snapshotting env hash before/after deploy and failing on drift.

For one-time env additions (rare), use `--update-env-vars` or `--set-secrets` (mergesemantics, not replace):

```bash
gcloud run services update extraction-service-prod \
  --region=asia-south1 --project=secured-by-flent \
  --update-env-vars NEW_KEY=value

gcloud run services update extraction-service-prod \
  --region=asia-south1 --project=secured-by-flent \
  --update-secrets MY_SECRET=my-secret-name:latest
```

## Health checks

All services expose `/health` returning `{"status":"ok",...}`.

```bash
# extraction-service-prod (allUsers invoker — see IAM audit)
curl https://extraction-service-prod-nbmslvmlcq-el.a.run.app/health

# extraction-service-dev (no public binding — needs IAM token)
URL=https://extraction-service-dev-nbmslvmlcq-el.a.run.app
TOKEN=$(gcloud auth print-identity-token --audiences=$URL)
curl -H "Authorization: Bearer $TOKEN" $URL/health
```

The synthetic-prod-health.yml workflow probes the prod /health every 5 minutes.

## Source-not-in-repo workflow (stamp-verification-service)

The stamp service was deployed by image-reuse — see the `extraction-service-dev` history for the pattern. To rebuild from source:

1. Find wherever the source lives (likely a separate repo or the v1 author's machine — see git blame on the original deploy commits)
2. Build + push a new image to `asia-south1-docker.pkg.dev/secured-by-flent/cloud-run-source-deploy/stamp-verification-service-prod`
3. Redeploy via `gcloud run deploy stamp-verification-service-prod --image=<new-digest>`

The image-pin drift detection workflow (`stamp-verification-image-pin.yml` — Phase 5 follow-up, not yet built) will alert if the deployed digest diverges from a pinned digest in this repo.

## Known issues

Per [docs/infrastructure/gcp-iam.md](./gcp-iam.md):

- 🟥 All services run as the default Compute Engine SA with `roles/editor` project-wide. Recommend creating per-service SAs with least-privilege bindings.
- 🟥 `extraction-service-prod`, `stamp-verification-service-prod`, and `api-club-proxy` have `allUsers → roles/run.invoker` bindings. The services themselves enforce a header secret check, but defense-in-depth would prefer no public network exposure.

Per [docs/infrastructure/data-residency.md](./data-residency.md):

- 🟥 `GCP_LOCATION=us` for Document AI processor — rent agreement PII processed in US.
- 🟥 Vertex AI calls use `global` location — region non-deterministic.

These are tracked in the cleanup plan, not auto-fixed because each touches IAM bindings or vendor configurations.
