# Audit: Error Handling & Debug Data Persistence in `process-document`

**File**: `supabase/functions/process-document/index.ts`  
**Date**: 2026-04-02

---

## 1. Error Flow Diagram (Text)

```
processWithDocumentAI() called at line ~430
│
├── [L698] getGCPAccessToken(docAI creds)
│   └── THROW (L925): "Failed to get GCP access token: ..."
│       → No data collected yet → outer catch (L642)
│       → Persists: extraction_status="failed", extraction_error=msg
│       → Lost: nothing (no data existed)
│
├── [L706-737] fetch Document AI
│   ├── THROW (L734): AbortError → "Document AI timed out after 300s"
│   │   → No doc AI response yet → outer catch (L642)
│   │   → Persists: extraction_status="failed", extraction_error=msg
│   │   → Lost: nothing (no data existed)
│   │
│   ├── THROW (L736): re-thrown network error
│   │   → Same as above
│   │
│   └── THROW (L742): "Document AI failed: ${errorText}"
│       → HTTP error → outer catch (L642)
│       → Persists: extraction_status="failed", extraction_error=msg
│       → Lost: errorText is embedded in message (acceptable)
│
├── [L748-749] docAIResult parsed, documentText extracted
├── [L751] extractedData = parseDocumentAIResponse(docAIResult)
│          ↳ extractedData.raw_doc_ai_data = docAIResult  (in memory)
│
├── [L753-762] geminiDebug object created (in memory)
│
├── [L766] if documentText.length > 100
│   │
│   ├── [L778] Vertex AI path (inside try/catch — errors caught locally)
│   │   ├── getGCPAccessToken(vertex creds)     → caught, sets geminiDebug.vertex_ai_error
│   │   ├── extractWithVertexAIGemini()          → caught, sets geminiDebug.vertex_ai_error
│   │   │   Errors inside extractWithVertexAIGemini (all caught at L795):
│   │   │   - L1087: AbortError timeout
│   │   │   - L1089: re-thrown network error
│   │   │   - L1096: HTTP error
│   │   │   - L1109: empty response
│   │   │   - L1125/1128: malformed JSON
│   │   │   - L1132: empty JSON
│   │   │   - L1139: no JSON found
│   │   └── Retries (up to 2x on "No JSON found" / "empty response")
│   │
│   ├── [L826] API key Gemini fallback (inside try/catch — errors caught locally)
│   │   ├── verifyWithGemini()                   → caught, sets geminiDebug.api_key_error
│   │   │   Errors inside verifyWithGemini (all caught at L856):
│   │   │   - L1249: AbortError timeout
│   │   │   - L1251: re-thrown network error
│   │   │   - L1260: HTTP error
│   │   │   - L1273: empty response
│   │   │   - L1289/1292: malformed JSON
│   │   │   - L1298: empty JSON
│   │   │   - L1303: no JSON found
│   │   │   - L1306: re-thrown
│   │   └── Retries (up to 2x on "No JSON found" / "empty response")
│   │
│   ├── [L873] if geminiResult has keys:
│   │   ├── Document classification check (is_rental_agreement === false)
│   │   │   └── RETURN extractedData (with gemini_debug attached at L882)
│   │   └── mergeGeminiResults → RETURN via normal path
│   │
│   └── [L891] else if gemini attempted but no result:
│       ├── extractedData.extraction_method = 'gcp_doc_ai'
│       └── if extractedData.fields_extracted === 0:
│           └── ★ THROW (L896): "Both Gemini and Document AI failed..."
│               → outer catch (L642)
│               → Persists: extraction_status="failed", extraction_error=msg
│               → ★★★ LOST: geminiDebug, raw_doc_ai_data, documentText ★★★
│
├── [L902] (extractedData as any).gemini_debug = geminiDebug  ← ONLY reached if no throw
└── RETURN extractedData


OUTER CATCH BLOCK (L642-675):
├── if extraction_id && !completedExtractionPersisted:
│   └── updateExtractionStatus({
│         extraction_status: "failed",
│         extraction_error: errorMessage    ← string only
│       })
│       ★ NO debug data persisted ★
│
└── if extraction_id && completedExtractionPersisted:
    └── updateExtractionStatus({
          extraction_error: errorMessage    ← string only, status not changed
        })
```

---

## 2. Table: Error Scenario → Fields Persisted vs Fields Lost

