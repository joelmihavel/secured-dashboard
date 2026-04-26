# GCP IAM Audit — Cloud Run Services

> **Last reviewed:** 2026-04-26 (Phase 7a of cleanup plan, finding #1 RESOLVED)
>
> Run this audit periodically (or wire it into a CI workflow) — IAM drift is silent and hard to spot.

## Current state (snapshot 2026-04-26)

### Service accounts in use

All 4 extraction + stamp Cloud Run services now run as **dedicated per-service SAs**:

| Cloud Run service | Service account |
|---|---|
| extraction-service-prod | `extraction-service-prod-sa@secured-by-flent.iam.gserviceaccount.com` |
| extraction-service-dev | `extraction-service-dev-sa@secured-by-flent.iam.gserviceaccount.com` |
| stamp-verification-service-prod | `stamp-verifier-prod-sa@secured-by-flent.iam.gserviceaccount.com` |
| stamp-verification-service-dev | `stamp-verifier-dev-sa@secured-by-flent.iam.gserviceaccount.com` |
| api-club-proxy | (still default compute SA — out of scope, not part of extraction pipeline) |

### Roles per per-service SA

**`extraction-service-{dev,prod}-sa`:**
- `roles/logging.logWriter` (project-level — Cloud Run runtime requirement)
- `roles/monitoring.metricWriter` (project-level)
- `roles/documentai.apiUser` (project-level — for OCR calls to processor `e427db2ce3a92621`)
- `roles/secretmanager.secretAccessor` on `extraction-doc-ai-creds` (resource-scoped)
- `roles/secretmanager.secretAccessor` on `extraction-gcp-creds` (resource-scoped)
- `roles/aiplatform.user` on `flent-ai-project-2` (cross-project — for Vertex AI Gemini)

**`stamp-verifier-{dev,prod}-sa`:**
- `roles/logging.logWriter` (project-level)
- `roles/monitoring.metricWriter` (project-level)
- `roles/secretmanager.secretAccessor` on `stamp-verification-secret` (resource-scoped)
- `roles/secretmanager.secretAccessor` on `twocaptcha-api-key` (resource-scoped)

### Default compute SA — still `roles/editor` (residual concern)

```
150238445962-compute@developer.gserviceaccount.com → roles/editor
```

The default compute SA still has `roles/editor` project-wide, but **no Cloud Run service runtime is using it anymore** (extraction + stamp all switched to per-service SAs as of 2026-04-26 ~06:55 UTC). It's still used by Cloud Build for source-deploys (`gcloud run deploy --source` uses it as the build SA). Removing `roles/editor` requires careful audit of who else relies on it (Cloud Build, any other workloads). Treat as Phase 7a cleanup task: separate from the SA-switch migration.

> **Note on the `?? 'us'` fallback in code:** `cloud-run/extraction-service/src/config.ts` reads `process.env.GCP_LOCATION ?? 'us'`. The fallback is **intentional rollback insurance** — if the Cloud Run env var is ever cleared in an emergency rollback, the service starts up against the original US processor instead of crashing. Production env vars on `extraction-service-{prod,dev}` are explicitly set to `asia-south1` (verified 2026-04-26 — `gcloud run services describe ... --format='value(spec.template.spec.containers[0].env)'`). The code default does NOT indicate stale deployment.

✅ **CRITICAL FINDING #1 RESOLVED (2026-04-26):** runtime SAs are now per-service with least-privilege bindings. The "compromise of one Cloud Run container = roles/editor on whole project" attack path is closed for extraction + stamp services. A compromise of `extraction-service-prod` now only grants:
- DocAI API calls (no destructive scope)
- Read of 2 specific secrets (`extraction-doc-ai-creds`, `extraction-gcp-creds`)
- Vertex AI calls on a separate project
- Logging/monitoring writes

Default compute SA `roles/editor` remains for Cloud Build but is no longer attached to runtime workloads.

### Public invoker bindings on Cloud Run

```
extraction-service-prod          → allUsers / roles/run.invoker
stamp-verification-service-prod  → allUsers / roles/run.invoker
api-club-proxy                   → allUsers / roles/run.invoker
extraction-service-dev           → (empty — no public binding)
stamp-verification-service-dev   → (empty — no public binding)
```

🟥 **CRITICAL FINDING #2:** prod Cloud Run services are publicly invokable. Anyone on the internet can hit `https://extraction-service-prod-...run.app/extract` and the network layer accepts the request. The services themselves enforce a `x-extraction-secret` header check in middleware, so unauthorized requests get a 401 — but:
- That's defense-in-depth, not zero-trust. A bug in middleware or a leaked secret would directly expose the service.
- Public-invoker services attract unauthorized probing traffic, generating log noise that can hide real attacks.
- It's the inverse of the `--no-allow-unauthenticated` flag used at deploy time — someone added the `allUsers` binding manually post-deploy.
- Notably **dev is more locked down than prod** here, which is backwards.

### What's NOT broken

- Cloud Run secret bindings via `--set-secrets` work correctly: extraction-service-{prod,dev} both reference the `extraction-doc-ai-creds` and `extraction-gcp-creds` secrets via Secret Manager (good).
- Stamp verification service has dedicated `stamp-verification-secret` and `twocaptcha-api-key` bindings (good).
- Auto-injected env vars (`SUPABASE_*` for edge functions) are managed correctly by Supabase platform.

## Recommended remediation

Sequenced from lowest blast radius to highest. Each step is independently revertible.

### Step 1 — Create dedicated per-service SAs (no behavior change)

```bash
# Per-service SAs
for svc in extraction-service-prod extraction-service-dev \
           stamp-verification-service-prod stamp-verification-service-dev \
           api-club-proxy; do
  gcloud iam service-accounts create "$svc-sa" \
    --project=secured-by-flent \
    --display-name="$svc Cloud Run runtime"
done
```

This just creates the SAs — no role assignments yet, no behavior change.

### Step 2 — Bind only the roles each service actually needs

**extraction-service-{prod,dev}:**
- `roles/secretmanager.secretAccessor` on `extraction-doc-ai-creds` and `extraction-gcp-creds` (per-secret binding, not project-wide)
- `roles/documentai.apiUser` on the project (Document AI processor calls)
- `roles/aiplatform.user` on `flent-ai-project-2` (cross-project Vertex AI)

```bash
# Example for extraction-service-prod
SA=extraction-service-prod-sa@secured-by-flent.iam.gserviceaccount.com

# Per-secret access (NOT project-wide secretmanager.secretAccessor)
gcloud secrets add-iam-policy-binding extraction-doc-ai-creds \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor" \
  --project=secured-by-flent
gcloud secrets add-iam-policy-binding extraction-gcp-creds \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor" \
  --project=secured-by-flent

# Document AI invocation
gcloud projects add-iam-policy-binding secured-by-flent \
  --member="serviceAccount:$SA" --role="roles/documentai.apiUser"

# Cross-project Vertex AI
gcloud projects add-iam-policy-binding flent-ai-project-2 \
  --member="serviceAccount:$SA" --role="roles/aiplatform.user"
```

**stamp-verification-service-{prod,dev}:**
- `roles/secretmanager.secretAccessor` on `stamp-verification-secret` and `twocaptcha-api-key` only

**api-club-proxy:**
- `roles/secretmanager.secretAccessor` on whatever secrets it currently reads (audit needed)

**No service should get:**
- `roles/owner`
- `roles/editor`
- `roles/storage.admin` (unless really writing to GCS)
- `roles/iam.*` (unless managing IAM, which workloads should not)

### Step 3 — Switch each Cloud Run service to use its dedicated SA

For each service, redeploy with `--service-account`:

```bash
gcloud run services update extraction-service-prod \
  --region=asia-south1 --project=secured-by-flent \
  --service-account=extraction-service-prod-sa@secured-by-flent.iam.gserviceaccount.com
```

This is a no-traffic-change update — the existing revision continues serving until the new one is ready. **Smoke test after each switch** by triggering a real extraction.

If any service breaks (missing role), revert with:
```bash
gcloud run services update <svc> --region=asia-south1 --project=secured-by-flent \
  --service-account=150238445962-compute@developer.gserviceaccount.com
```
Then add the missing role and retry.

### Step 4 — Remove the public-invoker bindings (after Step 3 + verifying callers)

For services that should NOT be publicly invokable, identify the legitimate callers first:

**extraction-service-prod** is invoked by:
- `process-document` edge function (Supabase serverless)
- `extraction-recovery` edge function (Supabase cron-driven)

Supabase edge functions don't have stable per-function GCP identities — they invoke via outbound HTTP from Supabase's IP pool. So you can't replace `allUsers → run.invoker` with a specific principal.

**Options:**

1. **Keep the secret-header check + remove `allUsers`.** This means edge functions need to authenticate with a Google identity token (gcloud auth print-identity-token equivalent) when calling Cloud Run. Requires per-edge-function service account configuration in Supabase, which Supabase doesn't natively support.

2. **Static-IP egress for Supabase functions** + IP allowlist on Cloud Run. Doable but adds infrastructure (Supabase Pro+ feature).

3. **Accept defense-in-depth** — keep `allUsers → run.invoker` but lock down the secret header check rigorously (constant-time compare, secret rotation policy, IP-based rate limiting on the service).

For the short term, recommendation is **option 3** — it matches the current architecture and the threat model is acceptable. Document that the `allUsers` binding is intentional and the secret header is the actual auth boundary.

For api-club-proxy, the same logic applies — it's invoked by `verify-utility` edge function via the proxy URL, not directly. Keep the binding, document the auth model.

For stamp-verification-service-prod: invoked by extraction-service-prod (cross-Cloud-Run). If both run in the same project under different SAs, you can use **service-to-service IAM**:
```bash
# Grant extraction-service-prod-sa permission to invoke stamp-verification-service-prod
gcloud run services add-iam-policy-binding stamp-verification-service-prod \
  --region=asia-south1 --project=secured-by-flent \
  --member="serviceAccount:extraction-service-prod-sa@secured-by-flent.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# Then remove allUsers
gcloud run services remove-iam-policy-binding stamp-verification-service-prod \
  --region=asia-south1 --project=secured-by-flent \
  --member="allUsers" --role="roles/run.invoker"
```

The invoking service must call with an identity token (`gcloud auth print-identity-token --audiences=<target-url>`). The `stamp-verification-service` source isn't in this repo, so this change requires coordination with whoever owns it.

### Step 5 — Drop `roles/editor` from default compute SA

After every service has its dedicated SA + verified working, the default compute SA can have `roles/editor` removed. This is the highest-impact cleanup but also highest-risk (might break something using the default SA we forgot about).

Check before removing:
```bash
# Find any compute resource using the default SA
gcloud compute instances list --format='value(name,serviceAccounts.email)' \
  --project=secured-by-flent | grep "150238445962-compute"

gcloud cloud-build builds list --project=secured-by-flent --format='value(serviceAccountEmail)' \
  --limit=20 | grep "150238445962-compute"
```

If clean, remove:
```bash
gcloud projects remove-iam-policy-binding secured-by-flent \
  --member="serviceAccount:150238445962-compute@developer.gserviceaccount.com" \
  --role="roles/editor"
```

## Re-audit script

To re-run this audit, save these commands to a script (e.g., `scripts/ci/audit-gcp-iam.sh`):

```bash
#!/usr/bin/env bash
PROJECT=secured-by-flent
REGION=asia-south1

echo "=== Service accounts on Cloud Run ==="
for svc in $(gcloud run services list --project=$PROJECT --region=$REGION --format='value(metadata.name)'); do
  sa=$(gcloud run services describe $svc --region=$REGION --project=$PROJECT \
       --format='value(spec.template.spec.serviceAccountName)')
  echo "$svc → $sa"
done

echo ""
echo "=== Project-wide SA roles ==="
gcloud projects get-iam-policy $PROJECT --flatten='bindings[].members' \
  --filter='bindings.role:(roles/editor OR roles/owner OR roles/iam.* OR roles/secretmanager.admin)' \
  --format='table(bindings.members,bindings.role)'

echo ""
echo "=== Public-invoker Cloud Run bindings (SHOULD BE EMPTY for internal services) ==="
for svc in $(gcloud run services list --project=$PROJECT --region=$REGION --format='value(metadata.name)'); do
  has_public=$(gcloud run services get-iam-policy $svc --region=$REGION --project=$PROJECT \
               --format='value(bindings)' 2>/dev/null | grep -c allUsers)
  if [ "$has_public" -gt 0 ]; then
    echo "🟥 $svc has allUsers binding"
  fi
done
```

Wire into CI as a weekly cron (Phase 5 follow-up).

## Status table

| Finding | Severity | Status | Owner action |
|---|---|---|---|
| Default compute SA used by all 5 services | 🟥 CRITICAL | Open | Phase 7a Step 1–3 (create dedicated SAs) |
| `roles/editor` on default compute SA | 🟥 CRITICAL | Open | Phase 7a Step 5 (remove after Step 3) |
| `allUsers → run.invoker` on prod services | 🟧 HIGH | Open | Phase 7a Step 4 (accept defense-in-depth or refactor) |
| Per-secret bindings working correctly | ✅ | Good | n/a |
| Dev locked down (no public invoker) | ✅ | Good | Apply same to prod once auth model is clarified |
