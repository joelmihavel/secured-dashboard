# Audit: Gemini Safety Filter & Edge Cases in process-document

**Date:** 2026-04-02  
**File:** `supabase/functions/process-document/index.ts`  
**Scope:** Safety filter config, response parsing edge cases, classification logic

---

## 1. Safety Filter Configuration Comparison

| Aspect | Vertex AI (`extractWithVertexAIGemini`) | API Key (`verifyWithGemini`) | Match? |
|---|---|---|---|
| `HARM_CATEGORY_DANGEROUS_CONTENT` | `BLOCK_ONLY_HIGH` (line 1076) | `BLOCK_ONLY_HIGH` (line 1237) | ✅ |
| `HARM_CATEGORY_HARASSMENT` | `BLOCK_ONLY_HIGH` (line 1077) | `BLOCK_ONLY_HIGH` (line 1238) | ✅ |
| `HARM_CATEGORY_SEXUALLY_EXPLICIT` | `BLOCK_ONLY_HIGH` (line 1078) | `BLOCK_ONLY_HIGH` (line 1239) | ✅ |
| `HARM_CATEGORY_HATE_SPEECH` | `BLOCK_ONLY_HIGH` (line 1079) | `BLOCK_ONLY_HIGH` (line 1240) | ✅ |
| `HARM_CATEGORY_CIVIC_INTEGRITY` | ❌ Not configured | ❌ Not configured | ✅ (both omit) |
| Model | `gemini-3-flash-preview` | `gemini-3-flash-preview` | ✅ |
| `responseMimeType` | `application/json` | `application/json` | ✅ |
| `temperature` | `0.1` | `0.1` | ✅ |
| `maxOutputTokens` | `8192` | `8192` | ✅ |

**Assessment:** Both paths are identically configured. `BLOCK_ONLY_HIGH` is the most permissive threshold, which is correct for rental agreements containing PII (names, addresses, phone numbers, financial data). `HARM_CATEGORY_CIVIC_INTEGRITY` is omitted in both — this is fine; it's a newer category for election-related content and is irrelevant here.

---

## 2. Edge Case Matrix: Safety Filter Block Handling

| Scenario | Vertex AI Handling | API Key Handling | Status |
|---|---|---|---|
| **finishReason = "SAFETY", candidates[0] exists with no content** | `textContent = ""` via optional chaining → throws "empty response" | `textContent = ""` → throws "empty text content" | ⚠️ Functional but divergent error messages |
| **finishReason = "SAFETY", candidates = empty array** | `finishReason = undefined`, `textContent = ""` → throws "empty response (finishReason: unknown)" | `finishReason = undefined`, `textContent = ""` → throws "empty text content (finishReason: unknown)" | ⚠️ Loses SAFETY reason |
| **candidates absent entirely (promptFeedback.blockReason = "SAFETY")** | `finishReason = undefined`, `textContent = ""` → throws, blockReason never checked | Same — blockReason never checked | 🐛 **Bug: `promptFeedback.blockReason` is never inspected** |
| **finishReason = "STOP", textContent = "{}"** | Explicit check: `textContent === "{}"` → throws "empty response" | Not explicitly checked, but caught later: `Object.keys(parsed).length === 0` → throws "empty JSON object" | ✅ Both handle, but different code paths |
| **finishReason = "STOP", textContent = valid JSON** | Parsed and returned | Parsed and returned | ✅ |
| **finishReason = "MAX_TOKENS"** | Logged as non-STOP, parsing attempted (may fail on truncated JSON) | Same | ⚠️ No special handling for truncated JSON |
| **finishReason = "RECITATION"** | Same as above | Same as above | ⚠️ No special handling |
| **Retry on safety flake (Vertex AI)** | Checks `"No JSON found"` or `"empty response"` → ✅ matches "Vertex AI Gemini returned empty response" | N/A | ✅ |
| **Retry on safety flake (API Key)** | N/A | Checks `"No JSON found"` or `"empty response"` → ❌ "Gemini API returned empty text content" does NOT contain "empty response" | 🐛 **Bug: Retry won't trigger on empty API key response** |

### Critical Finding: API Key Retry Mismatch

**Lines 841-842:** The retry condition checks for `apiKeyError.message?.includes("empty response")`, but the actual error thrown at line 1273 is `"Gemini API returned empty text content"` — this string does NOT contain `"empty response"`. The retry will only fire for `"No JSON found"` errors, NOT for completely empty (safety-blocked) responses in the API key path.

