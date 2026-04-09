/**
 * Vertex AI Gemini integration for rental agreement extraction.
 * Ported from Supabase Edge Function process-document/index.ts extractWithVertexAIGemini().
 *
 * Changes from Deno version:
 * - Uses `google-auth-library` (GoogleAuth) instead of manual JWT
 * - 300s timeout (Cloud Run has plenty of time vs 60s edge function default)
 * - Uses Node.js AbortController
 * - Imports schema and prompts from extraction modules
 */

import { GoogleAuth } from 'google-auth-library';
import { EXTRACTION_RESPONSE_SCHEMA, GEMINI_SAFETY_SETTINGS } from '../extraction/schema.js';
import { buildVertexAIExtractionPrompt, MULTIMODAL_EXTRACTION_PROMPT } from '../extraction/prompts.js';
import { extractBalancedJson, isRetryableGeminiError } from '../extraction/utils.js';

/**
 * Extract rental agreement data using Vertex AI Gemini (text-based).
 * Primary extraction path: uses GCP service account auth via aiplatform.googleapis.com.
 *
 * @param documentText - OCR text from Document AI
 * @param credentials - JSON string of GCP service account credentials (Vertex AI project)
 * @param projectId - Vertex AI project ID (e.g., "flent-ai-project-2")
 * @param location - Endpoint location: "global" for provisioned throughput, or regional (e.g., "us-central1")
 * @returns Parsed extraction result object
 */
export async function extractWithVertexAIGemini(
  documentText: string,
  credentials: string,
  projectId: string,
  location: string = 'global'
): Promise<Record<string, unknown>> {
  // Use google-auth-library for Vertex AI auth
  const credentialsJson = JSON.parse(credentials);
  const auth = new GoogleAuth({
    credentials: credentialsJson,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;

  if (!accessToken) {
    throw new Error('Failed to obtain GCP access token for Vertex AI');
  }

  const prompt = buildVertexAIExtractionPrompt(documentText);

  // Use Vertex AI Gemini endpoint -- global endpoint for provisioned throughput
  // Global: https://aiplatform.googleapis.com/v1/projects/.../locations/global/...
  // Regional: https://{location}-aiplatform.googleapis.com/v1/projects/.../locations/{location}/...
  const host = location === 'global'
    ? 'aiplatform.googleapis.com'
    : `${location}-aiplatform.googleapis.com`;
  const endpoint = `https://${host}/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-3-flash-preview:generateContent`;

  // 300s timeout -- large agreements can produce 50K+ chars of document text
  const GEMINI_TIMEOUT_MS = 300_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: 'application/json',
          responseSchema: EXTRACTION_RESPONSE_SCHEMA,
        },
        safetySettings: [...GEMINI_SAFETY_SETTINGS],
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Vertex AI Gemini timed out after ${GEMINI_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[gemini-vertex] Vertex AI Gemini error:', errorText);
    throw new Error(`Vertex AI Gemini failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // Check prompt-level blocking (fires before generation -- candidates may be absent)
  const promptBlock = result.promptFeedback?.blockReason;
  if (promptBlock) {
    console.error(`[gemini-vertex] Vertex AI prompt blocked: ${promptBlock}`, JSON.stringify(result.promptFeedback));
    throw new Error(`Vertex AI prompt blocked by safety filter: ${promptBlock}`);
  }

  const finishReason = result.candidates?.[0]?.finishReason;
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  console.log('[gemini-vertex] Vertex AI Gemini response:', textContent.substring(0, 500));
  if (finishReason && finishReason !== 'STOP') {
    console.error(`[gemini-vertex] Vertex AI finishReason: ${finishReason} (candidates: ${JSON.stringify(result.candidates?.map((c: any) => ({ finishReason: c.finishReason, safetyRatings: c.safetyRatings })))})`);
  }

  if (!textContent || textContent === '{}') {
    throw new Error(`Vertex AI Gemini returned empty response (finishReason: ${finishReason || 'unknown'})`);
  }

  // Parse JSON from response (handle markdown code blocks if present)
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      // Greedy regex may have captured too much -- try non-greedy balanced extraction
      const balanced = extractBalancedJson(textContent);
      if (balanced) {
        try {
          parsed = JSON.parse(balanced);
        } catch {
          throw new Error(`Vertex AI Gemini returned malformed JSON: ${(parseErr as Error).message}. First 200 chars: ${jsonMatch[0].substring(0, 200)}`);
        }
      } else {
        throw new Error(`Vertex AI Gemini returned malformed JSON: ${(parseErr as Error).message}. First 200 chars: ${jsonMatch[0].substring(0, 200)}`);
      }
    }
    if (Object.keys(parsed).length === 0) {
      throw new Error('Vertex AI Gemini returned empty JSON');
    }
    console.log('[gemini-vertex] Vertex AI parsed:', Object.keys(parsed).length, 'fields');
    return parsed;
  }

  console.error(`[gemini-vertex] No JSON in Vertex AI response. finishReason: ${finishReason}. textContent (first 500): ${textContent.substring(0, 500)}`);
  throw new Error(`No JSON found in Vertex AI Gemini response (finishReason: ${finishReason || 'unknown'})`);
}

/**
 * Multimodal Vertex AI Gemini extraction -- sends raw PDF as inlineData.
 * Used when OCR returns insufficient text (< 100 chars).
 *
 * @param base64Content - Base64-encoded PDF content
 * @param credentials - JSON string of GCP service account credentials
 * @param projectId - Vertex AI project ID
 * @param location - Endpoint location (default: "global")
 * @returns Parsed extraction result object, or null if extraction failed
 */
export async function extractMultimodalVertexAI(
  base64Content: string,
  credentials: string,
  projectId: string,
  location: string = 'global'
): Promise<Record<string, unknown> | null> {
  const credentialsJson = JSON.parse(credentials);
  const auth = new GoogleAuth({
    credentials: credentialsJson,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;

  if (!accessToken) {
    throw new Error('Failed to obtain GCP access token for multimodal Vertex AI');
  }

  const MULTIMODAL_TIMEOUT_MS = 300_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MULTIMODAL_TIMEOUT_MS);

  const host = location === 'global'
    ? 'aiplatform.googleapis.com'
    : `${location}-aiplatform.googleapis.com`;
  const endpoint = `https://${host}/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-3-flash-preview:generateContent`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: base64Content } },
            { text: MULTIMODAL_EXTRACTION_PROMPT },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: 'application/json',
          responseSchema: EXTRACTION_RESPONSE_SCHEMA,
          // HIGH resolution for better fine-text reading in scanned docs
          mediaResolution: 'MEDIA_RESOLUTION_HIGH',
        },
        safetySettings: [...GEMINI_SAFETY_SETTINGS],
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Multimodal Vertex AI timed out after ${MULTIMODAL_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Multimodal Vertex AI failed: ${response.status}: ${errText.substring(0, 300)}`);
  }

  const mmResult = await response.json();
  const mmText = mmResult.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!mmText || mmText === '{}') {
    return null;
  }

  const parsed = extractBalancedJson(mmText);
  const result = parsed ? JSON.parse(parsed) : JSON.parse(mmText);

  console.log(`[gemini-vertex] Multimodal Vertex AI: ${Object.keys(result).length} keys extracted`);
  return result;
}

// Re-export for use by extraction pipeline
export { isRetryableGeminiError };
