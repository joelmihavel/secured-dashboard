/**
 * Google Cloud Document AI integration for OCR.
 * Ported from Supabase Edge Function process-document/index.ts processWithDocumentAI().
 *
 * Change from Deno version:
 * - Uses `google-auth-library` (GoogleAuth) instead of manual JWT creation
 * - Uses Node.js AbortController instead of DOMException checks
 * - Uses `process.env` instead of `Deno.env.get()`
 */

import { GoogleAuth } from 'google-auth-library';
import type { DocumentAIResult } from '../types.js';
import { parseDocumentAIResponse } from '../extraction/parser.js';
import { slimDocAiData } from '../extraction/utils.js';

/**
 * Call Google Cloud Document AI for OCR processing.
 *
 * @param base64Content - Base64-encoded PDF content
 * @param credentials - JSON string of GCP service account credentials
 * @param projectId - GCP project ID (e.g., "secured-by-flent")
 * @param processorId - Document AI processor ID
 * @param location - Processor location (e.g., "us")
 * @returns Parsed document text, extracted entities, and raw response
 */
export async function callDocumentAI(
  base64Content: string,
  credentials: string,
  projectId: string,
  processorId: string,
  location: string
): Promise<DocumentAIResult> {
  // Use google-auth-library for GCP auth instead of manual JWT
  const credentialsJson = JSON.parse(credentials);
  const auth = new GoogleAuth({
    credentials: credentialsJson,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;

  if (!accessToken) {
    throw new Error('Failed to obtain GCP access token for Document AI');
  }

  // 300s independent timeout for Document AI
  const DOC_AI_TIMEOUT_MS = 300_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOC_AI_TIMEOUT_MS);

  let response: Response;
  try {
    console.log('[document-ai] Calling GCP Document AI...');
    response = await fetch(
      `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawDocument: {
            content: base64Content,
            mimeType: 'application/pdf',
          },
          // Cap at first 30 pages to avoid timeout on very large docs
          processOptions: {
            ocrConfig: {
              // Extract embedded text from digital PDFs -- dramatically improves
              // text quality for non-scanned agreements (most agreements are digital)
              enableNativePdfParsing: true,
              premiumFeatures: { computeStyleInfo: false },
              // Language hints for Indian rental agreements (English + major Indian languages)
              hints: {
                languageHints: ['en', 'hi', 'mr', 'kn', 'ta', 'te', 'bn'],
              },
            },
            fromStart: 30,
          },
        }),
        signal: controller.signal,
      }
    );
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Document AI timed out after ${DOC_AI_TIMEOUT_MS / 1000}s -- document may be too large`);
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Document AI failed: ${errorText}`);
  }

  const docAIResult = await response.json();
  const documentText = docAIResult.document?.text || '';

  // Parse initial extraction from entities (may be empty for OCR-only processors)
  const extractedData = parseDocumentAIResponse(docAIResult);

  console.log(`[document-ai] OCR complete: ${documentText.length} chars extracted`);

  return {
    documentText,
    extractedData,
    rawResponse: slimDocAiData(docAIResult),
  };
}
