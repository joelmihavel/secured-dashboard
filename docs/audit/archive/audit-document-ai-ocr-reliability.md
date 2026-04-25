# Document AI OCR Reliability Audit

**Date:** 2026-04-02  
**Scope:** `supabase/functions/process-document/index.ts`  
**Target:** 4 recent extraction failures  

---

## 1. Document AI Processing Flow

```
PDF Upload (storage)
       │
       ▼
Download from Supabase Storage
       │
       ▼
arrayBufferToBase64(arrayBuffer)  ← chunked (32KB) to avoid stack overflow
       │
       ▼
┌──────────────────────────────────────────────┐
│  GCP Document AI (us-documentai.googleapis)  │
│  POST /{project}/processors/{id}:process     │
│  Timeout: 300s (AbortController)             │
│  processOptions.fromStart: 30                │
│  ocrConfig.premiumFeatures: false            │
└──────────────────────────────────────────────┘
       │
       ├── Error (network/abort) → throw (caught by outer catch → "failed")
       ├── HTTP !ok → throw with error body
       │
       ▼  HTTP 200 OK
docAIResult.document?.text || ""  →  documentText
parseDocumentAIResponse(docAIResult) → extractedData (from entities)
       │
       ├── documentText.length ≤ 100 → SKIP Gemini, return extractedData as-is
       │
       ▼  documentText.length > 100
┌──────────────────────────────────────────────┐
│  Gemini Extraction (Vertex AI → API key)     │
│  Sends documentText.substring(0, 50000)      │
│  Timeout: 300s each                          │
│  Up to 2 retries on "No JSON found"          │
└──────────────────────────────────────────────┘
       │
       ├── geminiResult OK → mergeGeminiResults → return
       ├── geminiResult null + fields_extracted > 0 → return (Doc AI only)
       ├── geminiResult null + fields_extracted === 0 → THROW ERROR ★
       │       ↑ THIS IS THE FAILURE PATH FOR ALL 4 DOCUMENTS
       │
       ▼
"Both Gemini and Document AI failed to extract any fields"
```

---

## 2. The 4 Failed Documents

| Extraction ID | File Size | Upload Time | Error |
|---|---|---|---|
| `f05c24c6-...` | **1,225 KB** (1.2 MB) | 10:24:35 UTC | Both Gemini and Document AI failed |
| `e466d7aa-...` | **6,009 KB** (6 MB) | 15:17:05 UTC | Both Gemini and Document AI failed |
| `add9d66d-...` | **514 KB** | 15:31:37 UTC | Both Gemini and Document AI failed |
| `aba497fb-...` | **416 KB** | 15:38:10 UTC | Both Gemini and Document AI failed |

**Key observations:**
- All 4 files **exist** in Supabase Storage with valid sizes and `application/pdf` MIME type
- File sizes are normal (416 KB – 6 MB), not exceptionally large
- All have `extraction_method: null`, `raw_extraction_data: null`, `gemini_raw_response: null` — **diagnostic data was NOT persisted**
- 2 of the 4 failures are from the **same user** (`611d1b43`) who retried
- None of these 3 users have ANY successful extraction ever (0 successes)
- All successes in the same time window used `extraction_method: 'combined'` with 15–24 fields

---

## 3. Failure Scenarios Table

