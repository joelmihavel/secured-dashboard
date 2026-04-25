# Data Residency Audit

> **Last reviewed:** 2026-04-25 (Phase 7d of cleanup plan)
>
> Indian fintech regulation context: RBI Master Direction on Digital Payment Security Controls + RBI Storage of Payment System Data circular (Apr 2018) + DPDP Act 2023 collectively imply payment + KYC data should reside and be processed in India. This audit checks where each component actually runs.

## Summary

| Component | Region | Data type | Compliance status |
|---|---|---|---|
| Supabase prod (`uowjtrzmszuaiokqxgir`) | `ap-south-1` (Mumbai) | All user data, KYC, payments, audit logs | ✅ India |
| Supabase dev branch (`zqlowjveyqiagnbmfwsb`) | `ap-south-1` (Mumbai, parented from prod) | Test data only | ✅ India |
| Cloud Run extraction-service-prod | `asia-south1` (Mumbai) | Rent agreement PDFs in transit | ✅ India (compute layer) |
| Cloud Run stamp-verification-service-prod | `asia-south1` (Mumbai) | Stamp certificate metadata | ✅ India |
| GCS bucket for rent agreements | Via Supabase Storage in `ap-south-1` | Rent agreement PDFs at rest | ✅ India |
| **Document AI processor** | `us` (United States) 🟥 | Rent agreement PDF text extraction | ❌ Out of region |
| **Vertex AI Gemini calls** | `global` endpoint 🟥 | Rent agreement extracted JSON + raw PDF (multimodal) | ❌ Out of region (potentially) |
| **External SHCIL e-Stamp** | India | Stamp certificate verification | ✅ Third-party in-region |
| **External Cashfree** | India | Payments + KYC | ✅ Third-party in-region |
| **External Twilio** | Global routing | OTP + WhatsApp | ⚠️ Limited PII (phone number only) |
| **External 2Captcha + ZenRows** | Global | SHCIL captcha solving | ⚠️ Image data — captcha only, no PII |

## Findings

### 🟥 Finding 1 — Document AI processor in `us` location

`cloud-run/extraction-service/src/config.ts` defaults `gcp.location = process.env.GCP_LOCATION ?? 'us'`. Confirmed on prod:

```bash
$ gcloud run services describe extraction-service-prod \
    --region=asia-south1 --project=secured-by-flent \
    --format='value(spec.template.spec.containers[0].env)' | grep GCP_LOCATION
{'name': 'GCP_LOCATION', 'value': 'us'}
```

The Document AI processor ID is `cc5734db2b80908b` in location `us`. Every rent agreement uploaded to prod goes through this US processor for OCR. Document AI's documented data handling for `us` region: the document and extracted data are processed and may be cached in US data centers for the duration of the request.

**Impact:** Rent agreements include PAN, bank account details, residential address, sometimes Aadhaar — all classified as sensitive personal data under DPDP. Processing this in the US potentially conflicts with:

- RBI Storage of Payment System Data circular (Apr 6, 2018) — payment system data must be stored only in India. Document AI doesn't *store* the data (it's request-scoped), but processing in US is a grey zone.
- DPDP Act 2023 cross-border data transfer provisions — currently India has not designated a "trusted countries" allowlist; transfer to non-allowlisted jurisdictions requires consent + safeguards.

**Remediation (provisioned as of 2026-04-25):**

A new `FORM_PARSER_PROCESSOR` was provisioned in `asia-south1` to mirror the current US processor:

| Attribute | Old (us) | New (asia-south1) |
|---|---|---|
| Processor ID | `cc5734db2b80908b` | `e427db2ce3a92621` |
| Display name | flent-rent-agreement-parser | flent-rent-agreement-parser-asia-south1 |
| Type | FORM_PARSER_PROCESSOR | same |
| Model version | pretrained-form-parser-v2.0-2022-11-10 | same |
| Endpoint | `https://us-documentai.googleapis.com/...` | `https://asia-south1-documentai.googleapis.com/...` |
| Created | 2025-12-30 | 2026-04-25 |

**Same model version on both** — extraction quality should be identical. The Mumbai processor exists but Cloud Run is NOT yet flipped to use it (regression-prevention principle: dev verification first).

To flip when ready (after dev smoke test):

```bash
# Step 1 — flip dev first
gcloud run services update extraction-service-dev \
  --region=asia-south1 --project=secured-by-flent \
  --update-env-vars GCP_PROCESSOR_ID=e427db2ce3a92621,GCP_LOCATION=asia-south1

# Step 2 — verify a real extraction completes against the new processor
# Trigger a test agreement upload via the dev branch + check
# extracted_rental_info row populates correctly

# Step 3 — flip prod after 24-48h dev soak
gcloud run services update extraction-service-prod \
  --region=asia-south1 --project=secured-by-flent \
  --update-env-vars GCP_PROCESSOR_ID=e427db2ce3a92621,GCP_LOCATION=asia-south1

# Step 4 — keep the us processor enabled for ~30d as rollback insurance
# Then disable it via:
# curl -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" \
#   "https://us-documentai.googleapis.com/v1/projects/secured-by-flent/locations/us/processors/cc5734db2b80908b:disable"
```

**Owner action required:** verify on dev, then flip prod env vars. ~30 min of work + 48h soak.

### 🟥 Finding 2 — Vertex AI Gemini calls use `global` endpoint

