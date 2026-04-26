# Upload Agreement Infrastructure

Complete documentation of the agreement upload, AI extraction, and recovery pipeline.

## Architecture Overview

```
Client (React Native)
  |
  | 1. upload-document (POST) → signed URL + extraction record
  | 2. PUT file to signed URL (Supabase Storage)
  | 3. process-document (POST, fire-and-forget)
  |
  v
Supabase Edge Functions
  |
  |-- process-document ──────── GCP Document AI (OCR)
  |       |                          |
  |       |                    Vertex AI Gemini (extraction)
  |       |                    aiplatform.googleapis.com
  |       |                          |
  |       |-- on Vertex AI failure --+
  |       |                          |
  |       v                          v
  |  process-document-fallback   (if Vertex AI succeeds)
  |       |                      writes to DB → done
  |       |
  |       | Gemini API key endpoint
  |       | generativelanguage.googleapis.com
  |       |
  |       v
  |    writes to DB → done
  |
  |-- extraction-recovery (cron, every 30 min)
  |       |
  |       |-- finds stuck "processing" (>15 min) → marks failed
  |       |-- finds stuck "pending" with document (>5 min) → marks failed
  |       |     → invokes process-document-fallback
  |       |-- finds completed extractions not on waitlist → auto-advances user
  |
  v
Database (extracted_rental_info)
  |
  | useExtractionStatus (client polling, 3s interval)
  |
  v
Client UI updates
```

## Edge Functions

### 1. `upload-document`
**Trigger**: Client POST after user picks a file
**Auth**: User JWT required

Creates the extraction record (`pending` status), generates a signed upload URL for Supabase Storage, creates/updates the waitlist entry.

Returns: `{ uploadUrl, extractionId, documentPath }`

### 2. `process-document`
**Trigger**: Client fire-and-forget POST after file upload completes
**Auth**: User JWT required

The primary extraction pipeline:
1. Sets `extraction_status = 'processing'` with checkpoint tracking
2. Downloads PDF from Supabase Storage
3. Calls **GCP Document AI** for OCR (`us-documentai.googleapis.com`)
4. If OCR text >= 100 chars: calls **Vertex AI Gemini** (`aiplatform.googleapis.com/...global...`)
5. If OCR text < 100 chars: sends raw PDF to Vertex AI Gemini as multimodal input
6. On Vertex AI failure: **delegates to `process-document-fallback`** (fire-and-forget)
7. On success: merges results, evaluates extraction, writes to DB

**Checkpoint tracking**: Before each major step, writes `{ step, started_at }` to `gemini_raw_response`. Steps: `starting` → `downloading` → `doc_ai_and_gemini` → `doc_ai` → `gemini_vertex_ai` → `delegating_to_fallback`

**Wall clock limit**: 400s (Supabase Pro). If the function is killed, the last checkpoint survives in DB for debugging.

### 3. `process-document-fallback` (NEW)
**Trigger**: Invoked by `process-document` on Vertex AI failure, or by `extraction-recovery` cron
**Auth**: service_role JWT only (not called by client)

Independent fallback using a **different Gemini endpoint** (`generativelanguage.googleapis.com`). Runs in its own container with its own network route — completely independent of the Vertex AI path.

Flow:
1. Fetches extraction record
2. Checks for cached OCR text in `raw_extraction_data.document.text`
3. If text >= 100 chars: text-based extraction via Gemini API key
4. If text < 100 chars: downloads PDF, sends as multimodal via Gemini API key
5. Evaluates and writes results to DB

**Why separate**: Supabase edge function containers can lose network connectivity to specific Google endpoints (`aiplatform.googleapis.com`) while other endpoints (`generativelanguage.googleapis.com`) remain reachable. Separate function = separate container = separate network route.

### 4. `reprocess-extractions`
**Trigger**: Manual admin invocation or scheduled
**Auth**: service_role or admin key

Batch reprocessor for failed extractions. Tries Vertex AI first, API key fallback. Used for manual recovery of multiple extractions.

### 5. `extraction-recovery` (cron)
**Trigger**: Supabase cron, every 30 minutes
**Auth**: service_role

Automated recovery for stuck users:

**Step 1.5** — Marks stale `processing` extractions as `failed` (stuck > 15 min). Includes last checkpoint step in the error message.

**Step 1.6** — Finds `pending` extractions with `document_storage_path` (file uploaded but `process-document` never called). Marks as `failed` and invokes `process-document-fallback` for each.

**Step 2** — For users with completed extractions stuck at `signed_up`/`agreement_confirmed`, auto-creates tenancy + waitlist entry and advances to `waitlisted`.

## Client-Side Flow

### Upload Flow (`useAgreement.ts`)

```
1. requestUploadUrl(fileName, mimeType, fileSize)
   → upload-document edge function
   → returns { uploadUrl, extractionId, documentPath }

2. uploadFileToSignedUrl(uploadUrl, fileUri, mimeType)
   → PUT to signed URL (direct storage upload)
   → retries 2x on 5xx/network errors

3. processDocument(extractionId, documentPath)  [fire-and-forget]
   → process-document edge function
   → .then() checks returned errors (NOT just .catch())
   → on error: useUploadStore.setError(...)
```