| # | Scenario | What Happens | Impact | Severity |
|---|---|---|---|---|
| **F1** | Doc AI returns 200 but `document.text = ""` (empty) | `documentText = ""`, length 0 → skips Gemini entirely. `parseDocumentAIResponse` returns 0 entities → `fields_extracted = 0`. Function returns successfully with 0 fields → **`extraction_status = "extraction_failed"`** (line 553) | Silent failure — no error thrown but extraction has 0 fields | **HIGH** |
| **F2** | Doc AI returns 200, text exists (>100 chars), but 0 entities AND Gemini fails | Gemini attempted → both Vertex AI & API key fail → `throw "Both Gemini and Document AI failed"` → **diagnostic data (gemini_debug, raw_doc_ai) lost** | Undiagnosable — no way to see what Document AI returned or why Gemini failed | **CRITICAL** |
| **F3** | Doc AI returns 200, text is 1–100 chars (very short) | `documentText.length ≤ 100` → Gemini skipped. 0 entities from parseDocumentAIResponse → returns with `fields_extracted = 0` → `extraction_status = "extraction_failed"` | Silent failure; no error, no Gemini attempt | **MEDIUM** |
| **F4** | `processOptions.fromStart: 30` doesn't limit pages | Document AI rejects docs with >15 pages (non-imageless) or >30 pages (imageless). Error: `PAGE_LIMIT_EXCEEDED` | 2 failures in past 30 days from page limit (18pp and 94pp docs) | **HIGH** |
| **F5** | PDF is password-protected or corrupted | No explicit handling. Document AI likely returns 400 error → caught by `!docAIResponse.ok` check → thrown as generic error | Reasonable error path but no user-friendly message | **LOW** |
| **F6** | `document.text` is `null` vs `undefined` vs `""` | `docAIResult.document?.text || ""` handles all three → coerces to `""` | ✅ Correctly handled | — |
| **F7** | Very large file base64 conversion | `arrayBufferToBase64` uses 32KB chunks → handles large files without stack overflow | ✅ Correctly handled | — |
| **F8** | 300s timeout for Document AI | Sufficient for normal docs. 6MB PDF with 30 pages should process in <60s. The 94-page doc would have timed out if not for page limit rejection first | Adequate for ≤30 pages | **LOW** |
| **F9** | Scanned PDF (images, no selectable text) | Document AI OCR **will** extract text from images — this is its core purpose. OCR processor handles scanned docs well | ✅ Handled by OCR | — |
| **F10** | Statement timeout on DB update after successful extraction | "Failed to store extracted data: canceling statement due to statement timeout" — 3 failures | Extraction worked but DB write failed — data completely lost | **HIGH** |

---

## 4. Root Cause Analysis for the 4 Failures

The exact error for all 4 is: **"Both Gemini and Document AI failed to extract any fields from the document"**

This error is thrown at **line ~895** when:
1. `documentText.length > 100` ✅ (Document AI OCR extracted text)
2. Gemini was attempted but returned `null` (both Vertex AI & API key failed)
3. `parseDocumentAIResponse` found 0 entities (`fields_extracted === 0`)

**Most likely root causes (in order of probability):**

### Cause A: Gemini Safety Filter / Content Rejection (HIGH probability)
- Documents containing PII (names, addresses, financial info) can trigger Gemini safety filters
- The code already has retry logic for "No JSON found" and "empty response" — but safety filter blocks (`finishReason: "SAFETY"`) do NOT trigger retries
- If `finishReason` is `SAFETY`, the code proceeds to `textContent = ""` → throws "empty response"
- But the retry only triggers on `"No JSON found"` or `"empty response"` in the error message

### Cause B: Non-Rental Documents (MEDIUM probability)
- The documents could be non-rental agreements (bank statements, ID cards, etc.)
- But if Gemini fails entirely, there's no `is_rental_agreement: false` classification
- The document type goes undetected

### Cause C: Document AI OCR returning garbage text (LOW probability)
- For scanned/photo PDFs with poor quality, OCR might extract garbled text
- Text > 100 chars triggers Gemini, but Gemini can't parse it → fails

---

## 5. Critical Diagnostic Gap (BUG)

**When `processWithDocumentAI()` throws an error, ALL diagnostic data is lost.**

The throw at line ~895:
```typescript
throw new Error("Both Gemini and Document AI failed to extract any fields from the document");
```

This is caught by the outer `catch` block (line ~640), which only saves:
```typescript
await updateExtractionStatus(supabase, extraction_id, {
  extraction_status: "failed",
  extraction_error: errorMessage,  // ← only the string
});
```

**Lost data:** `gemini_debug` (has text_length, which Gemini path failed, error messages), `raw_doc_ai_data` (has the full Document AI response), `documentText` (the actual OCR output).

For the 4 failures, we can confirm this: `raw_extraction_data: null` and `gemini_raw_response: null`.

---

## 6. `processOptions.fromStart: 30` Issue

The code sets:
```typescript
processOptions: {
  ocrConfig: { premiumFeatures: { computeStyleInfo: false } },
  fromStart: 30,
}
```

**Problems identified from production errors:**
1. A document with **18 pages** hit: `"Document pages in non-imageless mode exceed the limit: 15 got 18"` — meaning `fromStart: 30` did NOT limit to 15 pages, and the processor's default mode only supports 15 pages
2. A document with **94 pages** hit: `"Document pages exceed the limit: 30 got 94"` — meaning `fromStart: 30` was completely ignored

