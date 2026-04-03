# Retry Logic Audit: `process-document/index.ts`

**Date:** 2026-04-02  
**Scope:** All Gemini call failure modes in `extractWithVertexAIGemini()` (lines ~1000–1139) and `verifyWithGemini()` (lines ~1145–1306), plus the orchestration retry logic (lines ~770–870).

---

## 1. Current Retry Architecture Summary

The function uses a **two-tier strategy**:

| Layer | Mechanism | Details |
|-------|-----------|---------|
| **Tier 1 — Fallback** | Vertex AI → API Key | If Vertex AI fails entirely (after retries), falls back to API key Gemini (line 824) |
| **Tier 2 — Retry loop** | Per-path retry | Up to **2 retries** (3 total attempts) with **3 s fixed delay**, but **only** for errors whose message includes `"No JSON found"` or `"empty response"` |

**Retry trigger condition (lines 796, 842):**
```ts
if (vertexError.message?.includes("No JSON found") || vertexError.message?.includes("empty response"))
```

This is the **only** condition that triggers retries. All other failures immediately fall through to the next tier or fail outright.

---

## 2. Failure Mode Matrix

| # | Failure Mode | Error Thrown (msg pattern) | Vertex AI: Retried? | API Key: Retried? | Fallback V→A? | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| 1 | **HTTP 429 / RESOURCE_EXHAUSTED** | `"Vertex AI Gemini failed: 429 - ..."` | ❌ No | ❌ No | ✅ Yes (falls to API key) | **Medium** | Add 429/RESOURCE_EXHAUSTED to retry triggers with exponential backoff |
| 2 | **HTTP 500** | `"...failed: 500 - ..."` | ❌ No | ❌ No | ✅ Yes (Vertex→API key only) | **Medium** | Retry 500 at least once — transient Google infra errors are common |
| 3 | **HTTP 502 Bad Gateway** | `"...failed: 502 - ..."` | ❌ No | ❌ No | ✅ Yes (Vertex→API key only) | **Medium** | Same as 500 |
| 4 | **HTTP 503 Service Unavailable** | `"...failed: 503 - ..."` | ❌ No | ❌ No | ✅ Yes (Vertex→API key only) | **Medium** | Same as 500 |
| 5 | **Connection timeout (AbortController)** | `"...timed out after 300s"` | ❌ No (msg lacks "No JSON"/"empty response") | ❌ No | ✅ Yes (Vertex→API key only) | **Low** | 300 s is generous; retry adds risk of doubling wall-clock time. Consider reducing to 120 s + 1 retry |
| 6 | **Network error / connection reset** | Raw fetch exception (e.g., `TypeError: fetch failed`) | ❌ No | ❌ No | ✅ Yes (Vertex→API key only) | **Medium** | Add network errors (TypeError from fetch) to retry triggers |
| 7 | **Safety filter block (finishReason: SAFETY)** | Produces empty `textContent` → `"empty response (finishReason: SAFETY)"` | ✅ **Yes** (msg contains "empty response") | ✅ **Yes** | ✅ Yes | **Low** | Currently covered. Good. |
| 8 | **finishReason: RECITATION** | Same as safety — empty text → `"empty response (finishReason: RECITATION)"` | ✅ **Yes** | ✅ **Yes** | ✅ Yes | **Low** | Covered. |
| 9 | **finishReason: OTHER** | Same as safety — empty text → `"empty response (finishReason: OTHER)"` | ✅ **Yes** | ✅ **Yes** | ✅ Yes | **Low** | Covered. |
| 10 | **Empty response / no candidates** | `"empty response (finishReason: unknown)"` or `"empty text content"` | ✅ **Yes** (msg contains "empty response") | ✅ **Yes** | ✅ Yes | **Low** | Covered. |
| 11 | **No JSON in non-empty response** | `"No JSON found in ... response"` | ✅ **Yes** (msg contains "No JSON found") | ✅ **Yes** | ✅ Yes | **Low** | Covered. |
| 12 | **Malformed JSON** | `"...returned malformed JSON: ..."` | ❌ No (msg says "malformed JSON", not "No JSON"/"empty response") | ❌ No | ✅ Yes (Vertex→API key only) | **Medium** | Add "malformed JSON" to retry triggers — LLM output is non-deterministic |
| 13 | **Empty JSON object `{}`** | Vertex: `"Vertex AI Gemini returned empty JSON"` / API key: `"Gemini API returned empty JSON object"` | ❌ No (msg says "empty JSON", not "empty response") | ❌ No | ✅ Yes (Vertex→API key only) | **High** | **Gap!** "empty JSON" ≠ "empty response" string match. Retries NOT triggered. |
| 14 | **finishReason: MAX_TOKENS** | Non-empty truncated text with `finishReason: MAX_TOKENS`. If truncated JSON parses → accepted as-is; if not → "malformed JSON" | ❌ No (unless truncation causes "No JSON") | ❌ No | Partial | **Medium** | No explicit MAX_TOKENS handling. Should detect and re-prompt with shorter input or raise a clear error |
| 15 | **`textContent === "{}"`** (Vertex only) | `"Vertex AI Gemini returned empty response (finishReason: ...)"` — msg contains "empty response" | ✅ **Yes** | N/A (API key path checks `!textContent`, not `=== "{}"`) | ✅ Yes | **Low** | Asymmetry — API key path doesn't check for `"{}"` string. Minor. |