**Key fix**: `processDocument` returns `{ error }` on auth failure (doesn't throw). The `.then()` handler checks the return value — without this, auth errors during step 3 are silently swallowed.

### Upload Store (`stores/upload.ts`)

Persisted Zustand store in SecureStore. Survives app kills.

- `ownerId`: Set during `startUpload(fileName, userId)`. Enables `validateOwner()` to detect cross-session stale state.
- `uploadPhase`: Tracks client-side progress (`idle` → `requesting_url` → `uploading_file` → `processing` → `server_processing` → `completed`)
- Staleness: Non-completed uploads go stale after 10 min. Completed after 24 hours.

### Status Tracking (`useExtractionStatus.ts`)

Three mechanisms for reliable status detection:
1. **React Query polling** — 3s interval during processing (primary)
2. **Supabase Realtime** — WebSocket for instant updates (accelerator)
3. **AppState listener** — refetch on app resume (recovery)

Client-side staleness: `pending` > 3 min or `processing` > 12 min → marks as failed locally.

## Database Schema

### `extracted_rental_info` (key columns for this flow)

| Column | Purpose |
|--------|---------|
| `extraction_status` | `pending` → `processing` → `completed` / `failed` |
| `contract_status` | `uploading` → `user_review` / `manual_review` / `invalid_document` |
| `document_storage_path` | Path in `rent-agreements` storage bucket |
| `gemini_raw_response` | During processing: checkpoint `{ step, started_at }`. On completion: Gemini output. |
| `extraction_method` | `gcp_doc_ai` / `combined` (DocAI + Gemini) |
| `extraction_error` | Error message when `failed` |
| `raw_extraction_data` | Document AI OCR output (cached for fallback reuse) |

## Failure Modes & Recovery

### 1. Client auth dies between upload and process-document
**Symptom**: `extraction_status = 'pending'`, `document_storage_path` set
**Recovery**: `extraction-recovery` Step 1.6 (finds pending > 5 min with document) → invokes fallback

### 2. Vertex AI endpoint unreachable from Supabase
**Symptom**: `extraction_status = 'processing'`, `gemini_raw_response.step = 'gemini_vertex_ai'`, stuck > 15 min
**Recovery**: `process-document` delegates to `process-document-fallback` (API key endpoint). If function killed before delegation: `extraction-recovery` Step 1.5 marks as failed, user can retry.

### 3. Supabase edge function killed (wall clock 400s)
**Symptom**: `extraction_status = 'processing'`, no further DB updates
**Recovery**: `extraction-recovery` Step 1.5 marks as failed after 15 min. Checkpoint in `gemini_raw_response` shows where it died.

### 4. Gemini returns empty/invalid response
**Symptom**: `extraction_status = 'failed'`, `extraction_error` has details
**Recovery**: User retries upload, or admin triggers `reprocess-extractions`

### 5. PDF too large for multimodal (>7MB)
**Symptom**: `extraction_error = 'PDF too large for multimodal'`
**Recovery**: User uploads a smaller file. Document AI OCR path still works for large files with readable text.

## GCP Services

| Service | Endpoint | Project | Auth |
|---------|----------|---------|------|
| Document AI OCR | `us-documentai.googleapis.com` | `secured-by-flent` | GCP SA (`GCP_DOCUMENT_AI_CREDENTIALS`) |
| Vertex AI Gemini | `aiplatform.googleapis.com` (global) | `flent-ai-project-2` | GCP SA (`VERTEX_AI_CREDENTIALS`) |
| Gemini API (fallback) | `generativelanguage.googleapis.com` | N/A (API key) | `GEMINI_API_KEY_SECURED` |

## Environment Variables (Supabase Secrets)

| Variable | Used by | Purpose |
|----------|---------|---------|
| `GCP_DOCUMENT_AI_CREDENTIALS` | process-document, extraction-service | Document AI service account JSON |
| `GCP_PROJECT_ID` | process-document, extraction-service | Document AI project (`secured-by-flent`) |
| `GCP_PROCESSOR_ID` | process-document, extraction-service | Document AI processor ID. **Phase 7d (2026-04-26)**: flipped from US (`cc5734db2b80908b`) to asia-south1 (`e427db2ce3a92621`) for DPDP/RBI residency. Old US processor stays enabled ~30d as rollback insurance. |
| `GCP_LOCATION` | process-document, extraction-service | Document AI region. **Phase 7d**: now `asia-south1` (was `us`). Code default is still `'us'` as rollback fallback in `cloud-run/extraction-service/src/config.ts`. |
| `VERTEX_AI_CREDENTIALS` | process-document, reprocess, extraction-service | Vertex AI service account JSON |
| `VERTEX_AI_PROJECT_ID` | process-document, reprocess, extraction-service | Vertex AI project (`flent-ai-project-2`) |
| `VERTEX_AI_LOCATION` | extraction-service | Vertex AI endpoint region. Default `global` (project decision 2026-04-26 — see `docs/infrastructure/data-residency.md` Finding 2 ACCEPTED). |
| `GEMINI_API_KEY_SECURED` | fallback, reprocess | Gemini API key for `generativelanguage.googleapis.com` |

**Cloud Run runtime auth (Phase 7a, 2026-04-26):** the extraction-service Cloud Run instances run under per-service SAs (`extraction-service-prod-sa`, `extraction-service-dev-sa`), NOT the default Compute Engine SA. The per-service SAs have least-privilege role bindings — `documentai.apiUser`, scoped `secretmanager.secretAccessor` on the credential secrets, cross-project `aiplatform.user` on `flent-ai-project-2`, plus `logging.logWriter` and `monitoring.metricWriter`. See `docs/infrastructure/gcp-iam.md` for the full role inventory.