**Vertex AI** is fine because its error at line 1109 says `"empty response"` which matches.

### Critical Finding: promptFeedback.blockReason Never Checked

When Gemini completely blocks a prompt (before generation), the response may have no `candidates` at all. Instead, the safety information is in `promptFeedback.blockReason`. The code never reads this field, so:
- Diagnostic logging loses the actual block reason
- The error message says `finishReason: unknown` instead of identifying the safety block

---

## 3. JSON Parsing Risk Assessment

| Risk | Details | Severity | Mitigated? |
|---|---|---|---|
| **Greedy regex `/\{[\s\S]*\}/` over-matching** | Matches from first `{` to last `}` in entire text. If Gemini returns `{"key": "val"} extra text }`, the regex captures everything including the trailing content. | Medium | ✅ Yes — if `JSON.parse` fails on the over-matched string, `extractBalancedJson()` is called as fallback |
| **`extractBalancedJson` not called in all error paths** | It's only called when `JSON.parse(jsonMatch[0])` throws. If the greedy regex captures valid-but-wrong JSON, the balanced extractor is never tried. | Low | ⚠️ Unlikely in practice since model returns single JSON object |
| **Empty JSON `{}`** | Vertex: explicitly checked (`textContent === "{}"`). API key: caught by `Object.keys(parsed).length === 0` after parsing. | Low | ✅ Both paths handle it |
| **Regex needed with `responseMimeType: "application/json"`?** | With this mime type, Gemini should return clean JSON directly. The regex is defensive against model non-compliance or markdown code blocks. | Info | ✅ Harmless safety net — no risk in keeping it |
| **Nested JSON objects** | The greedy regex correctly captures from first `{` to last `}` for well-formed nested JSON. The balanced extractor handles malformed nested structures. | Low | ✅ |
| **`JSON.parse` on text with control chars** | Gemini may include literal newlines in string values. `JSON.parse` handles these, but `\t`, `\r` within strings could cause issues. | Very Low | ✅ Standard JSON parser handles this |

---

## 4. Vertex AI vs API Key Response Structure

| Aspect | Vertex AI | API Key | Difference Impact |
|---|---|---|---|
| Endpoint | `aiplatform.googleapis.com/v1/...` | `generativelanguage.googleapis.com/v1beta/...` | None — both return same candidate structure |
| Request `contents` format | `[{ role: "user", parts: [...] }]` | `[{ parts: [...] }]` (no `role`) | None — API infers user role |
| Response candidates | `result.candidates[0].content.parts[0].text` | Same | ✅ |
| Empty text check | `!textContent \|\| textContent === "{}"` (line 1108) | `!textContent` only (line 1272) | ⚠️ **Inconsistency** — `{}` not explicitly caught in API key path (but handled later) |
| Error throw message | `"Vertex AI Gemini returned empty response"` | `"Gemini API returned empty text content"` | 🐛 **Breaks retry logic** — see Section 2 |

---

## 5. `is_rental_agreement: false` Classification Path

### Flow when Gemini classifies document as non-rental:

1. Gemini returns `{ is_rental_agreement: false, document_type_detected: "Sale Deed", ... }`
2. Code at line 874: detects `is_rental_agreement === false`
3. Stores classification flags on `extractedData` (lines 879-882)
4. Returns `extractedData` early — **no Gemini field merge, extraction_method stays 'gcp_doc_ai'**
5. Back in main handler, `extractedData.fields_extracted` reflects only Document AI entities
6. Line 547: `extraction_status = fields_extracted > 0 ? "completed" : "extraction_failed"`
7. `evaluateExtraction()` returns `contract_status: 'invalid_document'`

### Risk: False negative misclassification

| Scenario | Risk | Impact |
|---|---|---|
| Poor OCR on legitimate rental agreement | Medium | Gemini sees garbled text, may set `is_rental_agreement: false` |
| Agreement in regional language (Hindi, Kannada, Marathi) | Medium | Gemini may struggle with non-English agreements |
| Unusual format (handwritten, non-standard) | Low-Medium | Could be misclassified |
| Agreement mixed with other documents (e.g., multi-page PDF with unrelated pages) | Low | First 50K chars may not contain rental content |

**There is no second opinion, manual override, or confidence threshold on the classification.** If Gemini says `is_rental_agreement: false`, the document is rejected immediately. The prompt instructs to set all extraction fields to `null` when `is_rental_agreement: false`, so even if the model partially extracts data, it won't be used.