---

## 3. Symmetry Analysis: Vertex AI vs. API Key Paths

| Aspect | Vertex AI (`extractWithVertexAIGemini`) | API Key (`verifyWithGemini`) | Symmetric? |
|--------|----------------------------------------|------------------------------|------------|
| Timeout | 300 s AbortController | 300 s AbortController | ✅ Yes |
| HTTP error handling | `throw new Error(status + errorText)` | `throw new Error(status + errorText.substring(0,200))` | ⚠️ Minor: API key truncates to 200 chars |
| Empty text check | `!textContent \|\| textContent === "{}"` | `!textContent` (no `=== "{}"` check) | ❌ **No** — API key misses `"{}"` case |
| Empty JSON object | `throw "empty JSON"` | `throw "empty JSON object"` | ⚠️ Different error messages but both throw |
| Safety settings | Identical 4 categories at BLOCK_ONLY_HIGH | Identical | ✅ Yes |
| JSON parsing | Greedy regex → balanced fallback | Greedy regex → balanced fallback | ✅ Yes |
| Outer try/catch | No outer try/catch (bare function) | Has outer `try { ... } catch { throw error; }` — effectively a no-op re-throw | ⚠️ Cosmetic difference |
| Retry trigger strings | Retried on "No JSON found" or "empty response" | Same | ✅ Yes |
| Model | `gemini-3-flash-preview` | `gemini-3-flash-preview` | ✅ Yes |
| Prompt | Standalone extraction prompt | Verification prompt (includes initial extraction for cross-check) | ✅ Intentionally different |

---

## 4. Fallback as Retry — Is It Sufficient?

The Vertex AI → API Key fallback **acts as a pseudo-retry** with a completely independent infrastructure path (different auth, different endpoint). This is **stronger** than a simple retry for:
- Auth/credential issues (different service account vs. API key)
- Regional outages (Vertex uses `aiplatform.googleapis.com`, API key uses `generativelanguage.googleapis.com`)

**However**, it is **not sufficient** for:
- Errors that affect both paths simultaneously (e.g., model-level safety blocks on the same document, model outages for the same model version)
- The API key path is the **last line of defense** — if it fails, there's no further retry/fallback

---

## 5. Error Swallowing Analysis