| # | Error Scenario | Line | Fields Persisted to DB | Fields LOST (only in logs/memory) |
|---|---|---|---|---|
| 1 | **GCP access token failure (Doc AI)** | L925→L642 | `extraction_status="failed"`, `extraction_error` | Nothing meaningful (no data collected yet) |
| 2 | **Document AI timeout (AbortError)** | L734→L642 | `extraction_status="failed"`, `extraction_error` | Nothing meaningful (no data collected yet) |
| 3 | **Document AI network error** | L736→L642 | `extraction_status="failed"`, `extraction_error` | Nothing meaningful |
| 4 | **Document AI HTTP error** | L742→L642 | `extraction_status="failed"`, `extraction_error` | Doc AI error response body (embedded in error msg, acceptable) |
| 5 | **★ Both Gemini + Doc AI extract 0 fields** | L896→L642 | `extraction_status="failed"`, `extraction_error` (string) | **`geminiDebug`** (which APIs tried, what errors occurred), **`raw_doc_ai_data`** (full Doc AI response with OCR text), **`documentText`** (OCR text content), **`extractedData`** (partial extraction fields) |
| 6 | **Document download failure** | L363→L642 | `extraction_status="failed"`, `extraction_error` | Nothing meaningful |
| 7 | **DB insert failure** | L557→L642 | `extraction_status="failed"`, `extraction_error` | All `extractedData` fields that were about to be saved |
| 8 | **Post-persistence failure** (finalize/waitlist) | thrown after L560→L642 | `extraction_error` appended (status stays "completed") | Nothing lost — extraction data already persisted at L516-554 |

### Scenario #5 is the critical bug — detailed breakdown:

When the throw at L896 fires:
- `extractedData` exists with `raw_doc_ai_data` = full Document AI response (including OCR text)
- `geminiDebug` exists as a local variable with:
  - `text_length` — length of OCR text
  - `gemini_attempted: true`
  - `vertex_ai_attempted` / `vertex_ai_error` — what happened with Vertex AI
  - `api_key_attempted` / `api_key_error` — what happened with API key fallback
  - Retry information
- The throw happens at L896, **BEFORE** line L902 where `gemini_debug` is attached to `extractedData`
- Even if `gemini_debug` were attached, the catch block at L642 **does not read or persist** any data from `extractedData` — it only persists the error message string

**Result**: An operator investigating a "Both Gemini and Document AI failed" error has NO way to see:
- What OCR text was extracted (was it garbage? was it a non-rental document?)
- Which Gemini paths were tried and what specific errors each returned
- Whether the document was too short for Gemini (<100 chars)

---

## 3. Specific Code Locations Where Debug Data is Lost

### Location 1: Throw at L896 bypasses gemini_debug attachment
```
File: index.ts, Line 896
Code: throw new Error("Both Gemini and Document AI failed to extract any fields from the document");
```
The `geminiDebug` object is only attached at L902, which is unreachable when this throw fires.

### Location 2: Catch block at L642-675 only persists error string
```
File: index.ts, Lines 648-650
Code:
  const { error: statusUpdateError } = await updateExtractionStatus(supabase, extraction_id, {
    extraction_status: "failed",
    extraction_error: errorMessage,   // ← just a string, no structured debug data
  });
```
No `raw_extraction_data`, `gemini_raw_response`, `extraction_method`, or any other debug column is set.