---

## 6. `fields_extracted > 0` Logic Analysis (Line 547)

### The semantic inconsistency:

```
extraction_status: extractedData.fields_extracted > 0 ? "completed" : "extraction_failed"
```

| Scenario | `fields_extracted` | `extraction_status` | `contract_status` | Correct? |
|---|---|---|---|---|
| Successful extraction, all fields | 20+ | `completed` | `user_review` | ✅ |
| Partial extraction, some fields | 5-15 | `completed` | `manual_review` | ✅ |
| `is_rental_agreement: false`, Doc AI found no entities | 0 | `extraction_failed` | `invalid_document` | ⚠️ Misleading |
| `is_rental_agreement: false`, Doc AI found some entities (address, city) | 2-3 | `completed` | `invalid_document` | 🐛 **Bug: `completed` + `invalid_document` is contradictory** |
| Both Gemini paths failed, Doc AI has 0 fields | 0 (throws before reaching line 547) | N/A (error thrown) | N/A | ✅ |
| Both Gemini paths failed, Doc AI has some fields | 3-5 | `completed` | varies | ✅ |

### Bug Detail:
When a non-rental document (e.g., sale deed) happens to contain entity-like text that Document AI parses as rental entities (e.g., "property_address", "city"), `fields_extracted > 0` becomes true, marking `extraction_status: "completed"` even though `contract_status: "invalid_document"`. The client would see a "completed" extraction for a rejected document.

---

## 7. Recommendations

### P0 — Fix API Key Retry Mismatch (High Impact)
**Line 842:** Change the retry condition from:
```ts
apiKeyError.message?.includes("empty response")
```
to:
```ts
apiKeyError.message?.includes("empty response") || apiKeyError.message?.includes("empty text content")
```
This ensures safety-filter-triggered empty responses on the API key path also get retried.

### P1 — Inspect `promptFeedback.blockReason` (Medium Impact)
After parsing the Gemini response, check for prompt-level blocks:
```ts
const blockReason = result.promptFeedback?.blockReason;
if (blockReason) {
  console.error(`[process-document] Prompt blocked: ${blockReason}`);
  throw new Error(`Gemini prompt blocked by safety filter: ${blockReason}`);
}
```
This should be checked BEFORE accessing `candidates`, as candidates may be absent when the prompt is blocked.

### P1 — Fix `extraction_status` for Non-Rental Documents (Medium Impact)
When `is_rental_agreement === false`, explicitly set `fields_extracted = 0` before returning to ensure `extraction_status` is always `extraction_failed` (or better, a dedicated `rejected` status):
```ts
if (geminiResult.is_rental_agreement === false) {
  // ... existing classification code ...
  extractedData.fields_extracted = 0;  // Force 0 regardless of Doc AI entities
  return extractedData;
}
```

### P2 — Handle `finishReason: "MAX_TOKENS"` (Low Impact)
If the model runs out of tokens, the JSON will be truncated and unparseable. Add explicit handling:
```ts
if (finishReason === "MAX_TOKENS") {
  console.warn("[process-document] Response truncated — maxOutputTokens may be insufficient");
}
```
The existing parse-error fallback to `extractBalancedJson` partially handles this, but logging the cause helps debugging.

### P2 — Normalize Empty-Check Between Paths (Low Impact)
Make the Vertex AI and API key paths consistent in their empty-text checks. Either both should check `!textContent || textContent === "{}"` or use the same guard.

### P3 — Add Classification Confidence Gate (Nice to Have)
Consider requiring `confidence > 50` for the `is_rental_agreement: false` classification to reduce false negatives on legitimate-but-poorly-OCR'd agreements.

---

## Summary

- **Safety config:** ✅ Identical and appropriate (`BLOCK_ONLY_HIGH` for all 4 categories)
- **Safety block handling:** ⚠️ Functional but has gaps — API key retry mismatch (P0), `promptFeedback.blockReason` not checked (P1)
- **JSON parsing:** ✅ Robust with greedy regex + balanced fallback. `responseMimeType: "application/json"` makes regex rarely needed but it's a harmless safety net
- **Non-rental classification:** ⚠️ No second opinion or confidence gate; `extraction_status` can be contradictory when Doc AI extracts entities from non-rental docs (P1)
- **fields_extracted logic:** ⚠️ Semantic mismatch between `extraction_status: "completed"` and `contract_status: "invalid_document"` in edge cases (P1)