| Location | Code | Swallowed? | Verdict |
|----------|------|-----------|---------|
| Lines 792–815 | Vertex AI catch → conditional retry | ❌ Not swallowed — falls through to API key fallback | ✅ OK |
| Lines 838–860 | API key catch → conditional retry | ❌ Not swallowed — if no result, falls through to Doc AI-only fallback | ✅ OK |
| Lines 890–896 | `if (geminiDebug.gemini_attempted && !geminiResult)` | Falls back to Doc AI only; throws if 0 fields extracted | ⚠️ **Partial swallow** — if Doc AI has ≥1 field, Gemini failure is silently downgraded to `extraction_method: 'gcp_doc_ai'` with no user-visible warning |
| Line 1305 | `catch (error) { throw error; }` | ❌ Re-throws | ✅ OK (no-op catch) |
| Line 348 | `.catch((e) => console.warn(...))` | ✅ Swallowed — notification send failure | ✅ OK — intentionally non-blocking |
| Line 576–578 | Geocoding catch | ✅ Swallowed | ✅ OK — explicitly non-fatal |

**Key concern:** When both Gemini paths fail but Document AI extracted ≥1 field, the function succeeds silently with `extraction_method: 'gcp_doc_ai'`. The `gemini_debug` object is stored in the raw data, but the user sees no warning that Gemini verification was skipped. This means extraction quality could be significantly degraded without any signal to the user.

---

## 6. Identified Gaps (Ranked by Risk)

### HIGH Risk
1. **Empty JSON object `{}` not retried** — Error message `"empty JSON"` / `"empty JSON object"` does **not** match the retry trigger strings `"No JSON found"` or `"empty response"`. This is a likely safety-filter or model flake scenario that should be retried.

### MEDIUM Risk
2. **HTTP 429/500/502/503 not retried** — Server errors and rate limits throw immediately. The Vertex→API key fallback mitigates for the Vertex path, but on the API key path (last resort), a transient 429 or 503 means permanent failure.
3. **Malformed JSON not retried** — LLM output non-determinism means a malformed response on attempt 1 may succeed on attempt 2.
4. **Network errors (fetch TypeError) not retried** — Transient DNS/connection failures should get at least 1 retry.
5. **No exponential backoff** — Fixed 3 s delay for all retries. 429 errors typically need longer backoff (Gemini API returns `Retry-After` headers).
6. **Silent quality degradation** — When Gemini fails but Doc AI has data, the function succeeds without user-visible quality warning.

### LOW Risk
7. **`textContent === "{}"` check asymmetry** — Only Vertex AI path checks for literal `"{}"` string; API key path doesn't.
8. **MAX_TOKENS not explicitly handled** — If response is truncated mid-JSON, it becomes a malformed JSON error (not retried). Could re-prompt with shorter input.
9. **AbortController timeout not retried** — 300 s is generous; retrying after timeout would double wall time. Acceptable as-is, but consider reducing timeout + adding 1 retry.

---

## 7. Recommendations Summary

1. **Widen retry trigger condition** (lines 796, 842): Change from substring-matching to a broader check:
   ```ts
   const isRetryable = (msg: string) =>
     msg.includes("No JSON found") ||
     msg.includes("empty response") ||
     msg.includes("empty JSON") ||
     msg.includes("malformed JSON") ||
     msg.includes("429") ||
     msg.includes("RESOURCE_EXHAUSTED") ||
     /failed: 5\d{2}/.test(msg) ||
     msg.includes("fetch failed") ||
     msg.includes("network");
   ```

2. **Use exponential backoff** instead of fixed 3 s: `delay = 3000 * Math.pow(2, attempt - 1)` (3 s, 6 s).

3. **Add `"{}"` check to API key path** (line 1271): `if (!textContent || textContent === "{}") { ... }` to match Vertex AI behavior.

4. **Surface Gemini failure to user** when falling back to Doc AI-only: set a `review_reason` like `"AI verification unavailable — please verify extracted data"`.

5. **Consider MAX_TOKENS detection**: Check `finishReason === "MAX_TOKENS"` explicitly and either retry with truncated input or flag for manual review.