`cloud-run/extraction-service/src/services/gemini-vertex.ts` defaults `location: string = 'global'`. The `global` endpoint:

- Supports provisioned throughput SLAs (which we may or may not be using)
- Routes to the closest available region for inference
- Per Vertex AI docs: data may be processed in any of US, EU, or Asia regions

For multimodal PDF calls (which include the entire rent agreement as base64 input), this means the document — with all the same PAN/Aadhaar/bank info — flows through whichever region Vertex AI picks at request time.

**Impact:** Same as Finding 1, but harder to reason about because the region is non-deterministic.

**Remediation (partially done as of 2026-04-25 commit `c10facc7`):**

The `cloud-run/extraction-service` codebase now reads the Vertex location
from `config.vertex.location` (env var `VERTEX_AI_LOCATION`), defaulting
to `'global'` to preserve current behavior. To flip to `asia-south1`:

```bash
# Verify model availability in asia-south1 first:
gcloud ai models list --region=asia-south1 --project=flent-ai-project-2 \
  | grep -i gemini

# If gemini-3-flash-preview is listed, flip the env var:
gcloud run services update extraction-service-prod \
  --region=asia-south1 --project=secured-by-flent \
  --update-env-vars VERTEX_AI_LOCATION=asia-south1

# Smoke test with a real rent agreement extraction
# Verify in logs that '[gemini-vertex] using location=asia-south1'
# Watch for MODEL_NOT_AVAILABLE errors over 24h before flipping prod
```

If the model isn't in `asia-south1`, fall back to `asia-southeast1` (Singapore) — still extra-territorial but closer + better legal stance than `us`. Provisioned throughput SKU may not be available regionally — accept the throughput trade-off in exchange for residency.

**Owner action required:** verify model availability + flip env var. ~30 min.

### ⚠️ Finding 3 — Twilio messaging for OTP + WhatsApp

Twilio routes phone messages through their global infrastructure. The PII content is limited:
- OTP messages: phone number + 6-digit code
- WhatsApp messages: phone number + landlord invite link

No PAN, bank details, or rent amount is sent through Twilio. Phone numbers in India are sensitive but not "payment system data" per RBI's narrow definition.

**Remediation:** Generally accepted as in-compliance. Document the data-flow boundary in the privacy policy. No code change required.

### ⚠️ Finding 4 — 2Captcha + ZenRows for SHCIL bypass

`stamp-verification-service-{prod,dev}` send SHCIL portal captcha images (and later, the form payloads) to 2Captcha and ZenRows. These services are global / non-Indian.

The data sent:
- 2Captcha: SHCIL captcha image (no PII)
- ZenRows: HTTP request to SHCIL portal with stamp certificate number (the certificate number is public on the SHCIL portal anyway — it's the input to verification, not output)

**Remediation:** No PII at risk; no compliance issue.

### ✅ Finding 5 — Supabase + GCS storage in India

Both Supabase projects are in `ap-south-1` (Mumbai). The `rent-agreements` storage bucket is in the same region. All user data, KYC, payments, and audit logs reside in India.

`rent-agreements` PDFs at rest: Mumbai. ✅
Database rows: Mumbai. ✅
Realtime + Auth: Mumbai. ✅

**Remediation:** No action.

## Verification re-run

```bash
# Cloud Run env vars per service
for svc in extraction-service-prod extraction-service-dev \
           stamp-verification-service-prod stamp-verification-service-dev; do
  echo "--- $svc ---"
  gcloud run services describe $svc --region=asia-south1 --project=secured-by-flent \
    --format='value(spec.template.spec.containers[0].env)' \
    | tr ';' '\n' | grep -E '(LOCATION|VERTEX|REGION)'
done

# Vertex AI hardcoded location in code
grep -rIn -E "location.*=.*['\"](?:global|us|us-)" cloud-run/extraction-service/src/

# Supabase project region
supabase projects list | grep -E '(uowjtrzm|zqlowj)'
```

## Status table

| Finding | Severity | Status | Owner action |
|---|---|---|---|
| Document AI in `us` location | 🟥 CRITICAL | Open | Provision processor in `asia-south1`, update env vars |
| Vertex AI in `global` endpoint | 🟥 CRITICAL | Open | Pin to `asia-south1`, verify model availability |
| Twilio routes globally | ⚠️ ACCEPTABLE | Documented | No action — accept in privacy policy |
| 2Captcha/ZenRows global | ⚠️ ACCEPTABLE | Documented | No action — no PII at risk |
| Supabase + GCS in Mumbai | ✅ OK | n/a | n/a |

## Compliance posture

This audit is **not** a legal opinion. It's a technical inventory of where data flows. For the regulatory question — "are we DPDP / RBI compliant?" — engage qualified counsel. The findings above describe what would change to **strengthen** the compliance posture, not what the law strictly requires.

If your DPO / counsel determines the `us`-based DocAI processing is acceptable under DPDP's safeguards provision (with an SCC-equivalent contract with Google as data processor), then Finding 1 may be downgradable to ACCEPTABLE. Same for Vertex AI's `global` endpoint.

For now, the recommendation is to fix Findings 1 and 2 because the cost (~3 hours of work) is much smaller than the cost of being wrong on either direction.

## Re-audit cadence

Recommend running the verification commands above quarterly + on every Cloud Run env change. Wire a weekly `data-residency-check.yml` workflow that fails if `GCP_LOCATION=us` or any Vertex call is unpinned to a region (Phase 5 follow-up).