### Location 3: The `extractedData` object (with `raw_doc_ai_data`) is never referenced in catch
The catch block has no access to `extractedData` (it's scoped inside the try block, created at L430 as the return value of `processWithDocumentAI`). Even if it could be referenced, the catch block doesn't use it.

---

## 4. `gemini_debug` Object — Stored on Failure?

**Answer: NO.**

- `gemini_debug` is a local variable inside `processWithDocumentAI()` (created at L753)
- It is attached to `extractedData` at only two places:
  - L882: Inside the `is_rental_agreement === false` branch (then returned normally — not a throw path)
  - L902: After the if/else block (only reached if no throw at L896)
- When the throw at L896 fires, `gemini_debug` is **never attached** to `extractedData`
- The outer catch block has **no access** to `gemini_debug` at all
- The only trace is `console.log` at L868: `"[process-document] Gemini debug: " + JSON.stringify(geminiDebug)` — this goes to edge function logs only, not the DB

---

## 5. `raw_doc_ai_data` — Stored on Failure?

**Answer: NO.**

- `raw_doc_ai_data` is set inside `parseDocumentAIResponse()` (L751) as `raw_doc_ai_data: response`
- It lives on the `extractedData` object returned by `processWithDocumentAI()`
- On the **success path** (L545): persisted as `raw_extraction_data: slimDocAiData(extractedData.raw_doc_ai_data)`
- On the **failure path** (L896 throw → L642 catch): NOT persisted — catch block doesn't reference `extractedData`
- For errors that occur BEFORE Document AI completes (L734 timeout, L742 HTTP error): `extractedData` doesn't exist yet, so nothing to persist

---

## 6. `updateExtractionStatus` — Supports Arbitrary Debug Fields?

**Answer: YES** — but the catch block doesn't use this capability.

```typescript
// Line 1852
async function updateExtractionStatus(
  supabase: any,
  extractionId: string,
  updates: Record<string, any>     // ← accepts ANY fields
): Promise<{ error: any }> {
  const { error } = await supabase
    .from("extracted_rental_info")
    .update(updates)                // ← passes them through to Supabase
    .eq("id", extractionId);
  ...
}
```

The helper accepts `Record<string, any>`, so it could easily accept fields like `gemini_raw_response`, `raw_extraction_data`, `extraction_method`, etc. The catch block at L648-650 simply doesn't pass them.

---

## 7. `completedExtractionPersisted` Flag — Race Conditions?

**Answer: No race condition, but there is a behavioral nuance worth documenting.**

### Flow:
1. L245: `let completedExtractionPersisted = false;`
2. L516-554: Supabase `.update()` persists all extraction data
3. L557: If update throws → catch (flag still `false`) → sets status to "failed" ✓
4. L560: `completedExtractionPersisted = true;`
5. L567-595: Geocoding (wrapped in try/catch — can't throw to outer)
6. L613-625: `finalizeExtractionForOnboarding()` or `updateWaitlistEntries()` — **CAN throw**

### Behavioral nuance:
If `finalizeExtractionForOnboarding()` throws after L560:
- `completedExtractionPersisted` is `true`
- Catch block at L663-666 runs: sets `extraction_error` but does NOT change `extraction_status`
- So extraction_status remains "completed" while extraction_error has a finalization error message

**This is correct behavior** — the extraction itself succeeded; the error is in a downstream step (onboarding/waitlist). The extraction data is safely persisted.

### No actual race condition:
- The function is single-threaded (async/await, no concurrent mutations)
- The flag is set synchronously after the await completes
- There's no parallel branch that could read the flag before it's set

---

## 8. Recommended Fix Approach

### Fix 1: Persist debug data in the catch block (HIGH PRIORITY)

Modify the catch block at L642-675 to persist available debug data. Since `extractedData` is scoped inside `processWithDocumentAI`, the approach is to either:

**Option A (Minimal — augment error with structured data):**
Wrap the throw at L896 to include debug info in a custom error, then parse it in catch:

```typescript
// In processWithDocumentAI, before throw at L896:
class ExtractionError extends Error {
  debugData?: Record<string, any>;
  constructor(message: string, debugData?: Record<string, any>) {
    super(message);
    this.name = 'ExtractionError';
    this.debugData = debugData;
  }
}

// At L896:
throw new ExtractionError(
  "Both Gemini and Document AI failed to extract any fields from the document",
  {
    gemini_debug: geminiDebug,
    raw_doc_ai_data: slimDocAiData(extractedData.raw_doc_ai_data),
    extraction_method: extractedData.extraction_method,
    document_text_length: documentText.length,
  }
);

// In catch block at L642:
const debugData = (error instanceof ExtractionError) ? error.debugData : undefined;
if (extraction_id && !completedExtractionPersisted) {
  await updateExtractionStatus(supabase, extraction_id, {
    extraction_status: "failed",
    extraction_error: errorMessage,
    ...(debugData?.gemini_debug && { gemini_raw_response: debugData.gemini_debug }),
    ...(debugData?.raw_doc_ai_data && { raw_extraction_data: debugData.raw_doc_ai_data }),
    ...(debugData?.extraction_method && { extraction_method: debugData.extraction_method }),
  });
}
```

**Option B (Broader — hoist variables to outer scope):**
Declare `extractedData` and `geminiDebug`-equivalent variables in the outer try scope, populate them via the processing function (e.g., pass a mutable context object), and reference them in catch.

### Fix 2: Attach gemini_debug BEFORE the throw (LOW EFFORT)

Move line L902 before the throw at L896:

```typescript
// Line ~891 (before the throw):
} else if (geminiDebug.gemini_attempted && !geminiResult) {
  console.warn("[process-document] WARNING: All Gemini extraction paths failed...");
  extractedData.extraction_method = 'gcp_doc_ai';
  (extractedData as any).gemini_debug = geminiDebug;  // ← ADD HERE
  if (extractedData.fields_extracted === 0) {
    throw new Error("Both Gemini and Document AI failed...");
  }
}
```

This alone doesn't fix the problem (catch block still doesn't persist it), but it ensures the data structure is consistent for any future fix.

### Fix 3: Apply the same pattern to ALL throw paths inside processWithDocumentAI

For throws after Document AI has responded (L896), include debug data. For throws before Document AI (L734, L742, L925), there's no meaningful debug data to persist — the error message is sufficient.

### Summary of recommended changes:
1. Create `ExtractionError` class with `debugData` field
2. Use it for the L896 throw (and potentially others that have debug context)
3. Update catch block at L642 to check for `ExtractionError` and persist `debugData` fields
4. Move `gemini_debug` attachment (L902) to before the throw block (L891)
