/**
 * Gemini API key fallback for rental agreement extraction.
 * Uses generativelanguage.googleapis.com (Google AI Studio endpoint).
 * Independent network route from Vertex AI (aiplatform.googleapis.com).
 *
 * Ported from Supabase Edge Functions:
 * - process-document-fallback/index.ts (callGeminiApiKey, callGeminiApiKeyMultimodal, callGeminiApiKeyMultimodalUrl)
 * - process-document/index.ts (verifyWithGemini)
 *
 * Changes from Deno version:
 * - Uses Node.js AbortController
 * - Uses `process.env` instead of `Deno.env.get()`
 * - Imports schema and prompts from extraction modules
 */

import { EXTRACTION_RESPONSE_SCHEMA, GEMINI_SAFETY_SETTINGS } from '../extraction/schema.js';
import { buildExtractionPrompt, MULTIMODAL_EXTRACTION_PROMPT } from '../extraction/prompts.js';
import { extractBalancedJson } from '../extraction/utils.js';

const GEMINI_TIMEOUT_MS = 300_000; // 5 min per call
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Text-based extraction via Gemini API key.
 * Used when OCR text is available (>= 100 chars).
 *
 * @param documentText - OCR text from Document AI
 * @param apiKey - Gemini API key
 * @returns Parsed extraction result object
 */
export async function callGeminiApiKeyText(
  documentText: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  const prompt = buildExtractionPrompt(documentText);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${GEMINI_BASE_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_RESPONSE_SCHEMA,
          },
          safetySettings: [...GEMINI_SAFETY_SETTINGS],
        }),
        signal: controller.signal,
      }
    );
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Gemini API key timed out after ${GEMINI_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText.substring(0, 500)}`);
  }

  const result = await response.json();

  // Check prompt-level blocking
  const promptBlock = result.promptFeedback?.blockReason;
  if (promptBlock) {
    throw new Error(`Gemini API prompt blocked by safety filter: ${promptBlock}`);
  }

  const finishReason = result.candidates?.[0]?.finishReason;
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) {
    throw new Error(`Empty Gemini API response (finishReason: ${finishReason || 'unknown'})`);
  }

  return parseGeminiText(text, 'Gemini API text');
}

/**
 * Multimodal PDF extraction via Gemini API key (inline base64).
 * Used when OCR returns insufficient text and PDF is < 7MB.
 *
 * @param base64Content - Base64-encoded PDF content
 * @param apiKey - Gemini API key
 * @returns Parsed extraction result object
 */
export async function callGeminiApiKeyMultimodal(
  base64Content: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${GEMINI_BASE_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: 'application/pdf', data: base64Content } },
                { text: MULTIMODAL_EXTRACTION_PROMPT },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_RESPONSE_SCHEMA,
            mediaResolution: 'MEDIA_RESOLUTION_HIGH',
          },
          safetySettings: [...GEMINI_SAFETY_SETTINGS],
        }),
        signal: controller.signal,
      }
    );
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Gemini API multimodal timed out after ${GEMINI_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API multimodal ${response.status}: ${errorText.substring(0, 500)}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) throw new Error('Empty Gemini API multimodal response');

  return parseGeminiText(text, 'Gemini API multimodal');
}

/**
 * Multimodal PDF extraction via Gemini API key using signed URL.
 * Used for large PDFs (7-15 MB) that exceed the inline base64 limit.
 * Gemini fetches the PDF directly via HTTPS fileUri.
 *
 * @param signedUrl - Supabase Storage signed URL for the PDF
 * @param apiKey - Gemini API key
 * @returns Parsed extraction result object
 */
export async function callGeminiApiKeyMultimodalUrl(
  signedUrl: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${GEMINI_BASE_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { fileData: { fileUri: signedUrl, mimeType: 'application/pdf' } },
                { text: MULTIMODAL_EXTRACTION_PROMPT },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_RESPONSE_SCHEMA,
            mediaResolution: 'MEDIA_RESOLUTION_HIGH',
          },
          safetySettings: [...GEMINI_SAFETY_SETTINGS],
        }),
        signal: controller.signal,
      }
    );
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Gemini API URL multimodal timed out after ${GEMINI_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API URL multimodal ${response.status}: ${errorText.substring(0, 500)}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) throw new Error('Empty Gemini API URL multimodal response');

  return parseGeminiText(text, 'Gemini API URL multimodal');
}

/**
 * Parse JSON from Gemini response text with balanced JSON fallback.
 * Shared across all three API key call patterns.
 */
function parseGeminiText(text: string, label: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    // Try regex match for JSON object
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (parseErr) {
        // Greedy regex may have captured too much -- try balanced extraction
        const balanced = extractBalancedJson(text);
        if (balanced) {
          try {
            return JSON.parse(balanced);
          } catch {
            throw new Error(`${label}: malformed JSON: ${(parseErr as Error).message}. First 200 chars: ${match[0].substring(0, 200)}`);
          }
        }
        throw new Error(`${label}: malformed JSON: ${(parseErr as Error).message}. First 200 chars: ${match[0].substring(0, 200)}`);
      }
    }
    throw new Error(`No JSON in ${label} response`);
  }
}