**Root cause:** The `fromStart` parameter in `processOptions` may only specify which pages to *select*, not impose a hard cap. The processor's own page limit (15 for non-imageless, 30 for imageless) still applies. If the PDF has more pages than the processor allows, it rejects the entire request — it doesn't auto-truncate.

---

## 7. Assessment: Is Document AI Contributing to the 4 Failures?

**Verdict: Document AI OCR itself is likely NOT the primary cause.**

Evidence:
- File sizes (416KB–6MB) are normal and within Document AI's capabilities
- Document AI handles scanned PDFs well (OCR is its core function)
- The error path (`fields_extracted === 0` + Gemini null) means OCR likely DID work (text > 100 chars), but Gemini extraction subsequently failed
- `parseDocumentAIResponse` returning 0 entities is **expected behavior** — the processor is likely a general OCR processor (not a specialized form parser), so `document.entities` is empty. All real extraction depends on Gemini receiving the raw text

**The failure chain is: Document AI OCR ✅ → Gemini extraction ❌ → 0 fields → throw error**

---

## 8. Overall Failure Rates (Last 30 Days)

| Status | Count | Percentage |
|---|---|---|
| completed | 140 | 78.7% |
| failed | 27 | 15.2% |
| extraction_failed | 8 | 4.5% |
| pending (stuck) | 3 | 1.7% |

**Error breakdown for "failed" (27 total):**

| Error | Count | Category |
|---|---|---|
| null (no error saved) | 5 | Unknown |
| Superseded by re-upload | 4 | User action |
| **Both Gemini and Document AI failed** | **4** | **OCR+AI failure** |
| Statement timeout on DB write | 3 | Infrastructure |
| Abandoned by user (re-upload) | 3 | User action |
| Superseded by re-processing | 3 | User action |
| Processing timed out (120s) | 2 | Timeout |
| Document AI PAGE_LIMIT_EXCEEDED | 2 | Page limit |
| Cloudflare 520 error | 1 | Infrastructure |

---

## 9. Recommendations

### P0 — Fix Diagnostic Data Loss (Critical)
When `processWithDocumentAI` throws, persist `gemini_debug` and `documentText.length` alongside the error. Change the throw to return an error object, or wrap the throw so the catch block saves debug info.

```typescript
// Before throwing, save diagnostic data
if (extractedData.fields_extracted === 0) {
  // Persist debug data before throwing
  await updateExtractionStatus(supabase, extraction_id, {
    extraction_status: "failed",
    extraction_error: "Both Gemini and Document AI failed to extract any fields",
    gemini_raw_response: geminiDebug,
    raw_extraction_data: { document_text_length: documentText.length, text_preview: documentText.substring(0, 500) },
  });
  throw new Error("Both Gemini and Document AI failed to extract any fields from the document");
}
```

Or better: don't throw — return the extractedData with 0 fields and let the caller handle it (which already sets `extraction_status = "extraction_failed"` at line 553).

### P1 — Add Gemini Safety Filter Retry
Currently retries only on "No JSON found" or "empty response". Add retry for safety filter blocks:
```typescript
if (finishReason === "SAFETY") {
  // Retry with slightly different prompt or lower safety thresholds
}
```

### P1 — Fix `fromStart: 30` Page Limit
The `processOptions.fromStart` parameter is being ignored or not working as expected. Consider:
1. Switching to `individualPageSelector` with explicit page numbers `[1,2,...,15]`
2. Or enabling imageless mode explicitly to get the 30-page limit
3. Or pre-checking page count and rejecting/warning for large documents

### P2 — Handle `documentText.length ≤ 100` Gracefully
When Document AI returns very little text (<100 chars), the code silently skips Gemini and returns 0 fields. Add explicit logging and a better error:
```typescript
if (documentText.length <= 100) {
  console.warn(`[process-document] Document AI returned only ${documentText.length} chars — possible OCR failure or non-text document`);
  // Consider throwing or marking as needs_manual_review
}
```

### P2 — Differentiate Error Types for User
The generic "Both Gemini and Document AI failed" gives no actionable info. Return specific error codes:
- `DOCUMENT_UNREADABLE` — OCR returned empty/minimal text
- `EXTRACTION_FAILED` — OCR worked but AI couldn't extract fields
- `NOT_RENTAL_AGREEMENT` — Document classified as non-rental

### P3 — Monitor Document AI Response Quality
Log `documentText.length` for every call (already in `geminiDebug.text_length`) and alert if it's anomalously low compared to file size.
